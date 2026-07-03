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

"S-Drive" — a single-board kanban CRM tracking people from first contact through baptism. One route (`/`, `force-dynamic`) loads the entire board via the `listPeople()` server action and renders `BibleStudyBoard`.

## Architecture

**Composition-root + surface modules.** `src/components/board/board.tsx` is a slim root that owns state via `hooks/use-board-state.ts` (all optimistic mutation handlers, moved verbatim from the legacy monolith — keep in lockstep with server rules) and `hooks/use-board-dnd.ts` (dnd contract: droppable id = `stage.id`, sortable id = `person.id`, archive drop-in blocked). Surfaces live under `src/components/board/{header,views,cards,detail,dialogs,graphs,mobile,primitives,lib}`. Two contexts split by volatility (`board-context.tsx`): `BoardDataContext` (changing data) and a referentially-stable `BoardActionsContext`.

**All data access goes through server actions** in `src/app/actions.ts` (and `src/app/push-actions.ts`), which use a Supabase **service-role** admin client (`src/lib/supabase/server.ts`). There is no user auth, no RLS, no browser Supabase client — the service key must stay server-only. Env vars use the Vercel Marketplace names `SUPABASE_URL` + `SUPABASE_SECRET_KEY` (legacy fallbacks: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`), not the standard-Supabase-docs `NEXT_PUBLIC_*`/anon-key pair. When they're missing the app renders a "not configured" state instead of crashing (`BoardState.configured`).

**Identity is a client-side selected profile, not a login.** Teacher "profiles" live in the DB; the active one is picked in the UI and persisted to localStorage (`src/lib/profiles-client.ts`). Actor attribution (`created_by_profile_id`, event actors) is a client-supplied profile id — server actions validate it via `validateActorProfile`. The same localStorage-module pattern is used by `theme-client.ts` (themes: light/dark/star, applied pre-hydration by an inline script in `layout.tsx`) and `board-view-client.ts` (pipeline/stack views).

**Design system ("The Illuminated Ledger")**: single source in `src/app/globals.css` — `--sd-*` surfaces/ink, six per-theme stage tones (`--tone-*`, CVD/contrast-validated; don't change hues casually), urgency signals, `.t-*` type voices (serif names / sans UI / mono "registrar"), z-index + motion tokens. Discipline rule: gold = actions/edges/light (`.btn-illuminated`, `.card-lit`, `--sd-edge-gilt`), tone = the person's place (wash only, via `toneVars()` from `lib/stage-theme.ts` + `.tone-*` utilities), signal = urgency only.

**Stage system** (`src/lib/stages.ts`): the DB `stages` table overrides `DEFAULT_STAGES`; users can add custom lanes. Early journey stages auto-advance from the completed-study count (`getAutomaticStudyStageId`, applied server-side in `synchronizeAutomaticStudyStage` and mirrored client-side in `lib/move-preview.ts`) — but `MANUAL_ONLY_STAGE_IDS` (ready_for_baptism, baptized, brothers, archive) are never set automatically. Legacy quirk: the hidden `baptized` stage and the visible `brothers` stage are both labeled "Baptized"; `listPeople()` promotes legacy `baptized` people into `brothers`. `buildMovePreview` (client) carries the baptized_at set/clear rule — keep identical to server behavior.

**Follow-up rule has one source of truth**: `src/lib/follow-ups.ts` (`FOLLOW_UP_QUIET_DAYS = 3`). Both the board UI (`primitives/urgency-meter.tsx` centralizes card urgency) and the push-notification cron consume it — change the rule there, not in either consumer.

**Push notifications**: `public/sw.js` (plain JS service worker) + `src/lib/push-client.ts` (registration/subscription) + `src/app/push-actions.ts` (persists to `push_subscriptions` per profile). A daily Vercel Cron (`vercel.json`, 06:00 UTC) hits `GET /api/cron/follow-up-reminders`, authorized by `CRON_SECRET` bearer token, and sends a web-push digest of each profile's overdue contacts (scoped to contacts that profile created). VAPID keys come from env — see `.env.example` for all required vars.

**DB tables**: `people`, `person_events` (activity log incl. contact reactions and archive reasons — the `"Archived — "` note-body prefix in `lib/derive.ts` is load-bearing), `person_studies` (`actor_profile_id` = who studied with them; re-attribution deliberately logs no event so the quiet clock never resets), `profiles`, `stages`, `push_subscriptions`.

## UI conventions

Tailwind CSS 4 (no tailwind.config — tokens live in `src/app/globals.css`), shadcn/ui (`components.json`, radix-nova style), lucide-react icons, framer-motion (client components only). Prefer shadcn/ui primitives and the `--sd-*` token utilities over raw elements and one-off colors; run the grep gate before committing UI work. Path alias: `@/*` → `src/*`.
