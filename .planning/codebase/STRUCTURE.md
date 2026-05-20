# Codebase Structure

**Analysis Date:** 2026-05-20

## Directory Layout

```
Projeto Render 3d Sol Webgl2/
├── .git/                          # Git repository data
├── .gitignore                     # node_modules, dist, logs, editor cruft
├── .planning/                     # GSD planning artifacts (this map lives here)
│   └── codebase/                  # ARCHITECTURE.md, STRUCTURE.md, etc.
├── dist/                          # Vite production build output (gitignored)
│   ├── assets/
│   │   ├── index-BLmR4hoz.css     # Bundled & minified style.css
│   │   └── index-DjpY_CxB.js      # Bundled & minified JS (three + lil-gui + app)
│   ├── favicon.svg                # Copied from public/
│   ├── icons.svg                  # Copied from public/
│   └── index.html                 # Rewritten entry with asset hashes
├── index.html                     # HTML entry point (canvas, HUD, control panel, loader)
├── node_modules/                  # npm dependencies (gitignored)
├── package.json                   # name, scripts (dev/build/preview), three + lil-gui deps
├── package-lock.json              # npm lockfile
├── public/                        # Vite static assets (copied verbatim to dist/)
│   ├── favicon.svg                # Browser tab icon
│   └── icons.svg                  # SVG sprite (not currently referenced from code)
└── src/
    ├── assets/                    # Bundleable assets (currently unreferenced Vite scaffold leftovers)
    │   ├── hero.png
    │   ├── javascript.svg
    │   └── vite.svg
    ├── js/                        # Application source code
    │   ├── main.js                # Orchestrator + render loop + HUD bindings (1,228 lines)
    │   ├── sun.js                 # Sun class — 3 meshes + lens flares + 5 preset slots (530 lines)
    │   ├── shaders.js             # GLSL helpers + 4 shader programs (544 lines)
    │   ├── starfield.js           # 6000-point procedural starfield factory (79 lines)
    │   └── stellarClassifier.js   # MK parser + Kelvin→RGB + HYG catalog (404 lines)
    └── style.css                  # Glassmorphism HUD, 3D labels, loader styles (615 lines)
```

## Directory Purposes

**`./` (project root):**
- Purpose: Vite project root. Vite treats `index.html` here as the implicit entry.
- Contains: `package.json`, `index.html`, `.gitignore`, `package-lock.json`.
- Key files: `index.html` (HTML scaffold + HUD markup + loader), `package.json` (deps + scripts).

**`src/`:**
- Purpose: All hand-written source code (JS + CSS).
- Contains: `style.css` (top-level stylesheet) and the `js/` subdirectory.
- Key files: `src/style.css` (615 lines, imported by `src/js/main.js:9` as `import '../style.css'`).

**`src/js/`:**
- Purpose: All JavaScript modules. Flat — no further nesting.
- Contains: 5 ES-module files.
- Key files:
  - `src/js/main.js` — single entry, orchestrator.
  - `src/js/sun.js` — `Sun` class (NEW file extracted from `main.js` in this revision).
  - `src/js/shaders.js` — GLSL programs as exported template-literal strings.
  - `src/js/starfield.js` — `createStarfield(numStars)` factory.
  - `src/js/stellarClassifier.js` — `parseMKClassification`, `lookupHYGStar`, `kelvinToColorGrading`, `HYG_DATABASE`.

**`src/assets/`:**
- Purpose: Bundleable static assets resolved via `import` (Vite copies + hashes them).
- Contains: `hero.png`, `javascript.svg`, `vite.svg` — currently *unreferenced* by any source file. Likely leftover from the initial `npm create vite` scaffold.
- Generated: No.
- Committed: Yes.

**`public/`:**
- Purpose: Vite static assets served at the site root verbatim (no hashing, no transform).
- Contains: `favicon.svg`, `icons.svg`.
- Generated: No.
- Committed: Yes.

**`dist/`:**
- Purpose: Vite production build output (`vite build`).
- Contains: Hashed bundles, copied `public/` assets, rewritten `index.html`.
- Generated: Yes (by `npm run build`).
- Committed: No (in `.gitignore` line 11).

