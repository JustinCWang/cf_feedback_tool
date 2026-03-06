# Feedback Tool

Cloudflare-native feedback aggregation and analysis dashboard built with a Worker API, D1, Workers AI, Vectorize, and a Vite React frontend.

The app ingests staged mock feedback, classifies it with Workers AI, indexes it into Vectorize, clusters related issues into themes, enables semantic search, and generates PM-style digests for the dashboard.

## What It Does

- Aggregates feedback from multiple mock sources into a shared inbox.
- Stores canonical records in Cloudflare D1.
- Classifies feedback with Workers AI for:
  - `sentiment`: `positive | neutral | negative`
  - `urgency`: `low | medium | high`
  - `theme_family`
  - `theme_label`
- Applies deterministic urgency guardrails and can fall back to a stronger verifier model when confidence is low.
- Embeds analyzed feedback with Workers AI and stores vectors in Vectorize.
- Performs semantic search with optional AI-written summaries and citations.
- Clusters related feedback into persisted `themes` using Vectorize nearest-neighbor lookups.
- Generates stored PM digests from recent analyzed feedback and theme rollups.
- Presents the pipeline in a multi-page dashboard.

## Stack

- Worker API: Hono running in Cloudflare Workers
- Frontend: React + Vite + `react-router-dom`
- Database: Cloudflare D1
- AI: Cloudflare Workers AI
- Vector search: Cloudflare Vectorize

## Project Structure

```text
src/worker/              Worker API and analysis pipeline
src/react-app/           Routed dashboard UI
src/shared/              Shared TypeScript types
public/data/             Staged mock datasets
scripts/                 CLI helpers for ingest
migrations/              D1 schema
wrangler.json            Worker bindings and deploy config
```

## Cloudflare Bindings

The Worker is configured with:

- `DB`: D1 database binding
- `AI`: Workers AI binding
- `VECTORIZE`: Vectorize index binding

Current binding config lives in `wrangler.json`.

## Getting Started

Install dependencies:

```sh
npm install
```

Apply local D1 migrations:

```sh
npm run db:migrate:local
```

Start local development:

```sh
npm run dev
```

Build the app:

```sh
npm run build
```

Lint the codebase:

```sh
npm run lint
```

## D1 Setup

Create a D1 database and update `wrangler.json` automatically:

```sh
npm run db:create
```

Apply migrations locally:

```sh
npm run db:migrate:local
```

Apply migrations remotely:

```sh
npm run db:migrate:remote
```

List local migration state:

```sh
npm run db:migrate:list:local
```

Regenerate Worker binding types after binding changes:

```sh
npm run cf-typegen
```

## Vectorize Setup

Create the Vectorize index and update `wrangler.json`:

```sh
npm run vectorize:create
```

Inspect the index:

```sh
npm run vectorize:info
```

Create metadata indexes used by filtering and clustering:

```sh
npm run vectorize:metadata:source
npm run vectorize:metadata:product
npm run vectorize:metadata:tier
npm run vectorize:metadata:family
```

## Mock Datasets

The app ships with three staged datasets in `public/data/`:

- `seed.json`: baseline multi-product feedback
- `stream.json`: recent spike across WAF, Zero Trust, and Analytics
- `followup.json`: escalation and recovery signals that extend the storyline

Ingest from the CLI:

```sh
npm run ingest:seed
npm run ingest:stream
npm run ingest:followup
npm run ingest:all
```

To ingest into a deployed Worker so records land in remote D1:

```sh
node ./scripts/ingest-mock-data.mjs --dataset all --url https://<your-worker>.workers.dev
```

## Analysis Pipeline

The main workflow is:

1. Ingest feedback into `feedback_items`.
2. Run classification for sentiment, urgency, theme family, and theme label.
3. Embed analyzed feedback into Vectorize.
4. Cluster related embedded feedback into stored `themes`.
5. Search semantically across indexed feedback.
6. Generate PM digests from recent analyzed data.

### Classification

`POST /api/analyze` supports explicit analysis steps:

- `classify`
- `embed`
- `cluster`

Classification behavior:

