# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — dev server (Next.js 16, Turbopack)
- `npm run build` — production build (also the de-facto typecheck gate)
- `npm run lint` — ESLint flat config (`eslint-config-next`); `public/sw.js` is intentionally ignored (worker global scope)
- `npx tsc --noEmit` — typecheck only
- `scripts/check-legacy-classes.sh` — grep gate: rewrite-owned components may only use the `--sd-*` design-token namespace

There is no test framework or test script in this repo.

Database schema lives in `supabase/migrations/` (Supabase CLI project, `supabase/config.toml`). A schema change means: add a new timestamped migration file AND hand-update `src/lib/supabase/database.types.ts` — that file is maintained by hand (it imports `StageId` from `@/lib/stages`), not regenerated output.

## What this app is

"S-Drive" — a multi-region kanban CRM tracking people from first contact through baptism. Each preaching region has its own board. One route (`/`, `force-dynamic`) reads the active region from the `sd-region` cookie, loads that region's board via `listPeople(regionId)`, and renders `BibleStudyBoard`. The seeded locations are Virginia Beach, Brooklyn, Bronx, and Poland; Poland is the hub (`regions.is_hub`) — its board loads every region's people and workers, while the other locations see only their own.

## Architecture

**Composition-root + surface modules.** `src/components/board/board.tsx` is a slim root that owns state via `hooks/use-board-state.ts` (all optimistic mutation handlers, moved verbatim from the legacy monolith — keep in lockstep with server rules) and `hooks/use-board-dnd.ts` (dnd contract: droppable id = `stage.id`, sortable id = `person.id`, archive drop-in blocked). Surfaces live under `src/components/board/{header,views,cards,detail,dialogs,graphs,mobile,primitives,lib}`. Two contexts split by volatility (`board-context.tsx`): `BoardDataContext` (changing data) and a referentially-stable `BoardActionsContext`.

**All data access goes through server actions** in `src/app/actions.ts` (and `src/app/push-actions.ts`), which use a Supabase **service-role** admin client (`src/lib/supabase/server.ts`). There is no user auth, no RLS, no browser Supabase client — the service key must stay server-only. When Supabase env vars are missing the app renders a "not configured" state instead of crashing (`BoardState.configured`).

**Regions are the top of the identity ladder.** The `regions` table partitions everything people-shaped: `profiles` and `people` carry a `region_id` (stages stay global). The active region lives in the `sd-region` cookie — name shared via `src/lib/region-cookie.ts`, client store in `src/lib/region-client.ts` (cookie-backed, same subscription contract as the localStorage modules) — so `page.tsx` can scope the query server-side; with no valid region cookie, `listPeople` returns only the region list and `src/components/onboarding/region-gate.tsx` owns the screen (pick a region or found a new one; duplicate `createRegion` names resolve to the existing region on purpose). Picking sets the cookie and hard-reloads (not `router.refresh()` — board state must re-init from scoped props), after which the required profile picker is onboarding step two. `createPerson` stamps the contact with its *creator's* region, derived server-side from the actor profile, never trusted from the client. Switching region (masthead profile dropdown) just clears the cookie; a now-foreign active profile id fails to resolve against the scoped profile list and the picker re-fires on its own. On the hub board, person cards append the contact's origin region to the registrar line. Workers at non-hub locations who have never entered a contact get a three-step guided tour (`src/components/onboarding/first-contact-tour.tsx`, completion tracked per profile in localStorage) that walks them into the quick-add dialog.

**Identity is a client-side selected profile, not a login.** Teacher "profiles" live in the DB; the active one is picked in the UI and persisted to localStorage (`src/lib/profiles-client.ts`). Actor attribution (`created_by_profile_id`, event actors) is a client-supplied profile id — server actions validate it via `validateActorProfile`. The same localStorage-module pattern (a `useSyncExternalStore` subscription over a single key) is used by `theme-client.ts` and `board-view-client.ts`.

**Themes** (`src/lib/theme-client.ts`): three ids — `light`, `dark`, `star` — labeled Daybreak / Vespers / Night Watch in the UI. Those labels are duplicated in two `THEME_COPY` maps (`header/masthead.tsx`, `mobile/bottom-bar.tsx`); a new theme must be added to both. `light` means *no* `data-theme` attribute; the others set it. Applied pre-hydration by an inline script in `layout.tsx`, which also honors a non-persisting `?theme=` query override for previews and screenshots.

