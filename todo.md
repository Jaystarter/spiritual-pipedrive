# S-Drive multi-region production build — execution ledger

Goal: this repo is the larger-scale production version of S-Drive. First open asks
"which region are you from" (pick an option or type a new one), then "who are you"
(the existing profile picker, scoped to that region). Every contact belongs to a
region, so many locations can preach and log contacts without stepping on each
other, and ownership of each contact stays clear.

## Replication
- [x] Copy spiritual-pipedrive (full working-tree state) into a fresh git repo at ~/Projects/s-drive
- [x] npm install

## Data layer
- [x] Migration: `regions` table + nullable `region_id` on `profiles` and `people` (teacher names now unique per region, not globally)
- [x] Hand-update `src/lib/supabase/database.types.ts` (maintained by hand per project rules)

## Region identity (client)
- [x] `src/lib/region-client.ts` — cookie-backed store (`sd-region`) with the same useSyncExternalStore contract as the localStorage modules, so the server can scope queries
- [x] Read the cookie in `src/app/page.tsx` and pass the region to `listPeople`

## Server actions
- [x] `listPeople(regionId)` scopes people and profiles to the region; returns `regions` on BoardState; with no region it returns only the region list for the gate
- [x] `createRegion(name)` — duplicate names join the existing region instead of erroring
- [x] `createProfile` stamps `region_id`; `createPerson` derives the region from the actor's profile server-side

## Onboarding flow
- [x] Full-screen region gate before the board (pick a region or found a new one); the existing required profile picker becomes step two automatically
- [x] Choosing a region sets the cookie and hard-reloads so board state re-initializes from scoped data
- [x] "Switch region…" in the masthead profile dropdown (clears the cookie; a foreign profile id self-heals because it can't resolve against the scoped list)

## Verification
- [x] `npx tsc --noEmit` (clean), `npm run lint` (clean), `npm run build` (passes), `scripts/check-legacy-classes.sh` (clean)
- [x] Browser walkthrough with a temporary stub (no Supabase project exists yet): gate → pick Cambridge → forced "who are you" with scoped workers → board with region in the folio line; switch region → back to gate; empty region → "Add a worker" flow; mobile viewport checked. Stub removed afterward.
- [ ] Live end-to-end against a real database — blocked until a Supabase project exists for this app (see below)

## Deferred (needs Jayden)
- [ ] Create GitHub repo + Vercel project + production Supabase project (external/publishing actions)
- [ ] After the Supabase project exists: `supabase link` + `supabase db push` (all migrations, including regions), set `SUPABASE_URL`/`SUPABASE_SECRET_KEY`, generate fresh VAPID keys and `CRON_SECRET` (see `.env.example`) — do not reuse the old app's secrets or database
- [ ] Then rerun the live onboarding walkthrough against the real database
