# CLAUDE.md — IRS Generator

Agent-oriented guide: where things live, how they connect, and what to watch out for.

---

## Architecture overview

Three services, all wired together by `docker-compose.yml`:

| Service | Source | Port | Purpose |
|---|---|---|---|
| `frontend` | `client/` | 3000 | Next.js 14 app (React, Tailwind) |
| `backend` | `server/` | 8080 | ASP.NET Core (.NET 8) REST API |
| `concept-server` | `server/concept_server.py` | 8000 | Tiny Python HTTP server; serves `ValIntent.json` (intent-semantics concept definitions) |

The backend is the source of truth for the AML file. The frontend never touches the file directly.

---

## Server (`server/` — C# .NET 8)

### File map

| File | Role |
|---|---|
| `main.cs` | App bootstrap: CORS, logger, startup copy of template → working file, calls `ResolveExternalReferences`, then `MapAmlEndpoints` |
| `AmlEndpoints.cs` | All HTTP route handlers (`GET /api/hierarchy`, `POST /api/update-attribute`, `POST /api/reset`, `GET /api/scores`). Extension method on `WebApplication`. |
| `AmlEditor.cs` | Reads the AML XML hierarchy into DTOs; writes attribute updates back. Owns the static `_attributeMappings` field. |
| `ScoreCalculator.cs` | Bottom-up weighted score computation. Receives `attributeMappings` as a parameter — no file I/O. |
| `ValueIntentionValidator.cs` | Validates intent-state transitions (e.g. `placeholder → actual` is allowed; direct jumps may not be). Must stay in sync with `client/src/constants/editorRoles.ts`. |
| `Resolver.cs` (`ExternalReferenceResolver`) | On startup, fetches concept descriptions from `concept-server:8000` and patches them into the working AML file. |
| `AmlConstants.cs` | Domain string constants. Class is `AmlConst` (NOT `Aml` — conflicts with `Aml.Engine` namespace). |

### Runtime files

| File | Description |
|---|---|
| `Q-Metrics_template.aml` | Read-only golden template. Copied to `Q-Metrics.aml` if the working file is absent (e.g. fresh container). |
| `Q-Metrics.aml` | Live working file. All reads/writes happen here. Do **not** commit this unless intentional. |
| `Q-Metrics.aml.bak` | Backup; ignored at runtime. |
| `ValIntent.json` | Served by `concept-server`; defines the valid `intent_semantics` vocabulary. |

### Critical gotchas

- Project SDK is `Microsoft.NET.Sdk` (not `.Web`). ASP.NET Core types need explicit usings:
  `Microsoft.AspNetCore.Builder`, `Microsoft.AspNetCore.Http`, `Microsoft.Extensions.DependencyInjection`.
- 3 pre-existing nullable-reference warnings (`as AttributeTypeType` / `as InternalElementType` casts) — don't add more; don't suppress the existing ones.
- `editor_id` is snake_case in the JSON API. The C# parameter is `editorId`. Keep this asymmetry.
- `AmlConst.DefaultEditor = "default"` is a reserved editor; writes are rejected for it.
- Log level is controlled by the `LOG_LEVEL` env var (`Trace`/`Debug`/`Information`/…).

### API routes (all in `AmlEndpoints.cs`)

```
GET  /api/hierarchy          → full attribute tree as JSON
POST /api/update-attribute   → { attribute_path, new_value, editor_id }
POST /api/reset              → resets working file from template
GET  /api/scores             → computed scores per editor
```

---

## Client (`client/` — Next.js 14, TypeScript, Tailwind)

### File map

```
client/src/
  app/
    page.tsx              ← root page; fetches /api/hierarchy, renders QualityMetricsTree
    layout.tsx
    help/                 ← help page
  components/
    QualityMetrics.tsx    ← main tree UI; mode switching (weight / evaluation / scores)
    EditModal.tsx         ← modal for editing a single attribute value + intent
    MetricCard.tsx        ← card for one metric node
  constants/
    editorRoles.ts        ← valid editor IDs and allowed intent transitions (must mirror ValueIntentionValidator.cs)
  config/
    (inline config file)  ← INTENT_CONFIG, VALUE_CONFIG, MODE_REMINDERS, EVALUATION_MODE_EDITOR_ID
  types/
    aml.ts                ← TypeScript types for the hierarchy/attribute DTOs
    qualityMetrics.ts     ← score-related types
```

### Key conventions

- Backend URL: `process.env.NEXT_PUBLIC_BACKEND_URL` (default `http://localhost:8080`).
- `EVALUATION_MODE_EDITOR_ID = "default"` — in evaluation mode no editor selector is shown and writes are blocked server-side.
- Intent state colors and descriptions live in the config file (`INTENT_CONFIG`), not in components.
- Value option colors (`VALUE_CONFIG`) are also in the config file — add new value options there first.

---

## Adding / changing things

### New AML attribute name
1. Add a constant to `server/AmlConstants.cs`.
2. Update parsing/writing logic in `server/AmlEditor.cs`.

### New intent state (value-intention)
1. Add it to `ValIntent.json` (concept-server vocab).
2. Add allowed transitions in `server/ValueIntentionValidator.cs`.
3. Mirror the transitions in `client/src/constants/editorRoles.ts`.
4. Add color + description in the client config file (`INTENT_CONFIG`).

### New value option (the `value` attribute)
1. Add the string to the AML template (`Q-Metrics_template.aml`) where needed.
2. Add color + description in the client config file (`VALUE_CONFIG`).

### New API endpoint
1. Add the handler in `server/AmlEndpoints.cs` (inside `MapAmlEndpoints`).
2. Call it from the frontend via `BACKEND_URL`.

### New editor role
1. Add the editor ID to `client/src/constants/editorRoles.ts`.
2. If the role has special server-side write restrictions, handle them in `AmlEndpoints.cs`.

---

## Local dev

```bash
# Full stack (recommended)
docker compose up

# Hot-reload is configured in docker-compose.yml via `develop.watch` for both backend and frontend.

# Backend only (no Docker)
cd server && dotnet run

# Frontend only (no Docker)
cd client && npm install && npm run dev
```

Env vars used by the backend container:
- `ASPNETCORE_ENVIRONMENT` — `Production` in compose, `Development` locally
- `LOG_LEVEL` — `Trace` | `Debug` | `Information` | `Warning` | `Error`
- `INIT_INTENT_SEMANTICS` — when `true`, resolver fetches intent semantics from concept-server on startup
