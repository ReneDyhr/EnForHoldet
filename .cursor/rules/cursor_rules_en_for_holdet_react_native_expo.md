# Cursor Rules — *En For Holdet* (React Native + Expo)

> **Goal:** A high‑quality, consistent Expo app for tracking litter picking on a map and logging the amount collected. Cursor must follow these rules unless a deliberate exception is documented in code comments and commit messages.

---

## Project Context & Non‑negotiables
- **App name:** `En For Holdet`
- **Platforms:** iOS + Android (Expo managed workflow). Web support only if explicitly asked.
- **Primary features:**
  1. **Track** a litter‑picking session on a map (live path, distance, time, location samples).  
  2. **Record** session totals only: total weight (kg) and a list of found categories (glass, paper, plastic, metal, etc.).  
  3. **View** history, stats, and simple leaderboard (local first; server optional).  
- **Quality bar:** Typed, tested, accessible, offline‑first, energy‑efficient, privacy‑respecting.
- **Language:** TypeScript only. `noImplicitAny: true`.
- **Expo:** Use the latest stable Expo SDK. Prefer Expo packages when equivalent.

---

## Architecture & Conventions
- **Architecture style:** Feature‑oriented folders with a clean separation of UI, domain, and data.
- **Data flow:**
  - Local database as the source of truth (SQLite via `expo-sqlite` + a tiny repository layer).
  - Network sync (if enabled) via idempotent REST endpoints and background sync jobs.
- **State management:**
  - Server state & caching: **TanStack Query**.
  - App/UI state: **Zustand** or **Jotai** (keep stores small and feature‑scoped).
  - Forms: **react-hook-form** + **zod** for schema validation.
- **Side effects:** isolate in services; UI components remain pure.
- **Error boundaries:** per feature and at root; never crash the app on predictable errors.
- **Naming:** `kebab-case` files, `camelCase` vars/functions, `PascalCase` components/types. Avoid abbreviations.
- **Units:** SI units. Distances in meters, weights in grams, durations in seconds. Convert for display.

---

## Directory Structure (root)
```
app/                     # Expo Router routes (if using expo-router)
  (tabs)/
  _layout.tsx
  index.tsx              # Home / Start tracking
  history/
  session/[id]/
  settings/
src/
  features/
    tracking/
      components/
      screens/
      hooks/
      services/
      store.ts
      types.ts
      repo.ts
    logging/
    history/
    leaderboard/
    settings/
  core/
    ui/                  # design system primitives
    theme/
    navigation/
    lib/                 # misc helpers (date, format, math)
    db/
      schema.sql
      client.ts          # expo-sqlite wrapper
      migrations/
    net/
      client.ts          # fetch wrapper (retry, timeout, auth)
      endpoints.ts
    analytics/
    auth/
  test/
  types/
assets/
  icons/
  images/

package.json
.eslintrc.cjs
.prettierrc
tsconfig.json
app.config.ts / app.json
README.md
```

---

## UI/UX & Accessibility
- **Design:** Simple, high‑contrast, touch‑friendly. Use platform safe areas and haptics for key actions.
- **Theming:** Light + dark themes with tokenized color system. Use a minimal atomic component library (`core/ui`).
- **A11y:** All interactive elements have accessible names; support Dynamic Type; minimum 44×44 touch targets.
- **Loading/empty/error states:** Every screen must implement all three.
- **Maps:**
  - Use `expo-location` for permissions and background location (if needed).  
  - Use `react-native-maps` (or `expo-maps` if stable) with polylines for tracks; throttle location updates to save battery.

---

## Tracking Rules (Location, Battery, Accuracy)
- Request **foreground** permission to start; **background** only if explicitly toggled in settings.
- Use **balanced** accuracy by default (not GPS‑high) and increase temporarily when the user is moving > X m/s.
- Sample interval defaults: 2–5 s or 10–20 m distance filter. Debounce UI updates to 250–500 ms.
- Persist samples **as you go** to SQLite to survive app kills. Flush to server on Wi‑Fi or when on charger.
- Calculate live metrics in memory (distance with haversine, duration, pace). Store **raw samples** + derived aggregates at stop.
- Handle permission states: `undetermined` → prompt; `denied` → show helpful CTA; `granted` → start.

---

## Data Model (Domain Types)
```ts
// src/features/tracking/types.ts
export type SessionId = string; // uuid v4
export type Category = 'mixed' | 'plastic' | 'metal' | 'glass' | 'paper' | 'other';

export interface LocationSample {
  id: string;
  sessionId: SessionId;
  t: number;           // epoch seconds
  lat: number;
  lon: number;
  accuracyM?: number;  // 68% confidence
  altitudeM?: number;
}

export interface SessionSummary {
  id: SessionId;
  startedAt: number;
  endedAt?: number;
  distanceM: number;
  durationS: number;
  avgPaceSPerKm?: number;
  totalWeightG: number;        // grams (store in g, display kg)
  foundCategories: Category[]; // simple list for the whole session
  points?: number;             // for gamification/leaderboard
  syncState: 'local' | 'queued' | 'synced' | 'error';
}
```

