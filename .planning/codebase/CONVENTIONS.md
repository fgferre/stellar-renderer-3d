# Coding Conventions

**Analysis Date:** 2026-05-20

> **Overall verdict:** Conventions are reasonably consistent within the JS code (single-quote ES modules, 2-space indent, `let`/`const` only) but there is **no enforcement** — no ESLint, no Prettier, no Biome, no `.editorconfig`. Documentation hygiene is minimal: only 2 JSDoc blocks exist across 2,805 lines of JS, and there are zero `TODO`/`FIXME`/`HACK` markers. Error handling is essentially **absent** (no `try`/`catch`, no `throw`, no `console.error`).

## Module System

**ES Modules (ESM):** `package.json` declares `"type": "module"` — all files use native `import` / `export` syntax. No CommonJS `require()` is used anywhere.

**File extensions in imports:** Always explicit (`.js`), e.g. `import { Sun } from './sun.js';` in `src/js/main.js:10`. This matches Vite's native ESM resolution.

**Import categories observed (top-of-file order in `src/js/main.js`):**
1. Third-party namespace imports (`import * as THREE from 'three';`)
2. Third-party deep submodule imports (e.g. `'three/examples/jsm/controls/OrbitControls.js'`)
3. Third-party named imports (`import { GUI } from 'lil-gui';`)
4. Local CSS side-effect import (`import '../style.css';` — Vite stylesheet pipeline)
5. Local module imports (relative paths with `.js` extension)

**Exports:**
- `src/js/sun.js` uses **named class export** (`export class Sun`) at line 95.
- `src/js/starfield.js` uses **named function export** (`export function createStarfield(...)`)
- `src/js/stellarClassifier.js` uses multiple named exports: 3 functions + 1 const object (`HYG_DATABASE`).
- `src/js/shaders.js` uses 11 `export const` template literals (GLSL strings).
- No default exports anywhere.
- No barrel/index re-export files.

## Naming Patterns

**Files (`src/js/`):**
- camelCase or single-word lowercase: `main.js`, `shaders.js`, `starfield.js`, `sun.js`, `stellarClassifier.js`.
- Sole multi-word file uses camelCase (`stellarClassifier.js`) — no kebab-case, no snake_case.

**Classes:** PascalCase. Only one class exists: `Sun` (`src/js/sun.js:95`).

**Functions:** camelCase. Examples:
- Top-level: `createStarfield` (`starfield.js:9`), `kelvinToColorGrading` (`stellarClassifier.js:4`), `parseMKClassification` (`stellarClassifier.js:47`), `lookupHYGStar` (`stellarClassifier.js:350`).
- Methods on `Sun`: `initCore`, `initProminences`, `applyCurrentParams`, `getPresetDefaultSettings`, `copyParams`, `updateLensFlares`, `setPreset`, `resetCurrentPresetToDefault` (`src/js/sun.js`).
- Nested module-private factories: `createGlowTexture`, `createRingTexture`, `createHexagonTexture` (`src/js/sun.js:13-93`).
- Local helpers inside event handlers: `applyCustomClass` (`main.js:884`).

**Variables:** camelCase. Examples: `isFlying`, `flightTargetPos`, `comparisonScaleMode`, `mainSunParamsBackup`, `lastTelemetryUpdateTime` (`main.js:18-46`).

**Constants:**
- Mutable module-level state uses `let` (e.g. `let scene, camera, renderer;` in `main.js:15`).
- True constants use `const`, in camelCase, **not** SCREAMING_SNAKE_CASE — e.g. `const guiColorProxies` (`main.js:23`), `const tempV = new THREE.Vector3();` (`main.js:587`).
- **Sole exception:** `HYG_DATABASE` (`stellarClassifier.js:329`) — the only SCREAMING_SNAKE_CASE identifier in the project, used because it represents an external catalog.

**Object/parameter keys:** camelCase (e.g. `highTemp`, `lowTemp`, `convectionSpeed`, `colorGrading`, `lensFlaresEnabled` in `sun.js:96-126`).

**DOM IDs (HTML/JS):** kebab-case. Examples: `#canvas-container`, `#space-hud`, `#hud-star-class`, `#val-distance`, `#btn-preset-sol`, `#btn-cinematic-flyby`. Selected via `document.getElementById(...)` throughout `main.js`.

