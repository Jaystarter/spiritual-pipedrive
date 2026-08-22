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
- [x] Live end-to-end against a real database — local `supabase start` stack (Docker), full migration chain applied from scratch via `db reset`, then in-browser: created Cambridge, added worker Jayden, added contact Daniel Kim; DB rows confirmed region-stamped. Stale-region-cookie fallback to the gate also verified.
- [x] Live run caught two real deploy bugs, both fixed: (1) new Supabase projects apply least-privilege defaults, so service_role had no data access — added a grants migration; (2) the legacy seeded 'Team' profile conjured a phantom "Original Board" region on fresh databases — the regions migration now prunes it when provably untouched
- [ ] Repeat the same walkthrough once against the real production Supabase project after it exists

## Codex review round (independent second opinion)
- [x] Fix: cron follow-up digest silently died once listPeople required a region — it now loads all regions explicitly (`listPeople(null, { allRegions: true })`)
- [x] Fix: migration now sweeps any pre-region rows into an "Original Board" region instead of orphaning them (no-op on a fresh database)
- [x] Fix: new profiles stamp the region of the board on screen (prop from the board root), not the live cookie, so a region switch in another tab can't mislabel them
- [ ] Follow-up hardening (accepted, deferred): mutations don't verify the actor and target person share a region. The app has no auth at all (client-supplied actor ids, service-role client), so this is part of the larger trust-model question that real scale will eventually force — worth a dedicated pass, not a bolt-on

## Deferred (needs Jayden)
- [ ] Create GitHub repo + Vercel project + production Supabase project (external/publishing actions)
- [ ] After the Supabase project exists: `supabase link` + `supabase db push` (all migrations, including regions), set `SUPABASE_URL`/`SUPABASE_SECRET_KEY`, generate fresh VAPID keys and `CRON_SECRET` (see `.env.example`) — do not reuse the old app's secrets or database
- [ ] Then rerun the live onboarding walkthrough against the real database
