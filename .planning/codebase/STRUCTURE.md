# Codebase Structure

**Analysis Date:** 2026-05-20

## Directory Layout

```
Projeto Render 3d Sol Webgl2/
├── index.html                  # Vite entry HTML — DOM scaffold, loads /src/js/main.js as module
├── package.json                # ESM project ("type": "module"), Vite scripts, three + lil-gui deps
├── package-lock.json           # Lockfile (committed)
├── node_modules/               # npm install output (not committed; present locally)
├── public/                     # Vite static-assets root (served at /)
│   ├── favicon.svg             # SVG favicon (not actually wired — index.html uses inline data: URI)
│   └── icons.svg               # SVG icon sheet (unused at runtime)
├── src/                        # Application source
│   ├── style.css               # Global CSS (HUD, control panel, loader, glassmorphism)
│   ├── assets/                 # Sample/legacy bundler-managed assets (not used at runtime)
│   │   ├── hero.png
│   │   ├── javascript.svg
│   │   └── vite.svg
│   └── js/                     # All application JavaScript
│       ├── main.js             # Orchestrator: scene/camera/renderer/composer/animate()/GUI/HUD
│       ├── sun.js              # `Sun` class — core/prominence/corona/lens-flare composite
│       ├── shaders.js          # GLSL vertex/fragment shader sources (template-string exports)
│       ├── starfield.js        # `createStarfield()` factory → THREE.Points twinkling stars
│       └── stellarClassifier.js # `parseMKClassification`, `lookupHYGStar`, `kelvinToColorGrading`
└── dist/                       # Vite build output (committed for static hosting)
    ├── index.html              # Minified HTML referencing hashed assets
    └── assets/
        ├── index-Cc6hYQRo.js   # Bundled JS (hash will change between builds)
        └── index-BZJ_aShM.css  # Bundled CSS
```

## Directory Purposes

**Project root:**
- Purpose: Vite's default project root. `index.html` is the entry point Vite uses for both `dev` and `build`.
- Contains: HTML entry, package manifest, lockfile, and the four working folders (`src/`, `public/`, `dist/`, `node_modules/`).
- Key files: `index.html`, `package.json`.

**`public/`:**
- Purpose: Vite's static-assets directory. Files here are copied verbatim into the build output at the root URL (`/`).
- Contains: SVG assets (`favicon.svg`, `icons.svg`).
- Note: Despite the project description mentioning shaders/textures in `public/`, this folder currently holds only two SVG files. No GLSL files, no PNG textures, no HDR maps. All shaders live in `src/js/shaders.js` and all textures are procedural (canvas-rendered in `src/js/sun.js`).

**`src/`:**
- Purpose: Application source root.
- Contains: One stylesheet, one nested `js/` folder, and a `assets/` folder of Vite-scaffold leftovers.
- Key files: `src/style.css` (536 lines), everything under `src/js/`.

**`src/js/`:**
- Purpose: All application JavaScript modules (ESM).
- Contains: Five files — one orchestrator (`main.js`), one composite class (`sun.js`), one factory (`starfield.js`), one helper module (`stellarClassifier.js`), one shader-source module (`shaders.js`).
- Key files: `src/js/main.js` is the script-tag entry; everything else is imported from it.

**`src/assets/`:**
- Purpose: Vite default-template scaffold assets. Not imported by any runtime code.
- Contains: `hero.png`, `javascript.svg`, `vite.svg`.
- Generated: No.
- Committed: Yes.
- Note: Safe to delete — nothing in `src/js/` references these files.

**`dist/`:**
- Purpose: Vite build output (`npm run build`).
- Contains: Minified `index.html` plus hashed JS/CSS in `dist/assets/`.
- Generated: Yes (`vite build`).
- Committed: Yes (currently checked in; check `.gitignore` policy before regenerating).

**`node_modules/`:**
- Purpose: npm dependency cache.
- Generated: Yes (`npm install`).
- Committed: No (standard).

## Key File Locations

**Entry Points:**
- `index.html`: HTML entry (Vite root). Loads stylesheet via JS import (line 110 of `index.html` plus `import '../style.css'` at `src/js/main.js:9`).
- `src/js/main.js`: JS entry. `window.onload = init` at `src/js/main.js:424`.

**Configuration:**
- `package.json`: Dependencies, scripts (`dev`, `build`, `preview`), `"type": "module"`.
- No `vite.config.*`, no `tsconfig.json`, no `.eslintrc`, no `.prettierrc`, no `.nvmrc`. Vite uses default conventions.

