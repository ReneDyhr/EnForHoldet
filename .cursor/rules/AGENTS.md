# AGENTS.md — En For Holdet (React Native + Expo)

> A concise, enforceable spec for Cursor Agents to build and maintain the *En For Holdet* app: track litter picking on a map and record a per‑session total weight (kg) + a list of categories found.

---

## Purpose
- Deliver a high‑quality, consistent Expo app for iOS/Android.
- MVP scope: **track path + time + distance**, then **save session summary**: total weight (kg) and categories (glass, paper, plastic, metal, mixed, other).

## Context
- Managed Expo workflow only. Web support is out of scope unless explicitly requested.
- Language: **TypeScript** with strict typing.
- Quality bar: typed, resilient, offline‑first, battery‑aware.

## Tech Stack
- **Expo SDK** (latest stable), **expo-location**, **react-native-maps** (or `expo-maps` if stable), **expo-sqlite**.
- **State:** Zustand (feature‑scoped stores). **Server state:** TanStack Query (only if networking is enabled).
- **Forms/validation:** react-hook-form + zod (summary modal only).
- **Navigation:** Expo Router or React Navigation (prefer Expo Router if starting fresh).

## Directory Layout
```
app/                     # Expo Router
  _layout.tsx
  index.tsx              # Home / Start tracking
  map/
  history/
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
    history/
    settings/
  core/
    ui/
    theme/
    navigation/
    lib/
    db/
      schema.sql
      client.ts
      migrations/
    net/
      client.ts
      endpoints.ts
    analytics/
    auth/
assets/
  icons/
  images/
```

## In Scope (Agent Tasks)
- Implement tracking (foreground; optional background if toggled in settings).
- Persist location samples during active session.
- On stop, show **Summary modal**: total weight (kg) + categories list → persist on the `session` row.
- History list + detail screen (map + stats + weight + categories).
- Export JSON; wipe local data.

## Out of Scope (for now)
- Per‑item logging, photos per log entry, complex teams/leaderboard, store release work.

## Ground Rules
- TypeScript only; `noImplicitAny: true`.
- Keep UI pure; isolate effects in services.
- No hardcoded user‑visible strings buried in logic (place at top of file or a simple constants map).
- Catch and classify errors at async boundaries; never crash on predictable failures.
- Use meters/grams/seconds internally; convert to km/kg/min:sec for display.
- Provide loading/empty/error states on every screen.

## Coding Conventions
- Files `kebab-case`, components/types `PascalCase`, functions/vars `camelCase`.
- Feature‑first folders. One public entry per feature (`index.ts`), internals private.
- Small, focused Zustand stores; avoid global overreach.
- Prefer composition to context. Memoize selectors and heavy views.

## Data Model (authoritative)
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
  accuracyM?: number;  // ~68% conf
  altitudeM?: number;
}

export interface SessionSummary {
  id: SessionId;
  startedAt: number;
  endedAt?: number;
  distanceM: number;
  durationS: number;
  avgPaceSPerKm?: number;
  totalWeightG: number;        // store in grams, display kg
  foundCategories: Category[]; // full-session list
  points?: number;
  syncState: 'local' | 'queued' | 'synced' | 'error';
}
```

## Database Schema (SQLite)
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

## Tracking Behavior
- Request **foreground** permission to start; **background** only if user toggles it in Settings.
- Default accuracy: **balanced**; temporarily raise when movement > threshold.
- Sample every 2–5 s or 10–20 m. Persist each sample immediately to survive app restarts.
- Compute live distance/pace in memory; persist aggregates on stop.

## Networking & Sync (optional)
- `net/client.ts`: `fetch` wrapper with base URL, 10 s timeout, retry for idempotent GET.
- Auth tokens via SecureStore.
- Sync: push unsynced **sessions + samples**; pull changes since `lastSyncAt`. Server wins on aggregates; keep raw samples.

## State & Forms
- Zustand store per feature; no derived data in store (selectors instead).
- `react-hook-form` + `zod` for **Summary modal** only: `totalWeightKg ≥ 0`, `foundCategories: Category[]`.
- Convert kg→g on save; display g→kg.

## Error Handling & Observability
- Central `errorReporter` with fatal vs recoverable classification.
- Toast for transient errors; inline for validation.
- `analytics` service interface (can be no‑op in dev). Events: `session_start`, `session_stop`, `summary_saved`, `settings_changed`.

## Performance & Energy
- Throttle map polyline updates and UI renders (250–500 ms).
- Pause sampling when stationary > 60 s; resume on motion.
- Use FlashList for long lists.

## Task Routing (what the Agent should do)
- **Add/Change UI** → work inside `src/features/<feature>/screens` + `core/ui` primitives.
- **Domain change** → update `types` + zod first; then repos; then UI.
- **DB change** → SQL migration + repo + tests for repo logic.
- **Bug fix** → create a minimal repro test first if practical; then fix.

## Nice‑to‑Have (Phase 2)
- Session photo, simple anonymous leaderboard, share static map snapshot, client‑side category heatmap.

## Deliberate Exceptions
Top‑of‑file comment when breaking rules:
```ts
/**
 * EXCEPTION: <what & why>
 * JUSTIFICATION: <reason>
 * REVIEW DATE: YYYY-MM-DD
 */
```

## Setup (quickstart)
```bash
npx create-expo-app en-for-holdet --template expo-template-blank-typescript
cd en-for-holdet
npm i expo-location react-native-maps expo-sqlite zustand @tanstack/react-query \
      react-hook-form zod expo-secure-store expo-task-manager expo-background-fetch
```

## Definition of Done
- Types and schema updated; migrations applied.
- Loading/empty/error states implemented for new/changed screens.
- Error handling around all async boundaries.
- Battery‑aware sampling and map throttling respected.

---

**This file is authoritative for Agents.** Keep edits aligned with this structure and include a short change note when requirements evolve.