**CSS classes:** kebab-case, **custom non-BEM**. See "CSS Conventions" below.

## Code Style

**Variable declarations:** Strictly `let` / `const`. **Zero occurrences** of `var` in the entire `src/js/` tree (314 `let`/`const` occurrences across 5 files).

**Function definitions:**
- Top-level / module-scope: `function` declarations (45 in `main.js`, also in every other JS file). Example: `function init()` (`main.js:60`), `function animate()` (`main.js:1081`).
- Class methods: shorthand method syntax (no `function` keyword) — see `src/js/sun.js`.
- Event handlers and short callbacks: **arrow functions** (45 arrow usages in `main.js` alone). Examples:
  - `controls.addEventListener('start', () => { isFlying = false; });` (`main.js:85-87`)
  - `gui.add(..., 'reset').name('↺ Reset Star to Default');` lambda (`main.js:182-193`)
  - `presetButtons.forEach(btn => { btn.addEventListener('click', () => { ... }); });` (`main.js:763-808`)

**Pattern:** Long-lived named operations use `function`; one-shot callbacks use arrow. No `class`-as-function patterns. No IIFEs.

**Semicolons:** **Required everywhere** — 1,239 semicolon-terminated lines across the 5 JS files. Consistent.

**Quotes:** **Single quotes** dominate JS string literals (310 occurrences in `src/js/`). Double quotes appear only:
- Inside `HYG_DATABASE` keys/values (`stellarClassifier.js:329-348`) — JSON-style object literal with `"SUN"`, `"Sirius A"`, etc.
- Inside the `lineupData` array in `main.js:318-331` (probably a stylistic carryover from JSON).

Backtick template literals are used for:
- Dynamic strings with interpolation (`main.js:158`, `main.js:373-382`, `main.js:1051`, etc.).
- Multi-line GLSL shader source bodies (`src/js/shaders.js` — all 11 exports).

**Indentation:** 2 spaces. Zero tabs detected. Consistent across all `.js` and `.css` files.

**Line length:** No hard cap. Some lines in `main.js` exceed 150 chars (e.g. `main.js:488`, GUI controller setup lines).

**Equality:** Strict `===` / `!==` is used throughout (e.g. `main.js:471`, `sun.js:510`). No loose `==` detected.

**Brace style:** K&R / 1TBS — opening brace on same line as control statement. `else` on same line as closing brace.

## Imports & Path Aliases

**No path aliases configured.** All local imports are relative (`./shaders.js`, `../style.css`). Three.js examples are imported via their full deep path (`'three/examples/jsm/controls/OrbitControls.js'`), not via a Three.js subpath export.

## Error Handling

**There is essentially no error handling.**

- **Zero** `try` / `catch` blocks across the entire `src/js/` tree.
- **Zero** `throw` statements.
- **Zero** `console.error` / `console.warn` / `console.log` calls.
- **No** Promise rejection handlers (no `.catch(...)`, no `try`/`await`/`catch`).
- **No** custom Error subclasses.

**Defensive patterns observed instead:**

1. **Null-return on invalid input.** `parseMKClassification` returns `null` if the regex match fails (`stellarClassifier.js:58`). `lookupHYGStar` returns `null` for unknown queries (`stellarClassifier.js:403`). Callers check `if (!settings)` (`main.js:902`).

2. **DOM null guards.** Conditional access before use:
   ```js
   const compModeBtn = document.getElementById('btn-comparison-mode');
   if (compModeBtn) {
     compModeBtn.addEventListener('click', () => { ... });
   }
   ```
   (`main.js:838-847`, also `main.js:946`, `main.js:870`, `main.js:599-600`, `main.js:432`)

3. **Undefined-fallback ternaries.** Params loaded from preset slots fall back to numeric defaults if the field is missing:
   ```js
   uLimbExponent: { value: this.params.limbExponent !== undefined ? this.params.limbExponent : 0.6 }
   ```
   (`sun.js:183-185`, repeated for ~6 params; also `sun.js:208`, `sun.js:321`, `sun.js:326`, `sun.js:467`, etc.)

