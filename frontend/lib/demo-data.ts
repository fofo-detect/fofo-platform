import { Detection, RiskLevel, ScanResponse } from "@/lib/api";

// Purely client-generated (called from a useEffect, never at module scope or
// during SSR) so Math.random()/new Date() here can never cause a hydration
// mismatch - the initial server-rendered HTML has no demo data in it at all.

interface PlatformSpec {
  platform: string;
  buildUrl: (i: number) => string;
}

const PLATFORM_SPECS: PlatformSpec[] = [
  { platform: "YouTube", buildUrl: (i) => `https://www.youtube.com/watch?v=demo${i}xK9pQ2` },
  { platform: "instagram.com", buildUrl: (i) => `https://www.instagram.com/p/Cdemo${i}xyz/` },
  { platform: "facebook.com", buildUrl: (i) => `https://www.facebook.com/watch/?v=987654${i}21` },
  { platform: "twitter.com", buildUrl: (i) => `https://twitter.com/newsdesk/status/17${i}98765432` },
  { platform: "bbc.com", buildUrl: (i) => `https://www.bbc.com/news/articles/c${i}demo9x` },
  { platform: "cnn.com", buildUrl: (i) => `https://www.cnn.com/2026/07/${(i % 28) + 1}/world/demo-story-${i}` },
  {
    platform: "timesofindia.indiatimes.com",
    buildUrl: (i) => `https://timesofindia.indiatimes.com/entertainment/demo-article-${i}.cms`,
  },
  { platform: "ndtv.com", buildUrl: (i) => `https://www.ndtv.com/entertainment/demo-story-${i}` },
];

const SCORE_RANGES: Record<RiskLevel, { deepfake: [number, number]; match: [number, number] }> = {
  LOW: { deepfake: [0.1, 0.3], match: [78, 88] },
  MEDIUM: { deepfake: [0.4, 0.6], match: [84, 91] },
  HIGH: { deepfake: [0.7, 0.85], match: [89, 95] },
  CRITICAL: { deepfake: [0.9, 0.99], match: [94, 99] },
};

const RISK_PLAN: RiskLevel[] = [
  ...Array<RiskLevel>(20).fill("LOW"),
  ...Array<RiskLevel>(6).fill("MEDIUM"),
  ...Array<RiskLevel>(6).fill("HIGH"),
  ...Array<RiskLevel>(2).fill("CRITICAL"),
];

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomInRange(min, max + 1));
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildAlertMessage(level: RiskLevel, platform: string, deepfakeScore: number): string {
  const pct = Math.round(deepfakeScore * 100);
  switch (level) {
    case "CRITICAL":
      return `High-confidence face match on ${platform} with a ${pct}% deepfake probability score — this appears to be synthetically generated content using your likeness. Immediate review recommended.`;
    case "HIGH":
      return `Strong face match detected on ${platform}. Deepfake analysis returned a ${pct}% probability, indicating likely manipulated content.`;
    case "MEDIUM":
      return `A moderate-confidence face match was found on ${platform}. Deepfake indicators are inconclusive (${pct}%) — manual review suggested.`;
    default:
      return `A low-confidence match was found on ${platform} with minimal deepfake indicators (${pct}%), most likely a benign appearance or visual lookalike.`;
  }
}

function buildDetections(now: Date): Detection[] {
  const levels = shuffle(RISK_PLAN);

  const detections = levels.map((level, i) => {
    const spec = PLATFORM_SPECS[i % PLATFORM_SPECS.length];
    const { deepfake, match } = SCORE_RANGES[level];
    const deepfakeScore = Number(randomInRange(deepfake[0], deepfake[1]).toFixed(2));
    const distanceScore = Number(randomInRange(match[0], match[1]).toFixed(1));
    const daysAgo = randomInt(0, 6);
    const millisAgo = daysAgo * 86_400_000 + randomInt(0, 23) * 3_600_000 + randomInt(0, 59) * 60_000;
    const createdAt = new Date(now.getTime() - millisAgo).toISOString();

    const searchSources = ["google_lens", "bing", "yandex"];
    const source = spec.platform === "YouTube" ? "youtube" : searchSources[i % searchSources.length];

    const detection: Detection = {
      id: `demo-detection-${i + 1}`,
      subscriber_id: "demo-subscriber",
      scan_id: `demo-scan-${(i % 5) + 1}`,
      image_url: `https://i.pravatar.cc/150?img=${(i % 70) + 1}`,
      source_url: spec.buildUrl(i + 1),
      platform: spec.platform,
      source,
      distance_score: distanceScore,
      deepfake_score: deepfakeScore,
      risk_level: level,
      alert_message: buildAlertMessage(level, spec.platform, deepfakeScore),
      alerted_at: level === "HIGH" || level === "CRITICAL" ? createdAt : null,
      created_at: createdAt,
      reported: false,
      reported_at: null,
    };
    return detection;
  });

  return detections.sort(
    (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
  );
}

function buildScans(now: Date): ScanResponse[] {
  // Sums to 34 to line up with the detections total.
  const matchCounts = [5, 7, 6, 9, 7];
  const candidateCounts = [212, 248, 196, 261, 229];

  const scans = matchCounts.map((matches, i) => {
    const daysAgo = matchCounts.length - 1 - i;
    const startedAt = new Date(now.getTime() - daysAgo * 86_400_000 - randomInt(1, 6) * 3_600_000);
    const durationMinutes = randomInt(3, 9);
    const completedAt = new Date(startedAt.getTime() + durationMinutes * 60_000);

    const scan: ScanResponse = {
      scan_id: `demo-scan-${i + 1}`,
      subscriber_id: "demo-subscriber",
      status: "completed",
      candidates_found: candidateCounts[i],
      matches_found: matches,
      started_at: startedAt.toISOString(),
      completed_at: completedAt.toISOString(),
    };
    return scan;
  });

  return scans.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
}

export interface DemoData {
  subscriberName: string;
  detections: Detection[];
  scans: ScanResponse[];
  totalDetections: number;
  highRiskAlerts: number;
}

export function generateDemoData(): DemoData {
  const now = new Date();
  return {
    subscriberName: "Demo Account",
    detections: buildDetections(now),
    scans: buildScans(now),
    totalDetections: 34,
    highRiskAlerts: 6,
  };
}
