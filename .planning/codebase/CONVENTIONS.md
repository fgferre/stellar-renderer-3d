# Coding Conventions

**Analysis Date:** 2026-05-20

> **Note on inconsistency:** This project has no formal lint/format configuration (no `.eslintrc`, `.prettierrc`, `eslint.config.*`, or `biome.json`). Conventions documented below are inferred from observed practice in `src/js/*.js` (5 files, ~1000 lines total). Style is mostly consistent within itself, but not enforced by tooling.

## Naming Patterns

**Files:**
- All source modules use `camelCase.js` naming
- Examples: `main.js`, `sun.js`, `starfield.js`, `shaders.js`, `stellarClassifier.js`
- Single-word files use lowercase: `sun.js`, `shaders.js`
- Multi-word files use camelCase, not kebab-case or snake_case: `stellarClassifier.js`
- All JS sources live under `src/js/`; CSS sits at `src/style.css`
- Asset files use lowercase with extensions (e.g., `vite.svg`, `hero.png`)

**Classes:**
- `PascalCase` — single example: `Sun` in `src/js/sun.js:95`
- Exported as named export: `export class Sun {`

**Functions:**
- `camelCase` for all functions:
  - Top-level exported: `createStarfield`, `parseMKClassification`, `lookupHYGStar`, `kelvinToColorGrading`
  - Internal helpers: `createGlowTexture`, `createRingTexture`, `createHexagonTexture` (`src/js/sun.js:13-93`)
  - Inner / module-private: `init`, `animate`, `setupGUI`, `setupHUDBindings`, `applyCustomClass`, `updateTelemetry`, `updateAutoExposure`, `onWindowResize`, `updateLoadProgress`, `updateGUIDisplay` (`src/js/main.js`)
- Class methods are also `camelCase`: `initCore`, `initProminences`, `initCorona`, `initLensFlares`, `updateLensFlares`, `update`, `setPreset` (`src/js/sun.js`)

**Variables:**
- `camelCase` for locals, module-level state, parameters, and object keys
- Module-level mutable state (e.g., `scene`, `camera`, `renderer`, `controls`, `gui`, `sun`, `starfield`, `composer`, `bloomPass`, `clock`, `timeSpeed`, `lastTelemetryUpdateTime`, `usePostProcessing`, `isFlying`, `flightTargetPos`, `flightTargetLookAt`, `flightSpeed`) is declared with `let` near the top of `src/js/main.js:15-26`
- DOM element handles are `camelCase` `const` with `val-`/`hud-` prefixes from the underlying DOM IDs: `valDistance`, `valVelocity`, `valTemperature`, `hudStarClass`, `loadProgressBar`, `loaderScreen` (`src/js/main.js:29-34`)
- DOM IDs themselves use `kebab-case` (`val-distance`, `hud-star-class`, `canvas-container`, `control-panel`, `gui-container`, `load-progress`, `loader`, `input-custom-class`, `btn-apply-custom-class`, `toggle-panel`)
- CSS class names use `kebab-case` (`.glass-panel`, `.hud-label`, `.pulse-dot`, `.preset-btn`, `.nav-btn`, `.reading-value`, `.yellow-dwarf`, `.red-giant`, etc.)

**Constants:**
- Top-level exported "constants" still use `camelCase` for shader strings (e.g., `surfaceVertexShader`, `surfaceFragmentShader`, `simplexNoiseGLSL`, `blackbodyGLSL`, `valueNoiseGLSL`) — not `SCREAMING_SNAKE_CASE`
- Only exception: `HYG_DATABASE` in `src/js/stellarClassifier.js:193` uses `SCREAMING_SNAKE_CASE` (the lone genuine constant lookup table)