- Targets items where `sentiment` or `urgency` is missing.
- Uses Workers AI structured output for:
  - `sentiment`
  - `urgency`
  - `theme_family`
  - `theme_label`
  - `confidence`
  - `rationale`
- Stores:
  - `sentiment`
  - `urgency`
  - `processed_at`
  - metadata such as `theme_family`, `theme_label`, `confidence`, `model`, `verifier_used`, and `rationale`
- Applies urgency guardrails for outage, blocker, security, and billing-style language.
- Falls back to a verifier model when confidence is low or outputs violate rules.

### Embedding

Embedding behavior:

- Targets items where `embedding_id` is null.
- Builds an embedding text from raw feedback plus analysis metadata.
- Generates embeddings with Workers AI.
- Upserts vectors into Vectorize.
- Writes `embedding_id` back to D1.

### Theme Clustering

Clustering behavior:

- Uses Vectorize `queryById()` KNN lookups on embedded feedback.
- Filters connections using similarity threshold plus product/theme-family compatibility.
- Groups related items with a connected-components style union-find pass.
- Persists `themes` in D1.
- Writes `theme_id` back to clustered feedback items.

### Semantic Search

Search behavior:

- Uses Vectorize semantic retrieval when available.
- Falls back to D1 text search if Vectorize is unavailable or yields no results.
- Can generate an AI summary over the matched issues with citations.

### Digests

Digest behavior:

- Generates short PM-style summaries from recent analyzed feedback.
- Pulls from recent themes, source mix, and representative feedback.
- Stores generated digests in D1.
- Includes a deterministic fallback summary if the AI generation step fails.

## Dashboard Pages

The frontend is a routed dashboard with:

- `Overview`: top-level metrics, source/product breakdowns, theme rollups, latest digest
- `Inbox`: paginated feedback inbox, filters, semantic search, AI badges
- `Trends`: D1-backed trend breakdowns and recent volume views
- `Ingest`: dataset loading and analysis actions with loading states
- `Themes`: persisted theme clusters from Vectorize-based grouping
- `Digests`: digest generation and digest history

The dashboard includes loading indicators for longer-running operations such as ingestion, classification, clustering, and digest generation.

## Data Model

Core stored entities:

- `feedback_items`: canonical feedback records and AI enrichment fields
- `themes`: persisted related-issue rollups
- `digests`: generated PM summaries

Important `feedback_items` fields include:

- `id`
- `source`
- `source_ref`
- `url`
- `author`
- `account_tier`
- `product_area`
- `created_at`
- `ingested_at`
- `location_region`
- `location_country`
- `location_colo`
- `text`
- `text_hash`
- `metadata_json`
- `sentiment`
- `urgency`
- `theme_id`
- `embedding_id`
- `processed_at`

Supported enums in `src/shared/types.ts` include:

- `FeedbackSource`: `support | github | discord | email | twitter | forum`
- `AccountTier`: `free | pro | business | enterprise`
- `ProductArea`: `workers | zero_trust | waf | dns | analytics | billing | dashboard | vectorize | d1`
- `Sentiment`: `positive | neutral | negative`
- `Urgency`: `low | medium | high`
- `Region`: `NA | EU | APAC | LATAM`

## API Surface

Implemented Worker routes:

- `GET /api`
- `GET /api/health`
- `GET /api/overview`
- `GET /api/trends`
- `POST /api/ingest`
- `POST /api/analyze`
- `GET /api/items`
- `GET /api/themes`
- `GET /api/search`
- `GET /api/digests`
- `POST /api/digest`

## Example Analyze Request

```json
{
  "scope": "unprocessed",
  "steps": {
    "classify": true,
    "embed": true,
    "cluster": false
  },
  "limits": {
    "max_items": 100
  }
}
```

## Deploy

Deploy the Worker:

```sh
npm run deploy
```

Useful validation command:

```sh
npm run check
```

## Current Status

The project is no longer just a mock inbox shell. It now includes:

- D1-backed ingestion and dashboard rollups
- Workers AI classification with verifier fallback
- Vectorize indexing and semantic search
- Theme clustering and theme dashboard
- Digest generation and digest history
- Improved pagination, loading states, and analysis-oriented UI badges
