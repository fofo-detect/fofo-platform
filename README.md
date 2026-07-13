# FOFO — Face Identity Protection Platform

Subscribers enroll 3 face photos. FOFO indexes the face (AWS Rekognition), runs scheduled
scans across the internet via SerpAPI Google Lens, scores matches for deepfake probability
(Sightengine), classifies risk with Claude, and sends WhatsApp alerts (MSG91) for HIGH/CRITICAL
detections. Billing is handled by Stripe.

## Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (Python 3.11) |
| Frontend | Next.js (App Router, TypeScript, Tailwind) |
| Database / Auth | Supabase (Postgres + Auth) |
| Face search | SerpAPI Google Lens |
| Face matching | AWS Rekognition (`index_faces` + `compare_faces`) |
| Deepfake scoring | Sightengine |
| Risk classification | Claude API (`claude-sonnet-4-6`) |
| Alerts | MSG91 WhatsApp API |
| Payments | Stripe Subscriptions |
| Backend hosting | Railway (Docker) |
| Frontend hosting | Vercel |

## Repo layout

```
/backend    FastAPI app (routers, services, models)
/frontend   Next.js app (App Router)
/supabase   SQL migrations
```

---

## 1. Supabase setup

1. Open your Supabase project (`https://hornmcxgscsjbwpdyosv.supabase.co`) → SQL Editor.
2. Run `supabase/migrations/001_init.sql`. This creates `subscribers`, `scans`, and
   `detections`, with indexes and RLS policies scoping each subscriber to their own rows.
3. Go to **Authentication → Providers** and make sure Email sign-up is enabled.
   - If "Confirm email" is ON, users won't get a session until they click the confirmation
     link, and `/auth/signup` returns `email_confirmation_required: true`. For a frictionless
     paid-signup flow, most teams turn this OFF and rely on Stripe payment as the real gate.
4. Note your **Project URL**, **publishable (anon) key**, and **secret (service_role) key** —
   already filled into `backend/.env` and `frontend/.env.local` for you.

## 2. Backend — local run

```bash
cd backend
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # already pre-filled with Supabase/SerpAPI/Anthropic keys — fill in the rest
uvicorn main:app --reload --port 8000
```

Visit `http://localhost:8000/health` to confirm it's up.

### Required third-party accounts (fill into `backend/.env`)