**GLSL uniforms / attributes (shader-side):**
- Uniforms use the `u`-prefix + `PascalCase` convention: `uTime`, `uHighTemp`, `uLowTemp`, `uNoiseScale`, `uConvectionSpeed`, `uSunspotThreshold`, `uPlageIntensity`, `uColorGrading`, `uProminenceHeight`, `uProminenceSpeed`, `uBaseTemp`, `uEdgeFade`, `uScale`, `uTemp`, `uCoronaSpeed`, `uCoronaDensity`
- Custom attributes use the `a`-prefix: `aSize`, `aColor`, `aPhase` (`src/js/shaders.js:474-477`)
- Varyings use the `v`-prefix: `vPosition`, `vNormal`, `vViewDir`, `vLocalPosition`, `vDisplacement`, `vUv`, `vColor`, `vPhase`
- This is the standard Three.js shader convention and it is applied uniformly across all 4 shader pairs

## Code Style

**Variable declarations:**
- 100% `let` / `const` — **no `var` in the codebase** (0 occurrences across `src/`)
- 140 `let`/`const` declarations total
- `let` is reserved for genuinely mutable references (module-level state, loop counters, conditionally-reassigned variables)
- `const` is the default for object handles, even when the object is mutated (e.g., `const geometry = new THREE.BufferGeometry();` followed by `geometry.setAttribute(...)` in `src/js/starfield.js`)

**Function form:**
- 17 traditional `function fnName()` declarations vs. 11 arrow functions
- **Traditional `function` declarations are used for:**
  - Module-level functions (`init`, `animate`, `setupGUI`, `setupHUDBindings`, `updateTelemetry`, etc.)
  - Exported helpers (`createStarfield`, `parseMKClassification`, `kelvinToColorGrading`, `lookupHYGStar`)
  - Procedural texture generators (`createGlowTexture`, `createRingTexture`, `createHexagonTexture`)
- **Arrow functions are used for:**
  - Event handler callbacks: `btn.addEventListener('click', () => { ... })`
  - `forEach` / array iteration: `presetButtons.forEach(btn => { ... })`
  - GUI `onChange` callbacks: `.onChange(() => sun.coreMaterial.uniforms.uHighTemp.value = sun.params.highTemp)`
  - Short timeouts: `setTimeout(() => { loaderScreen.classList.add('fade-out'); }, 600);`
- Single-statement arrow callbacks omit braces; multi-statement use `{ ... }` blocks
- A nested `function applyCustomClass()` inside `setupHUDBindings` (`src/js/main.js:243`) uses a traditional declaration because it's called from two places (button click + Enter keydown), suggesting traditional `function` is preferred when reuse / hoisting matters

**Semicolons:**
- Semicolons are **always used** — 1041 line-ending semicolons across `src/`, no ASI reliance
- All statements terminate with `;`, including the last statement before `}` blocks

