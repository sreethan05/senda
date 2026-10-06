# Supabase history index setup

The app uses Supabase only to index transfer metadata. It never stores a link key, phone number, or funds. Without these settings the app still works; history falls back to chain reads.

1. In your Supabase project, run [`202610060001_claims.sql`](../supabase/migrations/202610060001_claims.sql) in the SQL editor.
2. Add these server-only variables to `.env.local` and the deployment environment:

```dotenv
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
```

The legacy `SUPABASE_SERVICE_ROLE_KEY` remains supported, but a new `sb_secret_` key is preferred. Never add either key to a `NEXT_PUBLIC_` variable.

For direct event-based history without Supabase, also set `NEXT_PUBLIC_ESCROW_DEPLOYMENT_BLOCK` to the block where the configured escrow was deployed. Leave it unset when using the Supabase history index.

The API validates the sender's typed signature and checks the referenced deposit against the configured escrow before writing. Terminal statuses are updated only after a successful escrow transaction receipt is verified. History is queried by sender and paged 50 rows at a time.

Older transfers created before the index was configured will not be backfilled automatically. They remain on-chain; use chain history with Supabase disabled for those records or run a future one-time indexer/backfill.
