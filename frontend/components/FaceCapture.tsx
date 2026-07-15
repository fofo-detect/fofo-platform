"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FaceLandmarker as FaceLandmarkerType } from "@mediapipe/tasks-vision";

const NUM_ANGLES = 8;
const MIN_MAGNITUDE = 0.16; // how far off-center (normalized) counts as "reached" a pose
const BUCKET_TOLERANCE_DEG = 26; // half-width of each 45deg wedge - wider than 22.5 to be forgiving
const STABILITY_FRAMES = 5; // consecutive matching frames required before a capture fires
const CDN_WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// Standard MediaPipe Face Mesh landmark indices.
const NOSE_TIP = 1;
const LEFT_CHEEK = 234;
const RIGHT_CHEEK = 454;
const FOREHEAD = 10;
const CHIN = 152;

type CameraState =
  | "prompt"
  | "unsupported"
  | "requesting"
  | "denied"
  | "no-camera"
  | "loading-model"
  | "model-error"
  | "ready";

interface FaceCaptureProps {
  onComplete: (files: File[]) => void;
  submitting: boolean;
}

export function FaceCapture({ onComplete, submitting }: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarkerType | null>(null);
  const rafRef = useRef<number | null>(null);
  const capturedBlobsRef = useRef<(Blob | null)[]>(new Array(NUM_ANGLES).fill(null));
  const bucketStreakRef = useRef<{ index: number; count: number }>({ index: -1, count: 0 });
  const completedRef = useRef(false);

  // Camera access is only ever requested after the user explicitly opts in
  // via the permission-prompt screen below - getUserMedia() is what actually
  // triggers the browser's native permission popup, so starting it
  // automatically on mount (the old behavior) meant that popup appeared with
  // no explanation, which is exactly what reads as "confusing" on mobile.
  const [started, setStarted] = useState(false);
  const [cameraState, setCameraState] = useState<CameraState>("prompt");
  const [capturedMask, setCapturedMask] = useState<boolean[]>(new Array(NUM_ANGLES).fill(false));
  const [allCaptured, setAllCaptured] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  // Capability check only - never prompts for permission, so it is safe to
  // run before the user has opted in.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraState("unsupported");
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const captureFrame = useCallback(
    (bucketIndex: number) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (!blob || completedRef.current) return;
          capturedBlobsRef.current[bucketIndex] = blob;
          setCapturedMask((prev) => {
            const next = [...prev];
            next[bucketIndex] = true;
            return next;
          });

          const doneCount = capturedBlobsRef.current.filter(Boolean).length;
          if (doneCount === NUM_ANGLES) {
            completedRef.current = true;
            setAllCaptured(true);
            stopCamera();
            const files = capturedBlobsRef.current.map(
              (b, i) => new File([b as Blob], `angle-${i}.jpg`, { type: "image/jpeg" })
            );
            onComplete(files);
          }
        },
        "image/jpeg",
        // 0.6 instead of 0.9 - roughly halves each frame's size, which
        // matters most on a slow mobile upload where 8 angles otherwise add
        // up to a payload that can time out before it finishes sending.
        0.6
      );
    },
    [onComplete, stopCamera]
  );

  // ---- camera + model setup ----
  useEffect(() => {
    if (!started) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraState("unsupported");
      return;
    }

    let cancelled = false;
    completedRef.current = false;
    capturedBlobsRef.current = new Array(NUM_ANGLES).fill(null);
    bucketStreakRef.current = { index: -1, count: 0 };
    setCapturedMask(new Array(NUM_ANGLES).fill(false));
    setAllCaptured(false);

    async function createLandmarker(delegate: "GPU" | "CPU") {
      const { FilesetResolver, FaceLandmarker } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(CDN_WASM);
      return FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: "VIDEO",
        numFaces: 1,
      });
    }

    async function setup() {
      setCameraState("requesting");
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
      } catch (err) {
        if (!cancelled) {
          const name = err instanceof DOMException ? err.name : "";
          const noCameraFound = name === "NotFoundError" || name === "DevicesNotFoundError";
          setCameraState(noCameraFound ? "no-camera" : "denied");
        }
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      setCameraState("loading-model");
      try {
        let landmarker;
        try {
          landmarker = await createLandmarker("GPU");
        } catch {
          landmarker = await createLandmarker("CPU");
        }
        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;
        setCameraState("ready");
      } catch {
        if (!cancelled) setCameraState("model-error");
      }
    }

    setup();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stopCamera();
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey, started]);

  // ---- detection loop ----
  useEffect(() => {
    if (cameraState !== "ready") return;

    function tick() {
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      if (!video || !landmarker || completedRef.current || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const result = landmarker.detectForVideo(video, performance.now());
      const landmarks = result.faceLandmarks?.[0];

      if (landmarks) {
        const nose = landmarks[NOSE_TIP];
        const leftCheek = landmarks[LEFT_CHEEK];
        const rightCheek = landmarks[RIGHT_CHEEK];
        const forehead = landmarks[FOREHEAD];
        const chin = landmarks[CHIN];

        const centerX = (leftCheek.x + rightCheek.x) / 2;
        const centerY = (forehead.y + chin.y) / 2;
        const halfWidth = Math.abs(rightCheek.x - leftCheek.x) / 2 || 0.001;
        const halfHeight = Math.abs(chin.y - forehead.y) / 2 || 0.001;

        const yaw = (nose.x - centerX) / halfWidth;
        const pitch = (nose.y - centerY) / halfHeight;
        const magnitude = Math.sqrt(yaw * yaw + pitch * pitch);

        if (magnitude >= MIN_MAGNITUDE) {
          let angleDeg = (Math.atan2(pitch, yaw) * 180) / Math.PI;
          angleDeg = (angleDeg + 360) % 360;
          const bucketIndex = Math.round(angleDeg / 45) % NUM_ANGLES;
          const bucketCenter = bucketIndex * 45;
          let angularDistance = Math.abs(angleDeg - bucketCenter);
          if (angularDistance > 180) angularDistance = 360 - angularDistance;

          if (angularDistance <= BUCKET_TOLERANCE_DEG) {
            if (bucketStreakRef.current.index === bucketIndex) {
              bucketStreakRef.current.count += 1;
            } else {
              bucketStreakRef.current = { index: bucketIndex, count: 1 };
            }

            if (
              bucketStreakRef.current.count >= STABILITY_FRAMES &&
              !capturedBlobsRef.current[bucketIndex]
            ) {
              captureFrame(bucketIndex);
            }
          } else {
            bucketStreakRef.current = { index: -1, count: 0 };
          }
        } else {
          bucketStreakRef.current = { index: -1, count: 0 };
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [cameraState, captureFrame]);

  const capturedCount = capturedMask.filter(Boolean).length;
  const processing = allCaptured || submitting;

  // The liveness circle only ever renders below this point - before the user
  // has opted in (or on a browser that cannot support it at all), they see
  // this screen instead, never the camera frame.
  if (cameraState === "prompt" || cameraState === "unsupported") {
    return (
      <div className="flex flex-col items-center gap-5 px-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-brand-red bg-neutral-900">
          <CameraIcon className="h-9 w-9 text-brand-red" />
        </div>

        {cameraState === "prompt" ? (
          <>
            <div className="max-w-sm">
              <p className="text-lg font-medium text-white">FOFO needs camera access to enroll your face</p>
              <p className="mt-2 text-sm text-neutral-400">
                We capture a few angles of your face to build your protection profile. Nothing is shared
                publicly, and the camera turns off as soon as enrollment finishes.
              </p>
            </div>
            <button
              onClick={() => setStarted(true)}
              className="rounded-md bg-brand-red px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-red-bright"
            >
              Enable Camera
            </button>
          </>
        ) : (
          <p className="max-w-sm text-sm text-red-400">
            Your browser doesn&apos;t support camera access. Please try Chrome, Safari, or Edge.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[280px] w-[280px] sm:h-[340px] sm:w-[340px]">
        {/* progress dots around the circle */}
        {Array.from({ length: NUM_ANGLES }).map((_, i) => {
          const angleRad = ((i * 45 - 90) * Math.PI) / 180;
          const radius = 50; // percent, positions dots just outside the circular frame
          const x = 50 + radius * Math.cos(angleRad);
          const y = 50 + radius * Math.sin(angleRad);
          const isDone = capturedMask[i];
          return (
            <div
              key={i}
              className={`absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-all duration-300 ease-out ${
                isDone
                  ? "scale-110 border-emerald-500 bg-emerald-500"
                  : "border-neutral-600 bg-neutral-900"
              }`}
              style={{ left: `${x}%`, top: `${y}%` }}
            />
          );
        })}

        {/* circular camera frame */}
        <div
          className={`absolute inset-[18px] overflow-hidden rounded-full border-2 bg-neutral-900 transition-colors duration-300 ${
            processing ? "border-emerald-500" : "border-brand-red"
          }`}
        >
          <video
            ref={videoRef}
            muted
            playsInline
            autoPlay
            className="h-full w-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />

          {cameraState !== "ready" && !processing && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/90 px-6 text-center">
              {cameraState === "requesting" && (
                <p className="text-sm text-neutral-400">Requesting camera access…</p>
              )}
              {cameraState === "loading-model" && (
                <p className="text-sm text-neutral-400">Loading face detection…</p>
              )}
            </div>
          )}

          {processing && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/90">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500/40 border-t-emerald-500" />
            </div>
          )}
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <div className="mt-8 text-center">
        {cameraState === "denied" && (
          <div className="max-w-sm space-y-4 text-left">
            <div className="text-center">
              <p className="text-sm font-medium text-red-400">Camera access is blocked</p>
              <p className="mt-1 text-sm text-neutral-400">
                FOFO needs your camera to verify your face. Enable it in your browser settings below, then
                try again.
              </p>
            </div>

            <div className="rounded-md border border-neutral-800 bg-neutral-900/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Chrome</p>
              <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-xs text-neutral-400">
                <li>Tap the lock or camera icon at the left of the address bar</li>
                <li>Tap &quot;Permissions&quot; (or &quot;Site settings&quot;) and set Camera to &quot;Allow&quot;</li>
                <li>Reload this page</li>
              </ol>
            </div>

            <div className="rounded-md border border-neutral-800 bg-neutral-900/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Safari</p>
              <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-xs text-neutral-400">
                <li>iPhone/iPad: open the Settings app → Safari → Camera → Allow</li>
                <li>Mac: Safari menu → Settings → Websites → Camera → allow this site</li>
                <li>Reload this page</li>
              </ol>
            </div>

            <div className="flex justify-center">
              <Retry onRetry={() => setRetryKey((k) => k + 1)} />
            </div>
          </div>
        )}

        {cameraState === "no-camera" && (
          <div className="max-w-sm space-y-2">
            <p className="text-sm font-medium text-red-400">No camera found</p>
            <p className="text-sm text-neutral-400">
              We couldn&apos;t detect a camera on this device. Try a device with a front-facing
              camera, or check that it isn&apos;t being used by another app.
            </p>
            <Retry onRetry={() => setRetryKey((k) => k + 1)} />
          </div>
        )}

        {cameraState === "model-error" && (
          <div className="max-w-sm space-y-2">
            <p className="text-sm font-medium text-red-400">Could not load face detection</p>
            <p className="text-sm text-neutral-400">
              Check your connection and try again.
            </p>
            <Retry onRetry={() => setRetryKey((k) => k + 1)} />
          </div>
        )}

        {processing && (
          <p className="text-lg font-medium text-emerald-400">Perfect. Processing…</p>
        )}

        {cameraState === "ready" && !processing && (
          <>
            <p className="text-base text-white">Slowly move your face in a circle</p>
            <p className="mt-1 text-sm text-neutral-500">{capturedCount}/{NUM_ANGLES} angles captured</p>
          </>
        )}
      </div>
    </div>
  );
}

function Retry({ onRetry }: { onRetry: () => void }) {
  return (
    <button
      onClick={onRetry}
      className="mt-2 rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white"
    >
      Try Again
    </button>
  );
}

function CameraIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 8.5a2 2 0 0 1 2-2h2l1.2-1.8A2 2 0 0 1 9.9 4h4.2a2 2 0 0 1 1.7.9L17 6.5h2a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8.5Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
