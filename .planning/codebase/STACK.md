# Technology Stack

**Analysis Date:** 2026-05-20

## Languages

**Primary:**
- JavaScript (ES2022+, ECMAScript modules) - All application logic in `src/js/*.js`
- GLSL (ES 3.00 / WebGL 2.0) - Custom vertex and fragment shaders embedded as template strings in `src/js/shaders.js`
- HTML5 - Single-page entry `index.html` (157 lines, includes HUD layout and DOM scaffolding)
- CSS3 - Glassmorphism UI styling in `src/style.css` (615 lines, no preprocessor)

**Secondary:**
- SVG - Inline favicon and decorative icons in `public/favicon.svg`, `public/icons.svg`, `src/assets/javascript.svg`, `src/assets/vite.svg`

## Runtime

**Environment:**
- Browser-only (no Node.js server runtime). Targets browsers with WebGL 2.0 + `backdrop-filter` support.
- Local toolchain Node.js v22.22.1 detected (Vite 8 requires `^20.19.0 || >=22.12.0`).

**Package Manager:**
- npm 11.11.1 detected locally.
- Lockfile: `package-lock.json` present (lockfileVersion 3, 28,710 bytes).

**Module System:**
- ESM (`"type": "module"` declared in `package.json`).
- Browser loads via `<script type="module" src="/src/js/main.js">` in `index.html:154`.

## Frameworks

**Core 3D / Rendering:**
- **three** `^0.184.0` (resolved `0.184.0`) - WebGL 2.0 scene graph, materials, post-processing, and OrbitControls. Imported in `src/js/main.js:1`, `src/js/sun.js:1`, `src/js/starfield.js:1`, `src/js/stellarClassifier.js:1`.

**Three.js subsystem modules used (from `three/examples/jsm/`):**
- `controls/OrbitControls.js` — camera interaction (`src/js/main.js:2`)
- `postprocessing/EffectComposer.js` — render-target pipeline (`src/js/main.js:3`)
- `postprocessing/RenderPass.js` — base scene render pass (`src/js/main.js:4`)
- `postprocessing/UnrealBloomPass.js` — HDR bloom (`src/js/main.js:5`)
- `postprocessing/OutputPass.js` — tone mapping output (`src/js/main.js:6`)
- `objects/Lensflare.js` — `Lensflare` and `LensflareElement` classes (`src/js/sun.js:2`)

**UI Control Library:**
- **lil-gui** `^0.21.0` (resolved `0.21.0`) - Dat.gui-style debug parameter panel mounted into `#gui-container`. Imported in `src/js/main.js:7` and instantiated in `setupGUI()` at `src/js/main.js:175`.

**Testing:**
- Not detected. No test runner, test files, or test configuration in the repository.

**Build/Dev:**
- **vite** `^8.0.12` (resolved `8.0.13`) - Dev server and production bundler. Pulled in as a `devDependency` only.
- Vite transitively brings:
  - **rolldown** `1.0.1` (Vite 8's Rust-based bundler replacing Rollup)
  - **postcss** `8.5.15`
  - **lightningcss** `1.32.0` (CSS minifier/transformer)
  - **picomatch** `4.0.4`, **tinyglobby** `0.2.16`, **nanoid** `3.3.12`, **source-map-js** `1.2.1`

## Key Dependencies

**Critical (runtime):**
- `three@0.184.0` (MIT) - Core renderer; the entire app is built on its scene graph, `ShaderMaterial`, `WebGLRenderer`, and `EffectComposer` pipeline.
- `lil-gui@0.21.0` (MIT) - Real-time parameter tweaking inside the "STATION PARAMETERS" panel.

**Infrastructure (dev only):**
- `vite@8.0.13` (MIT) - Provides `dev`, `build`, `preview` scripts. Auto-injects `src/style.css` via the `import '../style.css'` side-effect in `src/js/main.js:9`.
- `rolldown@1.0.1` (MIT) - Bundler embedded in Vite 8 (replaces Rollup).
- `lightningcss@1.32.0` (MPL-2.0) - CSS processing inside the Vite pipeline.

## Configuration

**Environment:**
- No `.env*` files exist. No environment variables consumed.
- All configuration is in-code (DOM-driven UI parameters via `lil-gui` and HTML buttons).

**Build:**
- `package.json` scripts (lines 6-10):
  - `dev` → `vite` (starts dev server with HMR)
  - `build` → `vite build` (outputs to `dist/`)
  - `preview` → `vite preview` (serves built artifacts)
- No `vite.config.{js,ts,mjs}` file exists — Vite runs with defaults. The build artifacts in `dist/` confirm a default flat-asset output (`dist/assets/index-*.css` and `dist/assets/index-*.js`).
- No `tsconfig.json`, no `.eslintrc*`, no `.prettierrc*`, no `biome.json` — no linter/formatter configured.
- `.gitignore` (29 lines) excludes `node_modules`, `dist`, `dist-ssr`, logs, common editor files, and a `vite-dev.pid` temporary file.

**Public Assets:**
- `public/favicon.svg` - Browser tab icon (Vite serves `/public/*` at site root).
- `public/icons.svg` - SVG icon sprite (referenced from HUD or styling).
- `src/assets/hero.png` - Bundled image asset.
- `src/assets/javascript.svg`, `src/assets/vite.svg` - Bundled SVGs.
- `index.html` `<link rel="icon">` uses an inline data URI containing a ☀️ emoji (line 5), so the SVG in `public/` is not the live favicon.

## Platform Requirements

**Development:**
- Node.js `^20.19.0 || >=22.12.0` (Vite 8 / rolldown engine constraint).
- npm (or compatible package manager). `package-lock.json` is the lockfile of record.
- Modern browser with WebGL 2.0 for running the dev server (`http://localhost:5173` by Vite default).

**Production (browser runtime):**
- WebGL 2.0 capable browser (mandatory — the renderer uses GLSL 3.00 `vec4 permute()`/`taylorInvSqrt()` patterns in `src/js/shaders.js` and Three.js `WebGLRenderer` configured for high performance in `src/js/main.js:71`).
- CSS `backdrop-filter` support for glassmorphism panels (`src/style.css:32-36`, `src/style.css:48-50`).
- Display capable of HDR-tone-mapped output (`THREE.ACESFilmicToneMapping` set in `src/js/main.js:74`).
- Internet access to `https://fonts.googleapis.com` and `https://fonts.gstatic.com` for the Orbitron and Outfit web fonts (`index.html:13-15`).
- No backend server, no API endpoints, no database — fully static deployment.

---

*Stack analysis: 2026-05-20*