**Core Logic:**
- `src/js/main.js`: Scene setup (`init`, `src/js/main.js:37-109`), render loop (`animate`, `src/js/main.js:369-410`), GUI mounting (`setupGUI`, `src/js/main.js:119-178`), HUD event bindings (`setupHUDBindings`, `src/js/main.js:181-306`), auto-exposure/telemetry helpers.
- `src/js/sun.js`: `Sun` class with `initCore`, `initProminences`, `initCorona`, `initLensFlares`, `updateLensFlares`, `update`, `setPreset`. Procedural canvas-texture helpers (`createGlowTexture`, `createRingTexture`, `createHexagonTexture`) at module top.
- `src/js/shaders.js`: GLSL shaders exported as template strings — `surfaceVertexShader` / `surfaceFragmentShader` / `prominenceVertexShader` / `prominenceFragmentShader` / `coronaVertexShader` / `coronaFragmentShader` / `starfieldVertexShader` / `starfieldFragmentShader`, plus shared helpers `simplexNoiseGLSL` / `blackbodyGLSL` / `valueNoiseGLSL`.
- `src/js/starfield.js`: One exported function `createStarfield(numStars = 8000)`.
- `src/js/stellarClassifier.js`: `parseMKClassification`, `lookupHYGStar`, `kelvinToColorGrading`, plus the `HYG_DATABASE` lookup constant (15 named stars).

**Styling:**
- `src/style.css`: All visual styling — glassmorphism panels, HUD layout, preset button skins, control panel collapse animation, loader screen.

**Testing:**
- Not present. No test framework, no `*.test.*` or `*.spec.*` files, no `__tests__` directory.

**Build artifacts:**
- `dist/index.html`, `dist/assets/index-*.js`, `dist/assets/index-*.css`.

## Naming Conventions

**Files:**
- Pattern: `camelCase.js` for multi-word module names (`stellarClassifier.js`). Single-word modules use lowercase (`main.js`, `sun.js`, `shaders.js`, `starfield.js`).
- HTML/CSS entry files use lowercase (`index.html`, `style.css`).

**Directories:**
- Pattern: Lowercase, single-word where possible (`src`, `public`, `dist`, `js`, `assets`).

**JavaScript identifiers:**
- Classes: `PascalCase` (`Sun`).
- Functions: `camelCase` (`createStarfield`, `parseMKClassification`, `lookupHYGStar`, `kelvinToColorGrading`, `setupGUI`, `setupHUDBindings`, `updateAutoExposure`, `updateTelemetry`, `updateLensFlares`, `applyCustomClass`).
- Variables: `camelCase` (`scene`, `camera`, `renderer`, `composer`, `bloomPass`, `clock`, `timeSpeed`, `flightTargetPos`, `lastTelemetryUpdateTime`).
- Module-level constants: `UPPER_SNAKE` for tables (`HYG_DATABASE` at `src/js/stellarClassifier.js:193`) but `camelCase` for shader-string exports (`simplexNoiseGLSL`, `valueNoiseGLSL`, etc.).
- Boolean flags: descriptive `is`/`use` prefixes (`isFlying`, `usePostProcessing`).

**GLSL uniforms (Sun materials):**
- All shader uniforms are `u`-prefixed: `uTime`, `uHighTemp`, `uLowTemp`, `uNoiseScale`, `uConvectionSpeed`, `uSunspotThreshold`, `uPlageIntensity`, `uColorGrading`, `uProminenceHeight`, `uProminenceSpeed`, `uBaseTemp`, `uEdgeFade`, `uScale`, `uTemp`, `uCoronaSpeed`, `uCoronaDensity` (`src/js/sun.js:134-191`, declared at the top of every shader in `src/js/shaders.js`).

**GLSL varyings:**
- All varyings are `v`-prefixed: `vPosition`, `vNormal`, `vViewDir`, `vLocalPosition`, `vDisplacement`, `vUv`, `vColor`, `vPhase` (`src/js/shaders.js`).

**GLSL attributes (starfield only):**
- Custom attributes are `a`-prefixed: `aSize`, `aColor`, `aPhase` (`src/js/shaders.js:475-477`, `src/js/starfield.js:63-65`).

**DOM ids:**
- Kebab-case: `canvas-container`, `space-hud`, `control-panel`, `toggle-panel`, `gui-container`, `load-progress`, `val-distance`, `val-velocity`, `val-temperature`, `hud-star-class`, `input-custom-class`, `btn-apply-custom-class`, `btn-preset-sol` / `btn-preset-red` / etc., `btn-nav-far` / etc.

**DOM classes:**
- Kebab-case for general styling (`glass-panel`, `reading-box`, `reading-title`, `reading-value`, `preset-btn`, `nav-btn`, `panel-header`, `panel-footer`, `loader-content`).
- Stellar-type modifiers: `yellow-dwarf`, `red-giant`, `blue-super`, `white-dwarf` (applied/removed by `src/js/main.js:200-213` and `:285-295`).

