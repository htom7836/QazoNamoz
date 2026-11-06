# Qazo Namoz — Implementation Plan

## Product and implementation approach

Build a mobile-first Uzbek (Latin) prayer tracker on the initialized React/Vite, Express, tRPC, Drizzle, and managed MySQL stack. Use the supplied Manus OAuth flow for real signed-in accounts. Keep a local-first guest mode with device-only storage; signed-in users load and save their state through authenticated tRPC procedures scoped to the authenticated database user. The `qazo_app_data` row stores a validated versioned app-state document, including prayer totals, completion history, calculator values, daily target history, and reminder preferences. No client-selected user ID determines database ownership.

Bind the remote query key to the expected authenticated identity and verify that identity server-side. On account changes, render that account's local cache while its own server data loads; do not reuse another account's query result. When an account has no saved state, offer an explicit confirmation before copying guest progress into it. Guest and account caches use distinct local-storage keys.

Use the existing starter and dependencies rather than adding an external backend or provider: Manus OAuth is the default login, and managed MySQL is already provisioned. The initialized project does not include Google OAuth or Supabase. Keep app state schema strict and backward-compatible. Track target changes with effective dates so calendar history is not reinterpreted when a user edits the plan. Limit event records to 20,000 and stop additions with a clear backup warning before the state validator would reject the data; allow up to 5 MB of UTF-8-encoded validated account-state payloads.

The calculator is an estimate, never a fatwa. It asks the user which of the five daily farz prayers to count, allows selected day ranges, excludes regular-prayer periods, and supports manual exact counts that override the day-based estimate per prayer. Store and display the user's selected jurisprudential guidance; explain that the five-farz arithmetic uses the entered days and selected prayers, and encourage manual exact values for personal fiqh detail. Do not automatically add non-obligatory prayers.

The optional daily browser reminder has an editable device-local time, a permission request only after opt-in, once-per-local-day de-duplication, a target-progress preference, and optional weekly reminder. It is evaluated on app start, focus, and a short timer while the app is open. State plainly that reliable delivery is not possible after the browser closes or the device is off; no background push service or scheduled end-user delivery is configured.

## Serving, routing, and offline behavior

Use the existing server/database configuration and port 3000. The app's page routes are `/` and `/404`; serve the required static manifest from `client/public/manus-routes.json`. Register `client/public/sw.js` only in production from `client/src/main.tsx`. Cache the app shell and same-origin static assets for offline reopening; bypass API, OAuth, storage, reserved paths, and requests carrying Authorization. Offline cache does not imply cloud synchronization while disconnected. Keep the platform's default PWA manifest behavior and set the project-logo URL as a literal in root `app.config.ts`.

## Project structure

- `client/src/pages/Home.tsx`: Uzbek mobile/desktop shell and dashboard, calculator wizard, recording/calendar/history, plan, statistics, profile, sign-in, privacy, and reminders.
- `client/src/lib/qazoState.ts`: local and account-keyed storage, nonnegative progress math, day/week helpers, historical target lookup, export, and browser reminder de-duplication.
- `client/src/components/ActivityChart.tsx`: Recharts visualization, dynamically loaded only for the Statistics page.
- `shared/qazo.ts`: shared strict Zod app-state schema, prayer types, compatibility defaults, and record limit.
- `server/routers.ts`: authenticated identity-bound Qazo load/save procedures.
- `server/db.ts`, `drizzle/schema.ts`, `drizzle/0001_brainy_bloodstorm.sql`: additive per-user app-state persistence; preserve existing user/auth tables.
- `server/qazoState.test.ts`: regression checks for legacy state parsing and date-specific daily target history.
- `client/src/index.css`, `client/src/App.tsx`: visual tokens, responsive layout, theme support, and UI providers.
- `client/public/manus-routes.json`, `client/public/sw.js`, `client/public/qazo-mark.svg`: route declaration, offline shell, and site emblem.
- `client/src/main.tsx`, `client/index.html`, `app.config.ts`: production worker registration, Uzbek page metadata/favicon, and platform logo.
- `plan.md` and `TODO.md`: design decisions and traceable feature outcomes.

## Design

- **Design Movement:** Contemporary Islamic editorial design with quiet geometry and generous spacing rather than ornament-heavy decoration.
- **Core Principles:** Calm, non-judgmental motivation; transparent counts and actions; thumb-friendly everyday use; visible privacy and accessibility.
- **Color Philosophy:** Emerald signals steady devotion, warm cream softens long sessions, white improves reading, and restrained brass-gold marks progress without gamifying worship.
- **Layout Paradigm:** A narrow reading column, persistent desktop side rail, compact mobile bottom navigation, and vertically stacked prayer rows anchored by one clear progress overview.
- **Signature Elements:** Fine eight-point geometric line motif; small gold progress accents; pill-shaped date and completion markers.
- **Interaction Philosophy:** One clear action per prayer, immediate correction/undo, gentle confirmation, and no shame language or streak penalties.
- **Animation:** Short 160–220 ms opacity/position transitions; reduced-motion support; eased progress changes without celebratory motion.
- **Typography System:** DM Sans for interface and figures with Playfair Display for key headings; use system fallbacks and keep Uzbek diacritics readable.
- **Brand Essence:** A private, steady companion for people making up missed prayers; calm, respectful, encouraging.
- **Brand Voice:** Clear Uzbek Latin microcopy, warm but not preachy. Examples: “Har bir qadam muhim.” and “Bugungi rejangizga kichik qadam qo‘shing.”
- **Wordmark & Logo:** “Qazo Namoz” wordmark paired with a simple eight-point rosette/mihrab outline.
- **Signature Brand Color:** Deep emerald `#0B4A3B`.
