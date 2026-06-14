# DrawLess — production app (starter)

The daily-puzzle version of DrawLess: Next.js + Supabase, magic-link auth,
server-verified scoring, leaderboard, and streaks.

> **What this is:** a complete, correct *starter repo*. Every file is written and
> wired, but it has not been run end-to-end — you finish the setup on your machine
> (install deps, create the Supabase project, paste keys, seed puzzles). Budget an
> evening for first boot.

## The big idea (why it's built this way)
- **The server is the referee.** The browser submits only the raw line points.
  `/api/solve` re-simulates them with the SAME physics (`src/lib/validator.js`) and
  measures ink itself. The client's claimed score is never trusted. That's the
  anti-cheat, and it's the same validator that verified all your puzzles.
- **First solve is final.** A unique DB constraint enforces it.
- **Ghosts never leak the answer.** Today's puzzle ships to the client WITHOUT its
  ghost solutions; ghosts come from `/api/leaderboard` only after you've solved.

## Setup (one time)

> After the main schema, also run `supabase/migration-usernames.sql` to enable unique usernames.
1. **Install:** `npm install`
2. **Create a Supabase project** at supabase.com (free tier is fine).
3. **Run the schema:** open `supabase/schema.sql`, paste it into the Supabase SQL
   editor, run it. This creates tables, RLS policies, the leaderboard view, and the
   signup trigger.
4. **Configure email auth:** in Supabase > Authentication > Providers, ensure Email
   (magic link) is enabled. Add your site URL to the redirect allow-list.
5. **Env:** copy `.env.local.example` to `.env.local` and fill in the three Supabase
   values + your site URL.
6. **Seed puzzles:** `npm run seed` — loads `data/puzzles.json` (your 139 verified
   puzzles) and schedules one per day starting tomorrow (UTC).
7. **Run:** `npm run dev` → http://localhost:3000

## Deploy
- Push to GitHub, import into **Vercel**, add the same env vars in Vercel's settings.
- Set `NEXT_PUBLIC_SITE_URL` to your real URL (or your free `*.vercel.app`).
- No custom domain required — a `*.vercel.app` URL works for launch.

## Project map
- `src/app/page.tsx` ............ home: loads today's puzzle + session
- `src/components/GameClient.tsx` the playable canvas (server-matched physics)
- `src/components/AuthGate.tsx` .. magic-link sign-in
- `src/app/api/solve/route.ts` ... **the anti-cheat core** — verify + record + streak
- `src/app/api/leaderboard/route.ts` ranked solutions + ghost lines
- `src/app/auth/callback/route.ts` magic-link session exchange
- `src/lib/validator.js` ......... the physics referee (rest-rule, identical to client)
- `src/lib/daily.ts` ............. fetch today's puzzle (ghosts stripped)
- `src/lib/supabase-*.ts` ........ DB clients (server admin vs browser anon)
- `supabase/schema.sql` ......... the database
- `scripts/seed-puzzles.mjs` ..... load + schedule the daily rotation
- `data/puzzles.json` ............ your 139 verified puzzles

## What's intentionally NOT done yet (your next steps)
- **Port the polished render** from the offline build into `GameClient.tsx`:
  per-tier backgrounds, the settle visuals, audio, ghost overlay + watch buttons,
  and the visual share card. The physics/rule logic here is authoritative; the
  presentation is deliberately minimal so you can drop the proven visuals in.
- **Gumroad premium gating** (archive, stats, hard mode) — your usual pattern.
- **Share-card → native share sheet** on mobile.
- **Curate the daily order** in `data/puzzles.json` (rename auto-named puzzles,
  set the Mon→Sun difficulty cadence, hand-craft a few brutal Sundays).