4. **UI-level invalid-input feedback** instead of thrown errors. `applyCustomClass` flashes the input border red for 1 s on parse failure (`main.js:902-909`):
   ```js
   if (!settings) {
     customInput.style.borderColor = '#ff3838';
     setTimeout(() => { customInput.style.borderColor = 'rgba(255, 255, 255, 0.15)'; }, 1000);
     return;
   }
   ```

5. **Numeric clamps** in shader-bound code as a substitute for validation — e.g. `Math.max(0.1, Math.min(255, r))` (`stellarClassifier.js:24`), `THREE.MathUtils.clamp(...)` (`main.js:1015`), `baseTemp = Math.max(2000.0, Math.min(50000.0, baseTemp));` (`stellarClassifier.js:101`).

**Implication for new code:** WebGL/Three.js failures (lost context, shader compile errors, asset load failures) are not currently surfaced. If you add network I/O, asset loading, or any failable operation, consider whether to introduce a real error-handling story first.

## Logging

**Framework:** None. The codebase contains **no** `console.*` calls anywhere in `src/`.

**Diagnostics surface to the user:** Loader progress bar via `updateLoadProgress(pct)` (`main.js:156-160`), HUD telemetry, and the red-border flash for invalid MK input.

## Comments

**Density:** ~281 single-line `//` comment lines across `src/js/` (~10% of lines). Most files are commented at the section / step level rather than line-by-line.

**Style:**

- **Section headers**: capitalized phrases, terse, often numbered:
  ```js
  // 1. Scene & Camera Setup
  // 2. WebGL Renderer configuration (HDR & Tone mapping)
  ```
  (`main.js:63`, `main.js:70`)
- **Inline explanations** for non-obvious magic numbers / physics constants:
  ```js
  controls.minDistance = 140.0; // Avoid clipping inside surface prominences
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2 for performance
  ```
  (`main.js:73`, `main.js:83`)
- **Physics / domain narrative** comments — common and load-bearing:
  ```js
  // Orbit speed: speed goes up when orbiting closer (Keplerian physics simulation)
  // gets hotter when closer due to blackbody flux density
  ```
  (`main.js:1053`, `main.js:1059`)
- **Cinematic timing** is commented per-take in `updateCinematicCamera` (`main.js:688-758`).

**JSDoc:** Only **two** JSDoc blocks exist across the codebase:
1. `src/js/starfield.js:4-8` — `createStarfield` (with `@param`, `@returns`).
2. `src/js/stellarClassifier.js:43-46` — `parseMKClassification` (free-form description, no tags).

JSDoc is **not** the prevailing style — most exported functions have only a one-line `//` comment above them.

**No TODO/FIXME/HACK/XXX markers anywhere** in `src/` — either the codebase is genuinely complete from the author's perspective or temporary notes have been scrubbed.

## Function Design

**Size:** Wide variance. The bulk of the logic lives in long top-level orchestration functions:
- `init()` in `main.js:60-153` — ~95 lines, 8 numbered setup phases.
- `setupGUI()` in `main.js:174-284` — ~110 lines, GUI bindings.
- `setupHUDBindings()` in `main.js:762-967` — ~205 lines, all DOM event wiring.
- `updateCinematicCamera()` in `main.js:675-759` — ~85 lines, multi-take camera choreography.
- `getPresetDefaultSettings()` in `sun.js:351-456` — ~105 lines, big `switch` over 4 presets.
- `parseMKClassification()` in `stellarClassifier.js:47-327` — ~280 lines, the largest single function in the project.

These long functions are sectioned by numbered comments and inner blocks, not extracted into helpers. **This is the de-facto style — embrace it for sibling features, but be aware that complexity has accumulated.**

**Parameters:**
- Functions usually take 1–3 positional args (e.g. `updateAutoExposure(distance)`, `update(time, bloomStrength = 1.0)`).
- Default parameter values used: `createStarfield(numStars = 8000)` (`starfield.js:9`), `Sun#update(time, bloomStrength = 1.0)` (`sun.js:310`), `createGlowTexture(colorHex, size = 256)` (`sun.js:13`).
- No options-object pattern.
- No destructured params in signatures.