**`.planning/codebase/`:**
- Purpose: GSD codebase-map artifacts. This directory holds the docs you are reading.
- Contains: `ARCHITECTURE.md`, `STRUCTURE.md`, (and potentially `STACK.md`, `INTEGRATIONS.md`, `CONVENTIONS.md`, `TESTING.md`, `CONCERNS.md` when other map agents run).
- Generated: Yes (by `/gsd:map-codebase`).
- Committed: Yes.

**`node_modules/`:**
- Purpose: npm-installed dependency tree.
- Generated: Yes (by `npm install`).
- Committed: No (`.gitignore`).

## Key File Locations

**Entry Points:**
- `index.html`: HTML scaffold; mounts `<div id="canvas-container">`, `#space-hud`, `#control-panel`, `#comparison-labels-container`, `#loader`; loads `/src/js/main.js` as a module on line 154.
- `src/js/main.js:1228`: `window.onload = init;` — the single JS entry.

**Configuration:**
- `package.json`: scripts (`dev`/`build`/`preview`), dependencies (`three`, `lil-gui`), devDependency (`vite`).
- `.gitignore`: standard Node + Vite ignores.
- No `vite.config.*`, no `tsconfig.json`, no `.eslintrc.*`, no `.prettierrc`, no `.nvmrc`, no `.env*` files present.

**Core Logic:**
- `src/js/main.js`: render loop (`animate`, lines 1081-1214), `init` (60-153), mode lifecycle (`enterComparisonMode` 287-394, `exitComparisonMode` 396-457, `startCinematicFlyby` 638-656, `stopCinematicFlyby` 658-673), cinematic camera (`updateCinematicCamera` 675-759), HUD bindings (`setupHUDBindings` 762-967), GUI mount (`setupGUI` 174-284), auto-exposure (`updateAutoExposure` 1006-1042), telemetry (`updateTelemetry` 1045-1063, `updatePhysicalHUD` 1066-1078), label projection (`updateHTML3DLabels` 588-635).
- `src/js/sun.js`: `Sun` class (lines 95-530) with `constructor` (143-166), `initCore` (169-191), `initProminences` (194-218), `initCorona` (221-242), `initLensFlares` (245-250), `updateLensFlares` (252-307), `update` (310-348), `getPresetDefaultSettings` (351-456), `applyCurrentParams` (459-494), `resetCurrentPresetToDefault` (497-501), `setPreset` (504-529). Module-private texture helpers at lines 13-93.
- `src/js/shaders.js`: `simplexNoiseGLSL` (4-76), `blackbodyGLSL` (80-132), `valueNoiseGLSL` (135-179), `surfaceVertexShader`/`surfaceFragmentShader` (182-306), `prominenceVertexShader`/`prominenceFragmentShader` (309-412), `coronaVertexShader`/`coronaFragmentShader` (415-495), `starfieldVertexShader`/`starfieldFragmentShader` (498-544).
- `src/js/starfield.js`: `createStarfield(numStars)` (9-79).
- `src/js/stellarClassifier.js`: `kelvinToColorGrading` (4-41), `parseMKClassification` (47-327), `HYG_DATABASE` (329-348), `lookupHYGStar` (350-404).

**Testing:**
- None. No `tests/`, no `__tests__/`, no `*.test.*` or `*.spec.*` files. No test runner in `package.json`.

**Build Output:**
- `dist/index.html`, `dist/assets/index-*.js`, `dist/assets/index-*.css`, plus copies of `public/` files.

## Naming Conventions

**Files:**
- JavaScript modules: `camelCase.js` — `main.js`, `sun.js`, `shaders.js`, `starfield.js`, `stellarClassifier.js`.
- Stylesheet: `style.css` (lowercase, no prefix).
- HTML: `index.html` (lowercase).
- Class-bearing modules use the singular noun (`sun.js` exports `Sun`).
- Factory-bearing modules use the noun matching the produced object (`starfield.js` exports `createStarfield` returning a `THREE.Points`).
- No `index.js` barrel files anywhere.

**Directories:**
- All lowercase (`src`, `js`, `assets`, `public`, `dist`).
- No `components/`, `services/`, `utils/`, `lib/` — flat directory style.

