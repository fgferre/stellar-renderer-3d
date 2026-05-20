# Technology Stack

**Analysis Date:** 2026-05-20

## Languages

**Primary:**
- JavaScript (ES2020+, ES Modules) - All application logic in `src/js/*.js`, declared via `"type": "module"` in `package.json`
- GLSL ES 3.00 / WebGL 2 shading language - Procedural stellar shaders embedded as JavaScript template strings in `src/js/shaders.js` (520 lines)

**Secondary:**
- HTML5 - Single entry document at `index.html` (~112 lines, also rebuilt to `dist/index.html`)
- CSS3 - Single hand-written stylesheet at `src/style.css` (~536 lines), uses `backdrop-filter` glassmorphism and CSS custom properties

## Runtime

**Environment:**
- Browser (WebGL 2 capable) - Application is 100% client-side, no Node.js server runtime at production
- Node.js 20.19.0+ or 22.12.0+ - Required by Vite 8 / Rolldown 1.0.1 toolchain (`package-lock.json` lines 95, 855-856)
- Locally installed: Node v22.22.1

**Package Manager:**
- npm (inferred) - Project ships with `package-lock.json` (lockfile version 3), no `yarn.lock` or `pnpm-lock.yaml`
- Lockfile: present (`package-lock.json`, 918 lines)

## Frameworks

**Core:**
- Three.js 0.184.0 - 3D scene graph, WebGL 2 renderer, post-processing pipeline, geometry/material abstractions (`src/js/main.js:1`, `sun.js:1-2`, `starfield.js:1`, `stellarClassifier.js:1`)
- lil-gui 0.21.0 - Lightweight in-browser GUI panel mounted inside the `#gui-container` element for live parameter tweaking (`src/js/main.js:7`, `main.js:120-178`)

**Testing:**
- Not detected - No test runner, no `*.test.*` / `*.spec.*` files, no `tests/` directory

**Build/Dev:**
- Vite 8.0.13 (declared as `^8.0.12` dev dependency, resolved to 8.0.13 in lockfile) - Dev server, HMR, production bundler. No `vite.config.*` file present; runs on Vite defaults
- Rolldown 1.0.1 - Vite 8's native Rust-based bundler (replaces esbuild/Rollup); pulled in as a direct Vite dependency
- LightningCSS ^1.32.0 - Vite 8's CSS transformer (transitive dependency)
- PostCSS ^8.5.14 - CSS pipeline (transitive Vite dependency)

## Key Dependencies

**Critical:**
- `three` ^0.184.0 - Core rendering engine. Imports cover the main namespace plus four example modules:
  - `three/examples/jsm/controls/OrbitControls.js` (`src/js/main.js:2`)
  - `three/examples/jsm/postprocessing/EffectComposer.js` (`src/js/main.js:3`)
  - `three/examples/jsm/postprocessing/RenderPass.js` (`src/js/main.js:4`)
  - `three/examples/jsm/postprocessing/UnrealBloomPass.js` (`src/js/main.js:5`)
  - `three/examples/jsm/postprocessing/OutputPass.js` (`src/js/main.js:6`)
  - `three/examples/jsm/objects/Lensflare.js` (`src/js/sun.js:2`)
- `lil-gui` ^0.21.0 - Real-time control panel for the `Sun` material uniforms, bloom pass parameters, and time speed

**Infrastructure:**
- `vite` ^8.0.12 - Only declared dev dependency. Owns dev server (`npm run dev`), production build (`npm run build`), and preview (`npm run preview`)
- All other entries in `package-lock.json` (rolldown bindings, picomatch, nanoid, tinyglobby, etc.) are transitive children of Vite

## Configuration

**Environment:**
- No `.env*` files present in the repository
- No environment variables required - application is fully static client-side
- No `.nvmrc`, `.node-version`, or `.python-version` constraints (engine requirement comes implicitly from Vite/Rolldown)

**Build:**
- `package.json` - Only build manifest in the repo (18 lines):
  ```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
  ```
- Vite uses defaults: project root = repo root, entry HTML = `index.html`, JS entry = `/src/js/main.js`, public dir = `public/`, output dir = `dist/`
- No `vite.config.js` / `vite.config.ts` / `vite.config.mjs` file - all Vite behavior is convention-based
- No TypeScript config (`tsconfig.json` absent)
- No linter or formatter config (no `.eslintrc*`, `.prettierrc*`, `biome.json`)
- Build artifact verified: `dist/index.html`, `dist/assets/index-Cc6hYQRo.js` (~626 KB), `dist/assets/index-BZJ_aShM.css` (~8.3 KB)

## Platform Requirements

**Development:**
- Node.js ^20.19.0 || >=22.12.0 (enforced by Vite 8 / Rolldown 1.0.1 `engines` field)
- A WebGL 2-capable browser for testing (Chrome / Edge / Firefox / Safari, modern desktop or mobile)
- Network access for first run (Google Fonts CDN preconnect in `index.html:13-15`)

**Production:**
- Any static file host capable of serving `dist/` (no server-side code, no runtime APIs)
- Browser must support WebGL 2 (used by Three.js `WebGLRenderer` in `src/js/main.js:48`) and ES Modules (HTML loader uses `<script type="module">` at `index.html:110`)
- The runtime exercises `THREE.ACESFilmicToneMapping`, custom GLSL fragment/vertex shaders with simplex noise, additive blending, and the UnrealBloom post-processing pass - GPUs without WebGL 2 / 32-bit float texture support will fail

---

*Stack analysis: 2026-05-20*