- **SerpAPI** — already set (`SERPAPI_KEY`). Used for Google Lens reverse-image search.
- **Anthropic** — already set (`ANTHROPIC_API_KEY`). Used for risk classification.
- **AWS** — one IAM user covers both S3 and Rekognition. Create a bucket (public-read on the
  objects FOFO writes) — FOFO uploads one enrollment photo per subscriber there so SerpAPI has
  a public URL to search against, and it also doubles as the Rekognition `CompareFaces` source
  image. The IAM user's policy needs `s3:PutObject` / `s3:PutObjectAcl` on that bucket, plus
  `rekognition:CreateCollection`, `rekognition:IndexFaces`, `rekognition:CompareFaces`. Fill
  `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET`,
  `AWS_REKOGNITION_COLLECTION_ID` (the collection is created automatically on first enrollment
  if it doesn't exist yet).
- **Sightengine** — sign up at sightengine.com, create an app, copy the API user/secret into
  `SIGHTENGINE_API_USER` / `SIGHTENGINE_API_SECRET`.
- **MSG91** — enable WhatsApp on your MSG91 account, create an approved message template,
  and fill `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`, `MSG91_INTEGRATED_NUMBER` (your WhatsApp
  Business sender number as registered with MSG91).
- **Stripe** — create two recurring Prices under one Product ("FOFO Protection"): a monthly
  price at ₹50,000 and a yearly price at ₹500,000. Fill `STRIPE_SECRET_KEY`,
  `STRIPE_MONTHLY_PRICE_ID`, `STRIPE_ANNUAL_PRICE_ID`. `STRIPE_WEBHOOK_SECRET` comes from
  step 4 below.

The app fails fast on startup (Pydantic settings validation) if any required key is missing —
that's intentional so a misconfigured deploy never silently serves broken endpoints.

## 3. Backend — deploy to Railway

1. Push this repo to GitHub.
2. In Railway: **New Project → Deploy from GitHub repo**, select this repo, and set the
   **root directory** to `/backend` (Railway will detect the `Dockerfile` and build it — the
   image has no ML runtime in it, just the FastAPI stack + boto3/Pillow, so it builds in well
   under a minute and needs minimal build memory).
3. Add every variable from `backend/.env.example` under **Variables**. Set `CORS_ORIGINS` to
   your Vercel frontend URL (e.g. `https://fofo.vercel.app`) and `FRONTEND_URL` to the same,
   so Stripe Checkout redirects land back on your real domain.
4. Once deployed, copy the Railway public URL (e.g. `https://fofo-backend.up.railway.app`).
5. In Stripe Dashboard → **Developers → Webhooks**, add an endpoint pointing to
   `https://<your-railway-domain>/stripe/webhook`, subscribed to:
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
   Copy the generated signing secret into Railway's `STRIPE_WEBHOOK_SECRET`.

## 4. Frontend — local run

```bash
cd frontend
npm install
cp .env.example .env.local   # already pre-filled with Supabase URL/key — set the rest
npm run dev
```

Visit `http://localhost:3000`.

## 5. Frontend — deploy to Vercel

1. **New Project** in Vercel, import this repo, set **root directory** to `/frontend`
   (Next.js is auto-detected — no config changes needed).
2. Add environment variables from `frontend/.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — from Supabase.
   - `NEXT_PUBLIC_API_URL` — your Railway backend URL from step 3.4.
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — from Stripe (used if you later add Stripe.js
     elements client-side; the current checkout flow redirects to Stripe-hosted Checkout so
     this key isn't strictly required yet, but is wired up for future use).
3. Deploy. Once live, go back to Railway and update `CORS_ORIGINS` / `FRONTEND_URL` to the
   real `https://<your-app>.vercel.app` domain, then redeploy the backend.

## User flow

`/` → `/register` (Supabase Auth signup) → `/onboard` (upload 3 photos → `POST /enroll`, each
indexed into an AWS Rekognition collection via `index_faces`, one photo mirrored to S3 as the
SerpAPI search seed and Rekognition comparison source) → `/subscribe` (Stripe Checkout for
₹50,000/mo or ₹500,000/yr) → `/dashboard` (detections table + "Run Scan Now", which calls
`POST /scan/{subscriber_id}`).

## Scan pipeline (`POST /scan/{subscriber_id}`)

1. Load the subscriber's reference image URL from Supabase and download those bytes once.
2. Query SerpAPI Google Lens with the reference image, take up to 59 visual matches.
3. For each candidate: download the image, call AWS Rekognition `CompareFaces` against the
   reference photo bytes (similarity threshold 80% for thumbnail-sized images, 90% for
   full-size — higher similarity required for the higher-quality images).
4. For each match: score deepfake probability via Sightengine.
5. Classify risk (LOW/MEDIUM/HIGH/CRITICAL) and generate an alert message via Claude.
6. Insert a `detections` row. If risk is HIGH or CRITICAL, send a WhatsApp alert via MSG91.
7. Mark the `scans` row completed with candidate/match counts.

Note: the `distance_score` column/field name in the DB and API predates the Rekognition switch
and is kept as-is to avoid a schema migration — it now holds a 0-100 similarity percentage
(higher = more similar), not a distance.

## Notes on scale

The scan endpoint runs synchronously (download + Rekognition + Sightengine + Claude per
candidate, up to 59 candidates). This is simple and correct for an initial launch; if scan
latency becomes a problem under load, move `run_scan` into a background worker (e.g. a Railway
cron service or a queue) and have the dashboard poll `GET /detections/{subscriber_id}` instead
of waiting on the POST.

## Security notes

- Real secrets live only in `backend/.env` / `frontend/.env.local`, both git-ignored. Only
  `*.env.example` files (no real values) are meant to be committed.
- The Supabase **secret key** is backend-only and bypasses Row Level Security — never ship it
  to the frontend. The frontend only ever holds the **publishable** key.
- Because the real API keys for this project were shared in this chat session, treat them as
  provisional: rotate the Supabase service-role key, SerpAPI key, and Anthropic key from their
  respective dashboards before going live with real paying customers.
