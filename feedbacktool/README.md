# Feedback Tool

Cloudflare Worker + React app for loading and exploring mock customer feedback in D1.

## Commands

```sh
npm install
npm run db:migrate:local
npm run dev
```

For remote Cloudflare D1:

```sh
npm run db:migrate:remote
npm run deploy
```

## Mock datasets

The app ships with three staged datasets in `public/data/`:

- `seed.json`: baseline multi-product feedback
- `stream.json`: a recent spike across WAF, Zero Trust, and Analytics
- `followup.json`: escalation and recovery signals that extend the story

Use the UI buttons to ingest each dataset, or ingest everything at once from the CLI:

```sh
npm run ingest:all
```

To ingest into the deployed Worker so records land in remote D1:

```sh
node ./scripts/ingest-mock-data.mjs --dataset all --url https://<your-worker>.workers.dev
```

## API

- `GET /api/health`
- `POST /api/ingest`
- `GET /api/items`