**Return values:**
- Pure helpers return primitives or `THREE.Vector3` (e.g. `kelvinToColorGrading`).
- Parser helpers return either a settings object or `null`.
- Side-effect orchestration functions return `undefined` implicitly.

## Module / Class Design

**Architectural pattern:**
- `src/js/sun.js` — single ES6 `class Sun` that wraps all Three.js geometry, materials, and lensflares for one star. All other modules are **functional / data-only**.
- `src/js/stellarClassifier.js` — pure-ish functions plus a `HYG_DATABASE` const. No state.
- `src/js/starfield.js` — single factory function.
- `src/js/shaders.js` — pure GLSL string constants (no logic).
- `src/js/main.js` — application bootstrap with module-level mutable state (`let scene, camera, ...`).

**Single-class style:** The `Sun` class uses fields-on-`this` (no `#private` fields, no static methods). Construction order in `constructor` (`sun.js:143-166`):
1. Create `THREE.Group`, add to scene.
2. Build `this.presetStates` keyed by preset name.
3. Init `this.params` and copy current preset onto it.
4. Call `initCore()`, `initProminences()`, `initCorona()`, `initLensFlares()`.

Each `init*` method creates one mesh + ShaderMaterial pair and adds it to `this.group`. The same pattern should be followed if you add more stellar features (e.g. accretion disks).

## Shader Conventions (`src/js/shaders.js`)

Shaders are stored as `export const <name>VertexShader` / `<name>FragmentShader` template literals (11 exports). The naming convention for GLSL identifiers is rigorously enforced (57 prefixed declarations counted):

- **Uniforms** are prefixed with `u`: `uTime`, `uHighTemp`, `uLowTemp`, `uNoiseScale`, `uConvectionSpeed`, `uSunspotThreshold`, `uPlageIntensity`, `uColorGrading`, `uLimbExponent`, `uLimbBase`, `uPlageGrading`, `uProminenceSpeed`, `uProminenceHeight`, `uBaseTemp`, `uEdgeFade`, `uPolarJetIntensity`, `uScale`, `uTemp`, `uCoronaSpeed`, `uCoronaDensity`.
- **Vertex attributes** are prefixed with `a`: `aSize`, `aColor`, `aPhase` (`shaders.js:499-501`).
- **Varyings** are prefixed with `v`: `vPosition`, `vNormal`, `vViewDir`, `vUv`, `vColor`, `vPhase`, `vLocalPosition`, `vDisplacement`, `vPolarFactor`.

**Shader composition** is done by string interpolation — utility GLSL functions (`simplexNoiseGLSL`, `blackbodyGLSL`, `valueNoiseGLSL`) are spliced into shader bodies via `${valueNoiseGLSL}` placeholders. This is the canonical pattern (`shaders.js:217`, `shaders.js:321`, `shaders.js:370-371`, `shaders.js:442-443`).

**Floats** are always written with explicit decimals (`1.0`, `100.0`, `0.5`) — required by GLSL but also followed consistently.

**Comments inside GLSL** use `//` and describe the physical interpretation (e.g. "First corner", "Permutations", "physics-based limb darkening model").

**Source attribution** is present at the top of utility blocks (e.g. `// Ashima Arts Simplex 3D Noise (Textureless)` at `shaders.js:3`).

**JS-side uniform binding** mirrors the `u`-prefix naming exactly (`sun.js:174-186`), making search-and-replace refactors safe.

## CSS Conventions (`src/style.css`, 615 lines)

**Class naming:** **Custom hyphenated** — NOT BEM (`block__element--modifier`), NOT utility (Tailwind / Atomic). The pattern is:

- **Single domain prefix + hyphenated descriptor**: `.hud-header`, `.hud-label`, `.hud-status-indicator`, `.hud-readings`, `.hud-section-title`, `.reading-box`, `.reading-title`, `.reading-value`.
- **Component class + state modifier (no `--` BEM separator)**: `.preset-btn`, `.preset-btn:hover`, `.preset-btn.active`. State is just an additional class (`.active`, `.visible`, `.collapsed`, `.fade-out`, `.warning`).
- **Component class + variant modifier**: `.reading-value.yellow-dwarf`, `.reading-value.red-giant`, `.reading-value.blue-super`, `.reading-value.white-dwarf` (`style.css:129-132`).
- **Three-segment composition** for distinct features: `.star-label-3d`, `.label-glow-line`, `.label-card`, `.label-name`, `.label-details`.