**SQLite schema (minimum):**
```sql
-- src/core/db/schema.sql
CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  distance_m REAL NOT NULL DEFAULT 0,
  duration_s INTEGER NOT NULL DEFAULT 0,
  avg_pace_s_per_km REAL,
  total_weight_g INTEGER NOT NULL DEFAULT 0,
  found_categories TEXT NOT NULL DEFAULT '[]', -- JSON array of Category
  points INTEGER DEFAULT 0,
  sync_state TEXT NOT NULL DEFAULT 'local'
);

CREATE TABLE IF NOT EXISTS location_sample (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  t INTEGER NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  accuracy_m REAL,
  altitude_m REAL,
  FOREIGN KEY(session_id) REFERENCES session(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_location_session_t ON location_sample(session_id, t);
```

---

## Networking & Sync
- **HTTP client:** small `fetch` wrapper with: base URL, JSON parsing, 10s timeout, 3× retry for idempotent GET.
- **Auth:** Abstract via token provider; never store tokens in plain text; use `SecureStore`.
- **Sync model:**
  - Push: batched unsynced sessions/samples with deterministic ordering.
  - Pull: incremental changes since `lastSyncAt`.
  - Conflict: server wins for processed aggregates; keep raw samples client‑side.
- **Background sync:** only on Wi‑Fi or charging unless user opts in. Use `expo-task-manager` + `expo-background-fetch`.

---

## State, Forms, Validation
- **Zod** schemas mirror domain types; parse external data at the boundaries.
- **react-hook-form** only for the **session summary** (shown when stopping a session): fields `totalWeightKg` (number ≥ 0) and `foundCategories` (checkbox group of `Category`). Convert kg→g before persisting.
- **Never** keep derived values in the store (compute selectors instead).

---

## Error Handling & Observability
- Centralized `errorReporter` service. Fatal vs. recoverable classification.
- User‑friendly toasts for transient errors; inline messages for validation errors.
- Log events (screen views, start/stop tracking, summary saved) to an `analytics` service with an interface that can be no‑op in dev.

---

## Performance & Energy
- Avoid re‑renders: memoize selectors, split components, use `FlashList` for long lists.
- Map: throttle polyline updates; cluster markers if added later.
- Location sampling adaptive to movement; pause when stationary for >60 s (resume on motion).

---

## Cursor Execution Rules (very important)
When Cursor generates or edits code, it must:
1. **Scaffold with types first:** define domain types/Zod schemas before components and APIs.
2. **Follow the directory structure** above; create/modify files in the correct feature package.
3. **Prefer composition over context:** keep React Context usage minimal; use hooks + small stores.
4. **Never hardcode strings** destined for UI. Place all user‑facing text in a simple i18n map with `da` and `en` keys.
5. **Guard every async boundary** with try/catch and typed error paths; return `Result<T, E>`-style objects for services.
6. **Write tests** for new logic; at minimum one unit test or component test per feature PR.
7. **Document non‑obvious decisions** in code comments with a `WHY:` prefix and link to sources if external.
8. **Expose one public entry point per feature** (`index.ts`) and keep internals private.
9. **Avoid over‑engineering:** no state machines unless explicitly requested; start simple.
10. **Adhere to UX states:** loading/empty/error implemented on every new screen.

---

## Analytics (Optional)
- Events: `session_start`, `session_stop`, `summary_saved`, `share_export`, `settings_changed`.
- Include only anonymous IDs; never include coordinates in analytics payloads.

---

## Task Routing Guide for Cursor
- **New feature UI?** → create screen in `src/features/<feature>/screens`, use design system, add tests.
- **Domain change?** → update types + zod first, then repos, then UI.
- **Session summary work?** → edit `SessionSummary` fields (`totalWeightG`, `foundCategories`), adjust DB repo and form.
- **Bug fix?** → add failing test first, fix, reference issue in commit.
- **Performance?** → profile, add memoization/selectors, benchmark before/after.

---

## Deliberate Exceptions
If a rule must be broken, include a top‑of‑file comment:
```ts
/**
 * EXCEPTION: Using high‑accuracy GPS continuously for this prototype map matching experiment.
 * JUSTIFICATION: Needed for trace quality during evaluation build only.
 * REVIEW DATE: 2025‑12‑01 (remove or gate behind a dev flag).
 */
```

---

**End of rules.** This file is authoritative; suggest changes via a short change note when requirements evolve.