**`data-` attributes:**
- `data-preset` (`sol` | `redgiant` | `bluesuper` | `whitedwarf`) on preset buttons.
- `data-distance` (`far` | `orbit` | `close`) on autopilot buttons.

## Where to Add New Code

**New stellar feature (additional mesh layer):**
- Implementation: Add `init<Feature>()` method to `Sun` in `src/js/sun.js`, store the new mesh on `this.<feature>Mesh` and the material on `this.<feature>Material`, push the mesh onto `this.group`.
- Shaders: Add `<feature>VertexShader` and `<feature>FragmentShader` exports to `src/js/shaders.js`; import them at the top of `sun.js`.
- Per-frame updates: Add a `this.<feature>Material.uniforms.uTime.value = time` line inside `Sun.update()`.
- Preset overrides: Extend the four preset blocks inside `Sun.setPreset()` (`src/js/sun.js:284-364`) with the new fields and add corresponding uniform writes in the assignment block at `src/js/sun.js:380-398`.
- GUI controls: Add a new folder block inside `setupGUI()` (`src/js/main.js:119-178`) with `.onChange` callbacks that mirror the existing pattern.

**New GUI slider for an existing parameter:**
- Add the field to `Sun.params` (default value) inside the `Sun` constructor (`src/js/sun.js:101-120`).
- Wire it to the appropriate `ShaderMaterial.uniforms` entry inside the matching `init<Section>()` method.
- Add a `gui.add(sun.params, '<field>', min, max, step).onChange(() => sun.<material>.uniforms.u<Field>.value = sun.params.<field>)` line in `setupGUI()` (`src/js/main.js:119-169`).
- Add a default in every preset block of `Sun.setPreset()` and a uniform-write line in the assignment block.

**New HUD button (preset or autopilot):**
- Add a `<button>` to `#space-hud` in `index.html`, with `data-preset="<name>"` or `data-distance="<name>"` and the same class pattern (`preset-btn` or `nav-btn`).
- Extend the corresponding `switch` (presets via `Sun.setPreset()` in `src/js/sun.js:284-364`; autopilot targets via the `if (distType === ...)` block in `src/js/main.js:228-236`).
- Update the HUD-class branching in `setupHUDBindings()` (`src/js/main.js:200-213`).

**New named star in HYG database:**
- Add an entry to `HYG_DATABASE` in `src/js/stellarClassifier.js:193-210` with shape `{ name, spect, temp, lum }`. The key is the uppercased query (strip non-alphanumeric). Real radius is derived from `temp` + `lum` by Stefan-Boltzmann.

**New shader helper (e.g., curl noise, fractal noise variants):**
- Add a `export const <name>GLSL = \`...\`;` block in `src/js/shaders.js` near the existing helpers (top of file).
- Inject into consumer shaders via `${<name>GLSL}` template interpolation, following the pattern at `src/js/shaders.js:214`.

**New post-processing pass:**
- Add the pass between `bloomPass` and `outputPass` inside `init()` at `src/js/main.js:86-89`. Update `onWindowResize()` if the pass has a `setSize` requirement (`src/js/main.js:412-421`).

**New telemetry readout:**
- Add a `.reading-box` to `#space-hud` in `index.html` (mirror the `#hud-distance` block).
- Cache the DOM ref alongside `valDistance` / `valVelocity` / `valTemperature` at the top of `src/js/main.js:29-34`.
- Update it inside `updateTelemetry()` (`src/js/main.js:351-366`).

**Style changes:**
- Edit `src/style.css` (single 536-line file; no CSS modules, no SCSS, no Tailwind).

**Static assets:**
- Drop the file into `public/` for verbatim copy-through, or into `src/assets/` if you want Vite to fingerprint and bundle it (then import via `import url from '../assets/foo.png'`).

## Special Directories

**`public/`:**
- Purpose: Vite static-assets directory; contents are served at site root in dev and copied to `dist/` root in build.
- Generated: No.
- Committed: Yes.

**`dist/`:**
- Purpose: Production build output (`vite build`).
- Generated: Yes.
- Committed: Yes (currently checked in).

**`src/assets/`:**
- Purpose: Originally the Vite template's bundled-assets folder. Contains `hero.png`, `javascript.svg`, `vite.svg` — none are imported anywhere in `src/js/`.
- Generated: No.
- Committed: Yes.

**`node_modules/`:**
- Purpose: npm install cache.
- Generated: Yes.
- Committed: No.

**`.planning/codebase/`:**
- Purpose: GSD codebase-map output (this document and ARCHITECTURE.md live here).
- Generated: Yes (by `/gsd:map-codebase`).
- Committed: Project convention determines.

---

*Structure analysis: 2026-05-20*
