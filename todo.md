# Region upgrade for the existing S-Drive — execution ledger

Direction change: instead of shipping a separate production app, the existing
S-Drive gets upgraded in place on the `region-locations` branch. Locations are
fixed — Virginia Beach, Brooklyn, Bronx, Poland. Poland is home base and the
hub: its board sees every location's contacts plus its own exclusive ones.
Anyone picking a non-Poland location gets a guided tutorial into their first
contact. Existing production data lands in Poland.

## Porting
- [x] Branch `region-locations` in a worktree; main's uncommitted working tree untouched
- [x] Snapshot the in-flight acknowledge work onto the branch (it's how the app runs today)
- [x] Port the three region commits from the s-drive lab repo (onboarding gate, review fixes, grants + dev-env fixes)

## Locations & hub
- [x] Migration: seed the four locations; `regions.is_hub` with Poland as hub; legacy backfill now sweeps pre-region people/profiles into Poland (replaces "Original Board")
- [x] `listPeople`: a hub region loads all people and all workers; others stay strictly scoped
- [x] Hub board shows each contact's origin region in the card's registrar line
- [x] `database.types.ts` updated by hand (is_hub)

## First-contact tutorial (non-hub locations)
- [x] `first-contact-tour.tsx`: welcome → guided quick-add → "you're done" explainer; skippable at every step; auto-advances when the first contact lands; never shown to workers who already have contacts; completion per profile in localStorage

## Verification
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build`, grep gate
- [ ] Live walkthrough on the local Supabase stack (db reset with the new chain): four locations on the gate, Brooklyn first-contact tutorial end-to-end, Poland hub sees Brooklyn's contact with origin label plus its own exclusives, legacy backfill lands in Poland
- [ ] Codex second-opinion review of the new commits

## Ship (needs Jayden)
- [ ] Push branch, open draft PR (needs the Asana ticket link per PR rules)
- [ ] Production deploy order: run migrations against the production Supabase first (`supabase db push`), then merge/deploy — the code needs the `regions` table to exist
