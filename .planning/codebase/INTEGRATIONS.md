# External Integrations

**Analysis Date:** 2026-05-20

## APIs & External Services

**Web Fonts:**
- Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`) - Loads the `Orbitron` (400/600/900) and `Outfit` (300/400/600) font families used for the cockpit HUD and main typography
  - SDK/Client: Plain HTML `<link>` tags
  - Auth: None (public CDN)
  - Files: `index.html:13-15` (preconnect + stylesheet link); replicated in `dist/index.html:13-15`
  - Failure mode: If blocked, browser falls back to `sans-serif` (declared in `src/style.css:16` via `font-family: 'Outfit', sans-serif`)

**Other APIs:**
- None - No `fetch()`, `XMLHttpRequest`, `axios`, or WebSocket usage anywhere in `src/`. Confirmed via repository-wide grep.

## Browser-Native APIs Used

These are not external services but are worth noting because the app depends on them:

- **WebGL 2** - `THREE.WebGLRenderer` (`src/js/main.js:48`) with `powerPreference: "high-performance"` and `antialias: true`
- **Canvas 2D** - Procedural texture generation for lens flares (`src/js/sun.js:13-93`: `createGlowTexture`, `createRingTexture`, `createHexagonTexture`)
- **DOM APIs** - `document.getElementById` / `querySelectorAll` for HUD bindings (`src/js/main.js:29-34, 181-306`)
- **`window.devicePixelRatio`** - Pixel ratio capped at 2 for performance (`src/js/main.js:50`)
- **`requestAnimationFrame`** - Render loop driver (`src/js/main.js:370`)
- **`window.onload`, `window.addEventListener('resize')`** - Application bootstrap and viewport resize handling (`src/js/main.js:424, 105`)

## Data Storage

**Databases:**
- None - Application has no persistent storage. No IndexedDB, no `localStorage`, no `sessionStorage`, no remote database.

**File Storage:**
- Local filesystem only - Static assets bundled into `dist/`:
  - `public/favicon.svg`, `public/icons.svg` - copied verbatim to `dist/` by Vite
  - `src/assets/hero.png`, `src/assets/javascript.svg`, `src/assets/vite.svg` - present but not referenced by the runtime code (orphan template files from a Vite scaffold)
- The favicon used by `index.html:5` is inlined as a `data:image/svg+xml` URL, not loaded from `public/`

**Caching:**
- None - No service worker, no Cache API usage, no in-memory caching layer beyond Three.js's built-in geometry/material reuse

## Authentication & Identity

**Auth Provider:**
- None - No login, no users, no session concept. The application is a fully anonymous, single-page stellar simulator.

## Monitoring & Observability

**Error Tracking:**
- None - No Sentry, Rollbar, Bugsnag, or equivalent integration. Errors surface only via the browser DevTools console.

**Logs:**
- Browser `console` - No explicit `console.log` / `console.error` calls observed in `src/js/`; runtime logging happens only via Three.js / Vite default warnings.

**Analytics:**
- None - No Google Analytics, Plausible, Umami, or similar tag detected in `index.html` or anywhere else.

## CI/CD & Deployment

**Hosting:**
- Not configured in-repo - No `vercel.json`, `netlify.toml`, `firebase.json`, GitHub Pages workflow, or other host-specific manifest. Output is the standard `dist/` directory that any static host (Vercel, Netlify, Cloudflare Pages, GitHub Pages, S3+CloudFront, plain Apache/Nginx) can serve.

**CI Pipeline:**
- None - No `.github/workflows/`, `.gitlab-ci.yml`, `azure-pipelines.yml`, or `Jenkinsfile` present. Builds are produced manually via `npm run build`.

## Embedded "Database" - Stellar Reference Data

The application ships one piece of static reference data inline:

- **HYG (Hipparcos-Yale-Gliese) star reference list** - 15 named stars (`Sun`, `Sirius A/B`, `Betelgeuse`, `Rigel`, `Vega`, `Aldebaran`, `Polaris`, `Proxima Centauri`, `Canopus`, `Arcturus`, `Antares`, `Deneb`) hard-coded as `HYG_DATABASE` in `src/js/stellarClassifier.js:193-210`
- Looked up by name via `lookupHYGStar()` (`src/js/stellarClassifier.js:212-236`)
- Each entry stores `name`, `spect` (Morgan-Keenan class), `temp` (Kelvin), `lum` (relative luminosity)
- This is a hand-curated subset, not a network call to a real HYG/Hipparcos catalog API

## Environment Configuration

**Required env vars:**
- None - The build and runtime require zero environment variables.

**Secrets location:**
- Not applicable - No `.env*` files exist in the repo, and `.gitignore` lines 12-13 (`*.local`) would exclude them if they were ever added.

## Webhooks & Callbacks

**Incoming:**
- None - Static site, no server endpoints.

**Outgoing:**
- None - Application makes zero outbound HTTP/HTTPS requests at runtime aside from the initial Google Fonts stylesheet fetch declared in `index.html`.

## Build-Time External Dependencies

These are downloaded only when `npm install` runs, never at runtime:

- npm registry (`https://registry.npmjs.org`) - source for `three`, `lil-gui`, `vite`, and all transitive Vite/Rolldown packages (verified across `package-lock.json` resolved URLs)
- Rolldown native binding tarballs (`@rolldown/binding-*`) - platform-specific Rust binaries pulled by Vite 8's optional dependencies

---

*Integration audit: 2026-05-20*