**JavaScript identifiers:**
- Classes: `PascalCase` — `Sun` (`src/js/sun.js:95`).
- Functions: `camelCase` — `createStarfield`, `parseMKClassification`, `lookupHYGStar`, `kelvinToColorGrading`, `updateComparisonLayout`, `setupHUDBindings`, `setupGUI`, `enterComparisonMode`, `focusOnComparisonStar`.
- Module-scope state: `camelCase` — `isFlying`, `flightTargetPos`, `comparisonScaleMode`, `activeFocusedStar`, `cinematicTime`.
- Module-scope constants: `UPPER_SNAKE_CASE` — `HYG_DATABASE` (`src/js/stellarClassifier.js:329`).
- DOM-element references: `camelCase` matching the kebab-case HTML ID — `valDistance` ↔ `#val-distance`, `valVelocity` ↔ `#val-velocity`, `hudStarClass` ↔ `#hud-star-class`, `loadProgressBar` ↔ `#load-progress`, `loaderScreen` ↔ `#loader`.

**GLSL uniforms:**
- All uniforms are `uPascalCase` — `uTime`, `uHighTemp`, `uLowTemp`, `uNoiseScale`, `uConvectionSpeed`, `uSunspotThreshold`, `uPlageIntensity`, `uColorGrading`, `uLimbExponent`, `uLimbBase`, `uPlageGrading`, `uProminenceSpeed`, `uProminenceHeight`, `uBaseTemp`, `uEdgeFade`, `uPolarJetIntensity`, `uScale`, `uTemp`, `uCoronaSpeed`, `uCoronaDensity`.
- Vertex shader varyings are `vCamelCase` — `vPosition`, `vNormal`, `vViewDir`, `vLocalPosition`, `vDisplacement`, `vPolarFactor`, `vUv`, `vColor`, `vPhase`.
- Vertex attributes are `aCamelCase` — `aSize`, `aColor`, `aPhase` (used by `starfield`).

**CSS:**
- IDs: kebab-case scoped to their semantic role — `#canvas-container`, `#space-hud`, `#control-panel`, `#gui-container`, `#comparison-labels-container`, `#comparison-focus-grid`, `#comparison-focus-panel`, `#comparison-scale-toggle-container`, `#btn-cinematic-flyby`, `#btn-comparison-mode`, `#btn-preset-sol`, `#btn-preset-red`, `#btn-preset-blue`, `#btn-preset-white`, `#btn-apply-custom-class`, `#input-custom-class`, `#btn-scale-visual`, `#btn-scale-real`, `#btn-nav-far`, `#btn-nav-orbit`, `#btn-nav-close`, `#hud-star-class`, `#val-distance`, `#val-velocity`, `#val-temperature`, `#val-mass`, `#val-radius`, `#val-luminosity`, `#val-rotation-velocity`, `#loader`, `#load-progress`, `#toggle-panel`.
- Classes: kebab-case — `.glass-panel`, `.hud-header`, `.hud-label`, `.hud-status-indicator`, `.pulse-dot`, `.hud-readings`, `.reading-box`, `.reading-title`, `.reading-value`, `.hud-section-title`, `.preset-buttons`, `.preset-btn`, `.class-code`, `.class-name`, `.autopilot-buttons`, `.nav-btn`, `.panel-header`, `.panel-footer`, `.loader-content`, `.solar-eclipse-loader`, `.loader-corona`, `.loader-core`, `.loader-text`, `.loader-progress`, `.progress-bar`, `.star-label-3d`, `.label-card`, `.label-glow-line`, `.label-name`, `.label-details`, `.focus-star-btn`.
- Modifier classes: appended with semantic word, no dash-separator BEM (e.g. `.preset-btn.active`, `.nav-btn.warning`, `.reading-value.yellow-dwarf`, `.star-label-3d.visible`, `.star-label-3d.active-focus`).
- Data attributes for behavior: `data-preset` (sol/redgiant/bluesuper/whitedwarf) and `data-distance` (far/orbit/close).

## Where to Add New Code

