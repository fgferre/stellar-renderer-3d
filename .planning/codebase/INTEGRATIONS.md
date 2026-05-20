# External Integrations

**Analysis Date:** 2026-05-20

## APIs & External Services

**No third-party APIs are called at runtime.** The application is a fully self-contained, client-side WebGL 2 simulation. There are no `fetch`, `XMLHttpRequest`, `axios`, `WebSocket`, or SDK calls anywhere in `src/`.

**Web Fonts (CDN, declarative):**
- **Google Fonts** - `fonts.googleapis.com` + `fonts.gstatic.com`
  - SDK/Client: None — loaded via standard `<link rel="stylesheet">` in `index.html:13-15`.
  - Families: `Orbitron` (weights 400/600/900) and `Outfit` (weights 300/400/600).
  - Auth: None (public CDN).
  - Failure mode: HUD falls back to `sans-serif` (`src/style.css:16`, `src/style.css:54`).
  - Preconnect hints declared for both origins.

## Data Storage

**Databases:**
- None. No remote database, no ORM, no SQL/NoSQL clients.

**Local in-memory "catalog":**
- `HYG_DATABASE` constant (16 famous stars) defined inline at `src/js/stellarClassifier.js:329-348`. It is named after the public HYG astronomy catalog but is a hardcoded JavaScript object — not a network query. Lookup via `lookupHYGStar(nameQuery)` in `src/js/stellarClassifier.js:350-404`.

**Browser Storage:**
- None. No use of `localStorage`, `sessionStorage`, `IndexedDB`, cookies, or the Cache API. Star parameters reset on page reload.

**File Storage:**
- Static asset bundle only (served by Vite from `public/` and `src/assets/`). No upload, blob storage, or CDN integration.

**Caching:**
- None at application level. Browser-default HTTP caching applies to static assets.

## Authentication & Identity

**Auth Provider:**
- None. There is no concept of user, session, login, signup, or identity in the codebase.
- The UI is a single-user interactive sandbox; no authorization checks exist.

## Monitoring & Observability

**Error Tracking:**
- None. No Sentry, Bugsnag, Rollbar, Datadog, or similar SDK present.
- Errors fall through to the browser console only.

**Analytics:**
- None. No Google Analytics, Plausible, PostHog, Mixpanel, Segment, gtag, or comparable beacon.

**Logs:**
- Standard `console.*` only. No structured logging library.

**Performance:**
- No Real-User-Monitoring (RUM) integration. FPS / GPU performance is tuned in-code via:
  - `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))` (`src/js/main.js:73`)
  - Half-resolution bloom target (`src/js/main.js:122`)
  - Optional post-processing toggle (`usePostProcessing` flag at `src/js/main.js:20`).

## CI/CD & Deployment

**Hosting:**
- Not configured in repo. The build output (`dist/`) is a static asset bundle deployable to any static host (Netlify, Vercel, GitHub Pages, S3 + CloudFront, etc.).

**CI Pipeline:**
- None. No `.github/workflows/`, no `.gitlab-ci.yml`, no `circle.yml`, no `azure-pipelines.yml`.

**Container/Infra:**
- None. No `Dockerfile`, `docker-compose.yml`, `Procfile`, or infrastructure-as-code files.

## Environment Configuration

**Required env vars:**
- None. The application reads no environment variables at runtime or build time.

**Secrets location:**
- N/A — no secrets exist in the codebase.
- No `.env`, `.env.*`, `*.pem`, or credential files present.
- `.gitignore` does not list `.env` files because none are needed.

## Webhooks & Callbacks

**Incoming:**
- None. No HTTP server, no API surface.

**Outgoing:**
- None. No outbound network calls.

## Outbound Network Surface (Exhaustive)

The only external network traffic this app produces, in normal operation, is:

| Origin | Purpose | Trigger | File |
|--------|---------|---------|------|
| `https://fonts.googleapis.com` | Web font CSS | `<link>` in HTML | `index.html:13`, `index.html:15` |
| `https://fonts.gstatic.com` | Web font binary (woff2) | Resolved by Google Fonts CSS | `index.html:14` |

No other domains are contacted. The app is offline-capable after fonts have been cached by the browser.

## Browser Platform APIs Used

These are not "integrations" in the SaaS sense, but they are the runtime contract the app depends on:

- **WebGL 2.0** via `THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" })` (`src/js/main.js:71`).
- **Canvas 2D** for procedurally generating lens-flare textures (`src/js/sun.js:13-95`).
- **DOM APIs** — `document.getElementById`, `addEventListener`, `requestAnimationFrame` (via Three.js animation loop), `window.onload` (`src/js/main.js:1228`), `window.addEventListener('resize', ...)` (`src/js/main.js:149`).
- **CSS Backdrop Filter** for glass panel effects (`src/style.css:32-50`).

---

*Integration audit: 2026-05-20*
