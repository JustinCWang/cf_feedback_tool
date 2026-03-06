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

If you need to create a brand new D1 database instead of using the existing shared one, run:

```sh
npm run db:create
```