**Quotes:**
- **Single quotes** are the default for string literals (203 single-quote pairs vs. very few double quotes outside of HTML/CSS attribute contexts)
- Template literals (`` ` ``) are used for:
  - String interpolation: `` `${pct}%` ``, `` `${distanceAU.toFixed(3)} AU` ``, `` `${currentSpeed.toFixed(2)} km/s` ``
  - Embedded GLSL shader source (entire `shaders.js` is template literals)
- Double quotes appear only inside GLSL/CSS string content, JSON, and HTML attributes

**Indentation:**
- **2 spaces** consistently across all JS, HTML, CSS, and GLSL source
- No tabs observed
- GLSL shader bodies indented with 2 spaces inside backtick template literals
- Closing braces aligned with the opening statement

**Line length:**
- No strict limit observed; some lines exceed 100 characters, particularly:
  - Long `.onChange(...)` GUI callbacks in `src/js/main.js:127-132`
  - Inline `LensflareElement` constructions in `src/js/sun.js:249-260`
- Multi-line constructor arguments are common when they improve readability (e.g., `UnrealBloomPass` arguments in `src/js/main.js:77-82`)

**Braces:**
- K&R / 1TBS style: opening brace on the same line as the statement
- `if`/`else` braces always used for multi-line bodies
- Some single-statement `if` branches omit braces: `if (!rawVal) return;` (`src/js/main.js:245`), `if (!match) return null;` (`src/js/stellarClassifier.js:50`)
- This mix is allowed but not enforced

**Spacing:**
- Spaces around binary operators (`a + b`, `i < 60.0`)
- Spaces inside object literal braces: `{ value: 0 }` (Three.js uniform convention)
- No space before function-call parens: `Math.floor(color.r * 255)`
- Space after keywords: `if (...)`, `for (...)`, `function name(...)`

**Formatting:**
- Tool used: **None configured.** No Prettier, ESLint, EditorConfig, or Biome found.
- No `.editorconfig`, no `lint`/`format` npm scripts in `package.json`
- Style enforcement relies entirely on developer discipline

**Linting:**
- Tool used: **None.** No ESLint or equivalent.
- Implication: invalid JS will be caught only at runtime in the browser (or by Vite during build for syntax-level issues).

## Import Organization

**Order observed in `src/js/main.js:1-12`:**
1. External / vendor packages first: `import * as THREE from 'three';`
2. Three.js subpath imports (controls, post-processing, examples): `OrbitControls`, `EffectComposer`, `RenderPass`, `UnrealBloomPass`, `OutputPass`
3. Other third-party libraries: `import { GUI } from 'lil-gui';`
4. **Blank line separator**
5. CSS side-effect imports: `import '../style.css';`
6. Internal modules using **relative paths**: `import { Sun } from './sun.js';`, `import { createStarfield } from './starfield.js';`, `import { parseMKClassification, lookupHYGStar } from './stellarClassifier.js';`

**Import style:**
- Named imports with destructuring: `import { Lensflare, LensflareElement } from 'three/examples/jsm/objects/Lensflare.js';`
- Namespace import only for Three.js itself: `import * as THREE from 'three';` — never for project modules
- **Explicit `.js` extension required** on relative imports (ESM strict mode in Node-style resolvers); all 4 internal imports include `.js`
- No default imports observed for project modules; everything is named export / named import

**Path Aliases:**
- No path aliases configured. Only relative paths (`./`, `../`) and bare package specifiers (`three`, `lil-gui`) are used.
- `vite.config.*` is absent — Vite's default config is in use.

**Module pattern:**
- `package.json` declares `"type": "module"` → all `.js` files are ESM
- No CommonJS (`require`, `module.exports`) anywhere in `src/`
- Every internal module uses `export` for its public surface (functions, classes, constants)
- No barrel files (`index.js`) — modules are imported directly by name

## Error Handling

**Observed pattern: minimal / optimistic.**

- **Zero `try`/`catch` blocks** in the entire `src/` tree
- **Zero `throw new ...` statements**
- **Zero `console.error` / `console.warn` / `console.log` calls** (no logging at all)
- **No `Promise.catch`, no `.then(..., reject)` handlers, no `window.onerror`**

**The few defensive checks that do exist:**
- Guard returns for missing input:
  - `if (!rawVal) return;` — empty custom-class input (`src/js/main.js:245`)
  - `if (!match) return null;` — regex parse failure (`src/js/stellarClassifier.js:50`)
  - `return null;` at the end of `lookupHYGStar` when the name isn't in the HYG table (`src/js/stellarClassifier.js:235`)
- Null-coalescing for optional regex groups: `const subclass = match[2] !== '' ? parseInt(match[2], 10) : 5;` (`src/js/stellarClassifier.js:53`)
- Nullish DOM checks before binding: `if (customBtn && customInput) { ... }` (`src/js/main.js:298`)
- Element-presence check before writing: `if (loadProgressBar) { ... }` (`src/js/main.js:113`)
- Resource disposal guards: `if (this.currentGlowTexture) this.currentGlowTexture.dispose();` (`src/js/sun.js:215-217`)

**User-facing error feedback:**
- One inline visual error: invalid custom MK classification flashes the input border red for 1 second, then resets — no console message, no alert:
  ```js
  customInput.style.borderColor = '#ff3838';
  setTimeout(() => {
    customInput.style.borderColor = 'rgba(255, 255, 255, 0.15)';
  }, 1000);
  ```
  (`src/js/main.js:258-262`)

**Implication:**
- The app assumes a happy path: DOM elements exist, WebGL2 context creation succeeds, all imports load, no exceptions are thrown by Three.js or `lil-gui`.
- If `document.getElementById('hud-star-class').querySelector('.reading-value')` (`src/js/main.js:32`) ever returns `null` (e.g., HUD markup missing), the script throws and the whole app fails to boot — there is no graceful fallback.
- WebGL context loss (`webglcontextlost` event) is **not handled**; the animation loop will silently spam errors.
- This is acceptable for a single-page demo / portfolio piece but would need hardening for production.

## Logging

**Framework:** None. **No logging calls exist anywhere in `src/js/*`.**

- No `console.log`, `console.warn`, `console.error`, `console.info`, `console.debug`
- No structured logger (winston, pino, debug, loglevel, etc.)
- No telemetry/analytics SDKs

**Pattern:**
- The HUD itself (DOM elements `#val-distance`, `#val-velocity`, `#val-temperature`, `#hud-star-class`) acts as the "log" — it displays runtime state visually rather than writing to the console
- All "diagnostic" output is rendered to screen via `valDistance.textContent = ...` etc. (`src/js/main.js:354-365`)

**Recommendation:**
- For debugging shader uniforms or telemetry, drop in temporary `console.log` calls but remove before commit (since no lint rule will flag them).

## Comments

**When to comment:**
- Comments are used **liberally for explanation**, especially for:
  - High-level numbered sections (e.g., `// 1. Scene & Camera Setup`, `// 2. WebGL Renderer configuration (HDR & Tone mapping)`, `// 3. Orbit Controls` … in `src/js/main.js`)
  - Magic-number rationale: `// Half-resolution for 75% GPU fill-rate savings`, `// Cap at 2 for performance`, `// 800 units = 1 Astronomical Unit / AU`
  - Physical/astronomical context: `// Convert units to represent astronomical values`, `// Earth orbit speed in km/s`, `// Keplerian physics simulation`, `// Stefan-Boltzmann: R = sqrt(L) / (T/T_sun)^2`
  - Class behaviors / preset rationale: `// Giant stars boil slower`, `// Massive gravity holds prominences closer`, `// White dwarfs have no corona or stellar wind`
- 228 single-line `//` comments across the 5 source files
- Comments tend to explain **why**, not what — typical of an educational/portfolio codebase

**JSDoc / TSDoc:**
- Used **inconsistently**. Only 2 JSDoc blocks exist in the entire `src/`:
  - `src/js/starfield.js:4-8` — documents `createStarfield(numStars)` with `@param` and `@returns`
  - `src/js/stellarClassifier.js:35-38` — documents `parseMKClassification(spectralString)` with a free-form description (no `@param` / `@returns`)
- The other exported functions (`Sun` class methods, `kelvinToColorGrading`, `lookupHYGStar`) have **no JSDoc**, only inline `//` comments at the implementation site.

**Recommendation if extending:**
- Either commit to JSDoc on every exported symbol or drop the existing two — current half-and-half state is inconsistent.

**File / section headers:**
- Each shader block in `src/js/shaders.js` is preceded by a banner-style comment: `// 1. Solar Surface (Core) Shaders`, `// 2. Prominences & Flares (3D Vertex Displacement Shell)`, `// 3. Volumetric Corona Glow Shaders`, `// 4. Twinkling Starfield Shaders`
- `src/js/main.js` is divided into numbered sections inside `init()` via inline comments (`// 1. Scene & Camera Setup` … `// 8. Event Listeners`)

## Function Design

**Size:**
- Most functions are **medium-sized** (20–80 lines)
- Outliers:
  - `init` in `src/js/main.js:37-109` — 72 lines, but organized into 8 commented sub-steps
  - `setupGUI` in `src/js/main.js:119-178` — 60 lines, organized by folder
  - `setupHUDBindings` in `src/js/main.js:181-306` — ~125 lines, the largest function in the project; mixes preset wiring, autopilot wiring, and the custom-class flow (could be split)
  - `parseMKClassification` in `src/js/stellarClassifier.js:39-191` — ~150 lines, but mostly a series of `if` branches per spectral / luminosity class
  - `setPreset` in `src/js/sun.js:284-402` — ~120 lines with a large `switch` plus uniform sync
- No early-return obsession; functions are linear and procedural

**Parameters:**
- Positional, typically 0–3 parameters
- Default values used freely: `function createStarfield(numStars = 8000)`, `function createGlowTexture(colorHex, size = 256)`, `update(time, bloomStrength = 1.0)`
- Settings/preset functions accept a single object: `setPreset(presetNameOrSettings)` accepts either a string (`'sol'`, `'redgiant'`, …) or a config object — polymorphic dispatch by `typeof`

**Return values:**
- Most procedural setup functions return `void`/`undefined` (they mutate global state, scene graph, or DOM)
- Factory functions return the constructed object: `createStarfield` → `THREE.Points`, `createGlowTexture` → `THREE.CanvasTexture`, `parseMKClassification` → settings object or `null`, `lookupHYGStar` → settings object or `null`, `kelvinToColorGrading` → `THREE.Vector3`
- **`null` is used as the "not found" sentinel**; no `undefined` returns or thrown exceptions

**Side effects:**
- The codebase is deliberately stateful: module-level `let` variables in `src/js/main.js`, the `Sun` instance mutates its `params` object via `Object.assign`, GUI callbacks mutate shader uniforms directly
- This is typical for Three.js animation loops, but it means most functions are not pure and not easily unit-testable

## Module Design

**Exports:**
- **All exports are named** (no `export default` anywhere in `src/`)
- Class exports: `export class Sun` (`src/js/sun.js:95`)
- Function exports: `export function createStarfield(...)`, `export function parseMKClassification(...)`, `export function kelvinToColorGrading(...)`, `export function lookupHYGStar(...)`
- Constant exports: `export const HYG_DATABASE = {...}` and all shader source strings in `src/js/shaders.js` (`simplexNoiseGLSL`, `blackbodyGLSL`, `valueNoiseGLSL`, `surfaceVertexShader`, `surfaceFragmentShader`, `prominenceVertexShader`, `prominenceFragmentShader`, `coronaVertexShader`, `coronaFragmentShader`, `starfieldVertexShader`, `starfieldFragmentShader`)

**Barrel files:**
- **None.** No `index.js` re-exporters; each module is imported by its file path.

**Module boundaries (informal):**
- `main.js` — application bootstrap, GUI wiring, animation loop, HUD bindings, telemetry
- `sun.js` — `Sun` class that owns the star's mesh group, shader materials, and lens-flare textures
- `starfield.js` — single `createStarfield` factory returning a `THREE.Points`
- `shaders.js` — pure GLSL source strings, no Three.js imports
- `stellarClassifier.js` — pure data + math (MK parsing, HYG lookup, blackbody temperature → color); the only file with no `THREE` mesh side effects (only uses `THREE.Vector3`)

**Reusability:**
- `shaders.js` and `stellarClassifier.js` are the most reusable / testable modules (no DOM, no scene graph)
- `main.js` is the only file that reaches into `document.*` — DOM access is centralized there

## ES Module Pattern

**Declared in `package.json`:** `"type": "module"` → every `.js` file is interpreted as ESM.

**Practical consequences observed:**
- Explicit `.js` extensions on all relative imports: `from './sun.js';`, `from './shaders.js';`, `from './starfield.js';`, `from './stellarClassifier.js';` — required because ESM does not auto-resolve extensions
- HTML entry point uses `type="module"`: `<script type="module" src="/src/js/main.js"></script>` (`index.html:110`)
- Vite (`vite@^8`) is the bundler/dev server; it natively handles ESM in dev (no transpilation needed) and bundles for production
- No CommonJS interop concerns; no `__dirname`, no `require()`
- Three.js examples imported from subpaths: `'three/examples/jsm/controls/OrbitControls.js'`, `'three/examples/jsm/postprocessing/EffectComposer.js'`, etc. — these are the ESM-native paths Three.js exposes

## Shader-Specific Patterns

**Shader storage and injection:**
- All GLSL source lives in `src/js/shaders.js` as **tagged-less template literals** (`` const surfaceVertexShader = `...` ``)
- Reusable GLSL helpers (`simplexNoiseGLSL`, `blackbodyGLSL`, `valueNoiseGLSL`) are composed into shader bodies via JS string interpolation:
  ```js
  export const surfaceFragmentShader = `
    uniform float uTime;
    ...
    ${valueNoiseGLSL}

    void main() { ... }
  `;
  ```
- Shader templates are injected once into `THREE.ShaderMaterial` `{ vertexShader, fragmentShader, uniforms }` constructor options (`src/js/sun.js:131, 154, 180`; `src/js/starfield.js:67`)

**Uniform conventions:**
- Uniforms are declared with `{ value: ... }` wrappers per Three.js API:
  ```js
  uniforms: {
    uTime: { value: 0 },
    uHighTemp: { value: this.params.highTemp },
    ...
  }
  ```
- Per-frame uniform updates push from JS into GLSL via `.uniforms.uTime.value = elapsed` (`src/js/main.js:401-402`)
- GUI `onChange` callbacks pipe the slider value directly into the matching uniform: `.onChange(() => sun.coreMaterial.uniforms.uHighTemp.value = sun.params.highTemp)` — paired one-line setter per parameter

**Naming on the shader side:**
- Uniforms: `u`-prefix (`uTime`, `uHighTemp`, `uColorGrading`, `uProminenceHeight`, …)
- Custom attributes: `a`-prefix (`aSize`, `aColor`, `aPhase`)
- Varyings: `v`-prefix (`vPosition`, `vNormal`, `vViewDir`, `vLocalPosition`, `vDisplacement`, `vUv`, `vColor`, `vPhase`)
- Local helpers: `camelCase` GLSL functions (`getBlackbodyColor`, `noise3D`, `fbm3D`, `warpedFbm3D`, `snoise`, `hash`, `permute`, `taylorInvSqrt`)

**GLSL version / quality:**
- Comment at top of `shaders.js:1` reads `// Custom GLSL 3.0 / WebGL 2 Shaders for Stellar Renderer`
- Shaders rely on WebGL 2 / GLSL ES 3.0 features (Three.js's `ShaderMaterial` will inject the correct `#version 300 es` header when the renderer is WebGL2)
- No explicit `precision` qualifier in user code — relies on Three.js's default `highp` injection

**Optimization patterns:**
- 3-octave FBM (rather than 6-8) for 60+ FPS: `for (int i = 0; i < 3; i++) { ... }` in `fbm3D` (`src/js/shaders.js:165-170`) with comment `// Optimized to 3-octaves for 60+ FPS`
- Early `discard` to skip fragment work: `if (finalAlpha < 0.02) discard;` (`src/js/shaders.js:382`), `if (uvDist > 0.5) { discard; }` (`src/js/shaders.js:426`), `if (totalStrength < 0.01) discard;` (`src/js/shaders.js:461`), `if (glow < 0.01) discard;` (`src/js/shaders.js:516`)
- Half-resolution bloom pass: `new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2)` with comment `// Half-resolution for 75% GPU fill-rate savings` (`src/js/main.js:78`)
- Pixel-ratio cap: `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));` (`src/js/main.js:50`)

**Material-state conventions:**
- Glow/atmospheric layers use:
  ```js
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  ```
  applied to `promMaterial` (`src/js/sun.js:166-169`), `coronaMaterial` (`src/js/sun.js:191-193`), and `starfield` material (`src/js/starfield.js:73-75`)
- `side: THREE.DoubleSide` on the prominences shell so the shader is visible from both faces

**Resource management:**
- Canvas-generated textures are explicitly `.dispose()`-d before being recreated, with null-guards (`src/js/sun.js:215-217`) — the only memory-management discipline in the codebase
- Geometries, materials, and meshes are otherwise **never disposed** (acceptable because they live for the entire app lifetime)
- No cleanup path for `Sun` itself — there is no `dispose()` method, no removal from the scene; assumes the app is mounted once and never torn down

---

*Convention analysis: 2026-05-20*
