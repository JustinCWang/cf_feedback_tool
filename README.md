# Cloudflare Feedback Tool

This repository contains a Cloudflare-based product feedback analysis prototype. The main application lives in `feedbacktool/` and combines a Worker API, a React dashboard, D1 storage, Workers AI, and Vectorize.

At a high level, the project is designed to:

- collect feedback from multiple sources into one inbox
- enrich feedback with AI-generated sentiment, urgency, and theme labels
- index and search feedback semantically
- group related issues into higher-level themes
- generate digest-style summaries for PM review

## Main App

The deployable app is in `feedbacktool/`.

That project contains:

- the Cloudflare Worker API
- the React dashboard
- D1 migrations
- mock datasets and ingest scripts
- Wrangler configuration for D1, Workers AI, and Vectorize

For implementation details, setup steps, and the full command list, see `feedbacktool/README.md`.

## Core Platform Pieces

The app uses:

- Cloudflare Workers for the API
- Cloudflare D1 for canonical feedback storage
- Cloudflare Workers AI for classification, embeddings, and digest generation
- Cloudflare Vectorize for semantic search and theme clustering
- React + Vite for the dashboard UI

## Current Capabilities

The current prototype supports:

- staged mock feedback ingestion
- D1-backed overview, inbox, trends, themes, and digests pages
- AI classification for sentiment and urgency
- AI theme family and theme label generation
- embedding feedback into Vectorize
- semantic search over indexed issues
- clustering related feedback into persisted themes
- generating PM-oriented digests from recent analyzed feedback

## Quick Start

From `feedbacktool/`:

```sh
npm install
npm run db:migrate:local
npm run dev
```

Useful follow-up commands:

```sh
npm run build
npm run deploy
npm run ingest:all
```

## Notes

- The mock datasets live under `feedbacktool/public/data/`.
- The D1 schema lives under `feedbacktool/migrations/`.
- The outer repository is mainly a container for the app and supporting project docs.
