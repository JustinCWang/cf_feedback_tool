# cf_feedback_tool

Cloudflare PM intern assignment.

## D1 setup

The Worker app in `feedbacktool/` is now configured with a D1 binding named `DB` and a shared initial schema copied from `../feedbacktool`.

From `cf_feedback_tool/feedbacktool`, use:

```sh
npm run db:migrate:local
npm run db:migrate:remote
npm run cf-typegen
npm run deploy
```

## Mock data ingest

The app now includes three mock datasets:

- `public/data/seed.json`
- `public/data/stream.json`
- `public/data/followup.json`

You can ingest all of them from the UI with the `Load full story` button, or from the command line.

Local dev:

```sh
npm run ingest:all
```

Remote deployed Worker:

```sh
node ./scripts/ingest-mock-data.mjs --dataset all --url https://<your-worker>.workers.dev
```

If you need to create a brand new D1 database instead of using the existing shared one, run:

```sh
npm run db:create
```