**New stellar preset (e.g. "neutron star"):**
- Add a `case 'neutronstar':` block to `Sun.getPresetDefaultSettings` (`src/js/sun.js:351-456`).
- Add a `neutronstar:` key to the `presetStates` initializer in the `Sun` constructor (`src/js/sun.js:148-154`).
- Add the HUD button in `index.html` (`.preset-buttons` block, after the existing 4) with `data-preset="neutronstar"`.
- Add an active-state CSS rule in `src/style.css` (mirror the pattern at lines 180-183) and a `.reading-value.neutron-star` color class (mirror line 132).
- Update the `setupHUDBindings()` preset-button switch in `src/js/main.js:790-803` to set the HUD class code.

**New cinematic flyby shot:**
- Extend the timeline in `updateCinematicCamera()` (`src/js/main.js:675-759`) with a new `else if (cinematicTime < N)` branch.
- Update the final `else { stopCinematicFlyby(); }` cutoff to the new total duration.
- If per-star choreography is needed, mirror the in-`animate()` block at `src/js/main.js:1146-1184`.

**New shader (or shader variant):**
- Append the GLSL program as an `export const xxxVertexShader = \`...\`` / `xxxFragmentShader` to `src/js/shaders.js`.
- Reuse helpers via `${simplexNoiseGLSL}` / `${valueNoiseGLSL}` / `${blackbodyGLSL}` interpolation.
- Import + use in `src/js/sun.js` (or a new file) by constructing a `new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms })`.

**New star in the comparison lineup:**
- Add an entry to the `lineupData` array in `enterComparisonMode()` (`src/js/main.js:318-332`).
- If the query is not yet in the HYG catalog, add it to `HYG_DATABASE` (`src/js/stellarClassifier.js:329-348`).
- If indexed by position in the cinematic Take 2 (`src/js/main.js:1156, 1166, 1176`), update those hard-coded indices.

**New HUD telemetry field:**
- Add `<div class="reading-box">` markup to `index.html` inside `.hud-readings` (lines 28-61).
- Add a module-scope `getElementById` reference at the top of `src/js/main.js:48-57`.
- Update `updatePhysicalHUD()` (`src/js/main.js:1066-1078`) or `updateTelemetry()` (`src/js/main.js:1045-1063`) to write the new value.

**New GUI control:**
- Add a `fFolder.add(sun.params, 'newParam', min, max, step).name('Label').onChange(onGUIParameterChange);` call inside `setupGUI()` (`src/js/main.js:174-284`).
- Ensure the corresponding shader uniform is registered in `Sun.initCore`/`initProminences`/`initCorona` (`src/js/sun.js:169-242`) and read in `applyCurrentParams()` (`src/js/sun.js:459-494`).

**New utility/helper that doesn't fit elsewhere:**
- Create a new file in `src/js/` (flat, no nested subdirectories).
- Export named functions (no default exports — none used in this codebase).
- Import via relative path `./newFile.js` from `main.js` or another sibling.

## Special Directories

**`public/`:**
- Purpose: Vite static assets served at site root, copied verbatim to `dist/` on build.
- Generated: No.
- Committed: Yes.
- Currently holds `favicon.svg` and `icons.svg`. `favicon.svg` is referenced by the inline SVG `<link rel="icon">` at `index.html:5` (which embeds a different emoji-based icon, not the file in `public/`); `icons.svg` is not referenced anywhere in source.

**`src/assets/`:**
- Purpose: Vite-pipelined assets (typically imported as URLs from JS — `import heroPng from './assets/hero.png'`).
- Generated: No.
- Committed: Yes.
- Currently contains `hero.png`, `javascript.svg`, `vite.svg` — none of which are imported by any JS file. These are leftover Vite scaffold artifacts and can be deleted without affecting the build.

**`dist/`:**
- Purpose: Production build output.
- Generated: Yes (`npm run build` / `vite build`).
- Committed: No (`.gitignore`).

**`node_modules/`:**
- Purpose: npm dependency tree.
- Generated: Yes (`npm install`).
- Committed: No (`.gitignore`).

**`.planning/`:**
- Purpose: GSD planning workflow artifacts (codebase maps, phase plans, etc.).
- Generated: Yes (by the GSD command suite).
- Committed: Yes.

---

*Structure analysis: 2026-05-20*