**IDs vs classes:** IDs target singleton structural elements (`#space-hud`, `#control-panel`, `#gui-container`, `#loader`, `#canvas-container`, `#comparison-labels-container`, `#toggle-panel`). Classes target reusable component pieces. Both follow kebab-case.

**Attribute selectors** are used for preset-specific theming:
```css
.preset-btn[data-preset="sol"].active { border-color: rgba(243, 156, 18, 0.8); ... }
.preset-btn[data-preset="redgiant"].active { ... }
```
(`style.css:180-183`)

**CSS variables:** Used only inside the **third-party lil-gui** wrapper (`style.css:332-346`), to override `--background-color`, `--text-color`, `--widget-color`, `--hover-color`, `--focus-color`, `--number-color`, `--string-color`. The rest of the stylesheet uses **direct color literals** — there is **no project-wide design-token system**. Colors like `rgba(243, 156, 18, ...)` (warm-orange solar accent) and `#00ff80` (comparison-mode green) are repeated literally across many rules. **If you add new theme colors, consider introducing custom properties** rather than hard-coding hex/rgba values.

**Layout patterns:**
- **Glassmorphism / Frosted glass:** consistent across all overlay panels. Triplet: `background: rgba(8-10, 8-15, 16-30, 0.45-0.55)` + `backdrop-filter: blur(16px) saturate(180%)` + `border: 1px solid rgba(255, 255, 255, 0.08)` + `border-radius: 12px` + soft shadow. Defined as `.glass-panel` (`style.css:30-38`) and **also duplicated** ad-hoc in `#space-hud` (`style.css:41-55`) and `#control-panel` (`style.css:263-281`). Reuse `.glass-panel` if you add new panels.
- **Flex column** is the dominant button-row pattern (`.preset-buttons`, `.autopilot-buttons`).
- **CSS Grid** is used for the HUD readings (`.hud-readings { display: grid; grid-template-columns: 1fr 1fr; }`) and the focus grid (`#comparison-focus-grid { grid-template-columns: repeat(3, 1fr); }`).
- **Absolute positioning** for all overlays (`#space-hud` top-left, `#control-panel` top-right, `#loader` fullscreen, `#comparison-labels-container` fullscreen overlay).
- **Z-index tiers:** canvas `1`, overlays `10`, loader `9999`.

**Animations / transitions:**
- Easing on panel transitions uses custom cubic-beziers: `cubic-bezier(0.16, 1, 0.3, 1)` (`style.css:37`, `style.css:280`), `cubic-bezier(0.25, 0.8, 0.25, 1)` (`style.css:161`).
- Named `@keyframes`: `pulse` (`style.css:94-97`), `rotate-corona` (`style.css:482-485`), `pulse-corona` (`style.css:487-490`).
- Hover effects use `transform: translateY(-1px)` lifts and rgba border-color brightness bumps.

**Typography:**
- Two Google Fonts loaded in `index.html:15`: `Orbitron` (display, used for `.hud-label`, `.hud-section-title`, `.reading-value`, `.nav-btn`, panel headings) and `Outfit` (body, on `html, body`). `Inter` is referenced in `.label-details` (`style.css:611`) but **not loaded** — it falls back to `sans-serif`. This is a minor inconsistency.

**Vendor prefixes:** `-webkit-backdrop-filter`, `-webkit-user-drag` are present for Safari compatibility but no other prefixes.

**Scrollbar styling:** WebKit-only via `::-webkit-scrollbar` selectors (`style.css:400-415`). No Firefox `scrollbar-width` fallback.

**Responsive design:** Single `@media (max-width: 900px)` breakpoint (`style.css:520-536`) that reflows `#space-hud` to the bottom and shrinks both panels to nearly-full-width. No mobile-first approach.

**Inline styles in HTML:** The custom-class input and the cinematic / scale-toggle buttons in `index.html:85-113` carry **substantial inline styles** instead of being moved into `style.css`. This is technical inconsistency — if you touch those elements, prefer extracting their styles into named classes.

---

*Convention analysis: 2026-05-20*