**The game layer is derived, never stored.** `board/lib/engagement.ts` is the only source of truth for streaks and weekly goals: it recomputes them at render time from events and studies already loaded on the board, filtered by `actor_profile_id`, with local-day stamps, a one-day streak grace, and Sunday-start weeks. There is no schema behind it, so nothing here can be queried server-side (no streak-driven notifications without adding tables). The weekly goal lives in localStorage (`sd-weekly-goal`), so it is device-local. Celebrations ride a dependency-free module-level pub/sub (`board/lib/celebrate.ts`) consumed by a single `<CelebrationLayer />` at the board root — anything can fire a burst without threading context.

**Design system ("The Illuminated Ledger")**: single source in `src/app/globals.css` — `--sd-*` surfaces/ink, six per-theme stage tones (`--tone-*`, CVD/contrast-validated; don't change hues casually), urgency signals, `.t-*` type voices (serif names / sans UI / mono "registrar"), `--z-*` and `--dur-*` scales. Discipline rule: gold = actions/edges/light (`.btn-illuminated`, `.card-lit`, `--sd-edge-gilt`), tone = the person's place (wash only, via `toneVars()` from `lib/stage-theme.ts` + `.tone-*` utilities), signal = urgency only.

An `@theme inline` block bridges `--sd-*`/`--tone-*` into Tailwind v4 `--color-*` utilities. shadcn's compat vars (`--primary`, `--card`, …) are present but inert — theming keys off `[data-theme]`, never `.dark`. The ambient backdrop is its own family: `--sky-*` holds inline data-URI SVG textures (grain, web, stars, constellations) consumed by the `.sky-bg` layer, and `--const-*`/`--orb-ink` are declared *per theme scoped to `.sky-bg`* rather than on `:root`.

**Stage system** (`src/lib/stages.ts`): the DB `stages` table overrides `DEFAULT_STAGES`; users can add custom lanes. Early journey stages auto-advance from the completed-study count (`getAutomaticStudyStageId`, applied server-side in `synchronizeAutomaticStudyStage` and mirrored client-side in `lib/move-preview.ts`) — but `MANUAL_ONLY_STAGE_IDS` (ready_for_baptism, baptized, brothers, archive) are never set automatically. Legacy quirk: the hidden `baptized` stage and the visible `brothers` stage are both labeled "Baptized"; `listPeople()` promotes legacy `baptized` people into `brothers`. `buildMovePreview` (client) carries the baptized_at set/clear rule — keep identical to server behavior.

**Follow-up rule has one source of truth**: `src/lib/follow-ups.ts` (`FOLLOW_UP_QUIET_DAYS = 3`). Both the board UI (`primitives/urgency-meter.tsx` centralizes card urgency) and the push-notification cron consume it — change the rule there, not in either consumer.

**Push notifications**: `public/sw.js` (plain JS service worker) + `src/lib/push-client.ts` (registration/subscription) + `src/app/push-actions.ts` (persists to `push_subscriptions` per profile). A daily Vercel Cron (`vercel.json`, 06:00 UTC) hits `GET /api/cron/follow-up-reminders`, authorized by `CRON_SECRET` bearer token, and sends a web-push digest of each profile's overdue contacts (scoped to contacts that profile created). VAPID keys come from env — see `.env.example` for all required vars.

**DB tables**: `people`, `person_events` (activity log incl. contact reactions and archive reasons — the `"Archived — "` note-body prefix in `lib/derive.ts` is load-bearing), `person_studies` (`actor_profile_id` = who studied with them; re-attribution deliberately logs no event so the quiet clock never resets), `profiles`, `stages`, `push_subscriptions`.

**Two board views, no mobile fork.** `pipeline` (staggered lanes climbing toward Baptized) and `stack` ("The Path" — one journey line, stages as nodes), chosen in `lib/board-view-client.ts` and persisted to localStorage. Responsiveness is CSS-driven: `Masthead` and `mobile/bottom-bar.tsx` both always render and hide themselves at breakpoints, so the bottom bar mirrors the masthead's view toggle rather than replacing it. The single runtime mobile branch in the whole board is `views/stack-board.tsx`, where `useMediaQuery` makes stage expansion a single-open accordion on phones. Stack is the de-facto phone view but is never forced.

## UI conventions

Tailwind CSS 4 (no tailwind.config — tokens live in `src/app/globals.css`), shadcn/ui (`components.json`, radix-nova style), lucide-react icons, framer-motion (client components only). Prefer shadcn/ui primitives and the `--sd-*` token utilities over raw elements and one-off colors; run the grep gate before committing UI work. Path alias: `@/*` → `src/*`.
