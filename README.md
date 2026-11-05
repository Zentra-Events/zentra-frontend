This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Local backend (BACKEND_URL)

This app proxies requests to a backend service through the server-side API routes in `src/app/api/*`.

Set the backend base URL with the `BACKEND_URL` environment variable. For local development, create a `.env.local` file in the project root and add:

```
BACKEND_URL=http://localhost:8080
```

Adjust the port or host to match your backend. If the backend is not running or the address is unreachable, the API route will return a 502 (connection refused) or 504 (timeout) with a short diagnostic message.

## Updating the User Manual

The user manual at `docs/USER_MANUAL.md` is kept in sync with code changes using a git baseline. This avoids re-reading the entire codebase each time.

### Setup (one time)

1. Create the baseline file at the current HEAD:
   ```bash
   git rev-parse HEAD > .manual-baseline
   ```

### Update cycle (whenever code changes)

1. See what changed since the last manual sync:
   ```bash
   bash scripts/sync-manual.sh
   ```
   This lists every file under `src/` touched since the baseline, plus commit summaries.

2. Read only the listed files (not the whole codebase) and update `docs/USER_MANUAL.md` for any new or changed features.

3. Advance the baseline so the next sync only surfaces new commits:
   ```bash
   git rev-parse HEAD > .manual-baseline
   ```

### Files involved

- `scripts/sync-manual.sh` — diffs `src/` against `.manual-baseline` and prints changed files + commits.
- `.manual-baseline` — stores the commit hash the manual was last synced to (can be gitignored if preferred).
- `docs/USER_MANUAL.md` — the application user guide.
