<!-- refreshed: 2026-05-20 -->
# Architecture

**Analysis Date:** 2026-05-20

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                       HTML SHELL (DOM)                       │
│                       `index.html`                           │
├──────────────────┬──────────────────┬───────────────────────┤
│  #canvas-container  │  #space-hud      │   #control-panel    │
│  (WebGL surface)    │  (HUD telemetry  │   (lil-gui mount    │
│                     │   + presets +    │    point: #gui-     │
│                     │   autopilot)     │    container)       │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │ (DOM events)     │ (button clicks)     │ (slider events)
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│            APPLICATION ORCHESTRATOR (Procedural)             │
│            `src/js/main.js`                                  │
│  scene/camera/renderer/composer/clock/controls + animate()   │
└────────┬───────────────────────┬────────────────────┬───────┘
         │ instantiates          │ instantiates       │ delegates
         ▼                       ▼                    ▼
┌──────────────────────┐ ┌──────────────────┐ ┌────────────────────┐
│   Sun (class)        │ │  starfield       │ │ stellarClassifier  │
│   `src/js/sun.js`    │ │  (factory fn)    │ │ `src/js/stellar    │
│   - coreMesh         │ │  `src/js/        │ │  Classifier.js`    │
│   - promMesh         │ │  starfield.js`   │ │ - parseMK...       │
│   - coronaMesh       │ │  THREE.Points    │ │ - lookupHYGStar    │
│   - flareGroup       │ │                  │ │ - kelvinToColor    │
└──────────┬───────────┘ └────────┬─────────┘ └────────────────────┘
           │ ShaderMaterial uses  │
           ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│              GLSL SHADER LIBRARY (string exports)            │
│              `src/js/shaders.js`                             │
│  surface{Vertex,Fragment} + prominence{V,F} +                │
│  corona{V,F} + starfield{V,F} + simplexNoise +               │
│  blackbody + valueNoise (composed via `${...}` templates)    │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Three.js r184 → WebGL 2 GPU (composer or direct render)     │
│  Post-processing: RenderPass → UnrealBloomPass → OutputPass  │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| HTML shell | DOM scaffolding, HUD/control-panel markup, loader, module script tag | `index.html` |
| Stylesheet | Glassmorphism HUD, loader, panel styling | `src/style.css` |
| Application orchestrator | Scene/camera/renderer setup, post-processing pipeline, GUI wiring, HUD event bindings, autopilot easing, animation loop, auto-exposure, telemetry | `src/js/main.js` |
| Sun composite | Owns 4 sub-meshes (core, prominences, corona, lens flares), holds the `params` configuration object, applies stellar presets, syncs uniforms each frame | `src/js/sun.js` |
| Starfield | Builds a `THREE.Points` shell of 6000 stars with per-vertex attributes (size/phase/color) | `src/js/starfield.js` |
| Stellar classifier | Parses Morgan-Keenan spectral strings, looks up named stars (HYG database), converts Kelvin to RGB color grading | `src/js/stellarClassifier.js` |
| GLSL shader library | All vertex/fragment shader source as exported template-string constants, plus shared noise/blackbody helpers | `src/js/shaders.js` |

## Pattern Overview

**Overall:** Modular ES module composition with a single procedural orchestrator. Not MVC. Closest match: a "scene-graph composite" pattern (the `Sun` class) wired into a procedural `init() + animate()` script (`main.js`).

**Key Characteristics:**
- **ES modules** (`"type": "module"` in `package.json`); each `src/js/*.js` file is imported by named export.
- **One stateful class** (`Sun`) that aggregates Three.js objects; everything else is a factory function or pure helper.
- **Module-level singletons** in `main.js` (`scene`, `camera`, `renderer`, `controls`, `composer`, `bloomPass`, `sun`, `starfield`, `gui`, `clock`) — there is no application object, no DI container.
- **Shaders are JavaScript template literals** (`export const surfaceVertexShader = \`...\``), composed by string interpolation (`${valueNoiseGLSL}` injected into fragment shaders).
- **Custom GUI ↔ uniform plumbing** via `lil-gui` callbacks (`.onChange(() => sun.coreMaterial.uniforms.uXxx.value = sun.params.xxx)`) — there is no auto-binding; each slider is wired by hand.
- **No build-time GLSL pipeline** (no `vite-plugin-glsl`, no `.glsl` files); Vite only transpiles JS/CSS.

## Layers

**Markup / DOM layer:**
- Purpose: Provides the canvas mount point, the HUD readouts, the preset/autopilot buttons, the custom-class input, the `#gui-container` mount point, and the loader.
- Location: `index.html`, `src/style.css`
- Contains: Static DOM, no logic. JS queries by id (`#val-distance`, `#hud-star-class`, `.preset-btn`, `.nav-btn`, etc.).
- Depends on: Nothing.
- Used by: `src/js/main.js` (via `document.getElementById` / `document.querySelectorAll`).

**Orchestrator layer:**
- Purpose: Owns the Three.js scene graph, drives the render loop, mediates between DOM events and the `Sun` instance.
- Location: `src/js/main.js`
- Contains: `init()`, `animate()`, `setupGUI()`, `setupHUDBindings()`, `updateAutoExposure()`, `updateTelemetry()`, `onWindowResize()`.
- Depends on: `three`, `three/examples/jsm/controls/OrbitControls.js`, `three/examples/jsm/postprocessing/{EffectComposer,RenderPass,UnrealBloomPass,OutputPass}.js`, `lil-gui`, local modules `./sun.js`, `./starfield.js`, `./stellarClassifier.js`, and `../style.css` (Vite import).
- Used by: `index.html` `<script type="module" src="/src/js/main.js">`.

**Scene-object layer:**
- Purpose: Encapsulates one renderable "thing" with its geometry, shader material, uniforms, and update method.
- Location: `src/js/sun.js`, `src/js/starfield.js`
- Contains: `Sun` class (4 sub-objects in a single `THREE.Group`) and `createStarfield()` factory (returns a `THREE.Points`).
- Depends on: `three`, `three/examples/jsm/objects/Lensflare.js` (Sun only), `./shaders.js`.
- Used by: `main.js` `init()`.

**Domain helpers layer:**
- Purpose: Pure-ish data transforms that map astrophysics inputs to renderer parameters.
- Location: `src/js/stellarClassifier.js`
- Contains: `parseMKClassification()`, `lookupHYGStar()`, `kelvinToColorGrading()`, `HYG_DATABASE` constant.
- Depends on: `three` (only for `THREE.Vector3` construction).
- Used by: `main.js` `setupHUDBindings()`'s custom-class flow.

**Shader layer:**
- Purpose: Defines all GLSL source as named exports.
- Location: `src/js/shaders.js`
- Contains: `simplexNoiseGLSL`, `blackbodyGLSL`, `valueNoiseGLSL` helper strings; 4 vertex/fragment shader pairs (surface, prominence, corona, starfield).
- Depends on: Nothing (string constants only).
- Used by: `sun.js` (4 shaders) and `starfield.js` (2 shaders).

## Data Flow

### Primary Request Path — initial page load to first rendered frame

1. Browser parses `index.html` and triggers `<script type="module" src="/src/js/main.js">` (`index.html:110`).
2. Vite resolves the ES-module graph: `main.js` imports `three`, `three/examples/jsm/*`, `lil-gui`, `'../style.css'`, `./sun.js`, `./starfield.js`, `./stellarClassifier.js` (`src/js/main.js:1-12`).
3. `window.onload = init` fires after assets load (`src/js/main.js:424`).
4. `init()` constructs `THREE.Scene` + fog, `PerspectiveCamera`, `WebGLRenderer` (ACESFilmic tone mapping, antialias, devicePixelRatio capped at 2), and appends `renderer.domElement` into `#canvas-container` (`src/js/main.js:41-54`).
5. `init()` instantiates `OrbitControls` with damping and `minDistance: 140`, `maxDistance: 150000` (`src/js/main.js:57-61`).
6. `new Sun(scene)` runs the `Sun` constructor: `initCore()` creates a `SphereGeometry(100, 80, 80)` with the surface `ShaderMaterial`, `initProminences()` creates a `SphereGeometry(101, 140, 140)` with additive-blended `ShaderMaterial`, `initCorona()` creates a `PlaneGeometry(480, 480)` billboard, `initLensFlares()` creates procedural canvas textures and attaches a `Lensflare` (`src/js/sun.js:96-263`).
7. `createStarfield(6000)` builds a `THREE.Points` with per-vertex `aSize`, `aPhase`, `aColor` attributes on a 25k–35k radius shell, then `scene.add(starfield)` (`src/js/starfield.js:9-79`, `src/js/main.js:70-72`).
8. `EffectComposer` is assembled with `RenderPass(scene, camera) → UnrealBloomPass(halfRes, 1.8, 0.48, 0.88) → OutputPass` (`src/js/main.js:75-89`). Note: bloom is disabled by default (`usePostProcessing = false`, `src/js/main.js:20`).
9. `setupHUDBindings()` attaches click listeners to `.preset-btn`, `.nav-btn`, and the custom-class input/button (`src/js/main.js:181-306`).
10. `setupGUI()` mounts a new `GUI` inside `#gui-container` with four folders ("Solar Surface Core", "Magnetic Prominences", "Coronal streamers", "Atmosphere & Exposure") and wires each slider's `onChange` to write back into the corresponding `sun.<material>.uniforms.u<Name>.value` (`src/js/main.js:119-178`).
11. Loader fades out after 600 ms (`src/js/main.js:100-102`), `window.addEventListener('resize', onWindowResize)` is registered (`src/js/main.js:105`), and `animate()` is called (`src/js/main.js:108`).

### Per-frame render path (the `animate()` loop)

1. `requestAnimationFrame(animate)` schedules the next tick (`src/js/main.js:370`).
2. `clock.getDelta()` and `clock.getElapsedTime() * timeSpeed` produce the `elapsed` time used by shader uniforms (`src/js/main.js:372-373`).
3. If autopilot is engaged (`isFlying`), `camera.position.lerp(flightTargetPos, 0.035)` eases the camera and disengages once within 1 unit of the target (`src/js/main.js:376-384`).
4. `controls.update()` applies OrbitControls damping (`src/js/main.js:386`).
5. `updateAutoExposure(camera.position.length())` lerps `renderer.toneMappingExposure` between 0.6 and 1.0 based on a normalized 140→6000 distance, lerps bloom strength/threshold if post-processing is on, and toggles `sun.params.lensFlaresEnabled` based on whether the camera is closer than 170 units (`src/js/main.js:319-348`).
6. Every 0.1 s, `updateTelemetry(distance, delta)` updates the three HUD readouts using `distance / 800` AU, Keplerian-style orbit speed `29.78 / sqrt(distanceAU)`, and inverse-square temperature scaling (`src/js/main.js:351-366`).
7. `sun.update(elapsed, bloomPass.strength)` writes `uTime` into all three sun materials and applies a sinusoidal pulse to the corona mesh scale (`src/js/sun.js:266-281`).
8. `starfield.material.uniforms.uTime.value = elapsed` advances the per-vertex twinkle (`src/js/main.js:402`).
9. Render branch (`src/js/main.js:405-409`):
   - If `usePostProcessing` is `true`: `composer.render()` runs the bloom pipeline.
   - Otherwise: `renderer.render(scene, camera)` does a direct draw (default mode; the corresponding "Render Post-bloom" GUI toggle defaults to `false`).

### Preset / custom-class application flow

1. Click on `.preset-btn` (`src/js/main.js:184-215`) or `Enter` in `#input-custom-class` (`src/js/main.js:298-305`).
2. Custom path: `lookupHYGStar(rawVal)` is tried first against the in-memory `HYG_DATABASE` (`src/js/stellarClassifier.js:212-236`); on miss, `parseMKClassification(rawVal)` regex-parses the spectral string and produces a full parameter object via lookups keyed on spectral class + luminosity class (`src/js/stellarClassifier.js:39-191`).
3. Preset path: a hard-coded settings object inside `Sun.setPreset()`'s switch statement is selected (`src/js/sun.js:284-364`).
4. `sun.setPreset(settings | name)` merges into `this.params`, toggles `promMesh.visible` and `coronaMesh.visible` based on whether `prominenceHeight > 0` and `coronaDensity > 0`, applies `group.scale`, and writes every uniform on the three materials, then calls `updateLensFlares()` which disposes prior canvas textures and rebuilds the `Lensflare` with star-color-matched ghost elements (`src/js/sun.js:367-402`, `src/js/sun.js:208-263`).
5. `controls.minDistance = 140.0 * sun.params.scale` rescales the minimum camera distance to the new star radius (`src/js/main.js:194` / `:273`).
6. `updateGUIDisplay()` walks every folder/controller and calls `controller.updateDisplay()` so the sliders reflect the new values (`src/js/main.js:308-316`).
7. HUD `STAR CLASS` chip is updated by swapping CSS classes (`yellow-dwarf`, `red-giant`, `blue-super`, `white-dwarf`) on `hudStarClass` (`src/js/main.js:200-213`, `:285-295`).

**State Management:**
- All scene-graph and renderer state lives as module-level `let` bindings in `main.js`. There is no store, observer, or reactive system.
- Sun parameters live on `sun.params` and are the single source of truth for both lil-gui sliders (via `gui.add(sun.params, 'fieldName', ...)`) and shader uniforms (kept in sync via `.onChange` callbacks and `setPreset()`).
- `isFlying`, `flightTargetPos`, `flightTargetLookAt`, `flightSpeed`, `timeSpeed`, `usePostProcessing`, and `lastTelemetryUpdateTime` are loose module-level variables.

## Key Abstractions

**`Sun` (composite class):**
- Purpose: A bundle of one solar body — core sphere, prominence shell, corona billboard, lens-flare group — plus the shared `params` object and methods to mutate every uniform consistently (`setPreset`, `update`, `updateLensFlares`).
- Examples: `src/js/sun.js:95-403`
- Pattern: Constructor-builds-everything composite; one stateful instance attached to `scene` via `this.group`.

**`createStarfield` (factory function):**
- Purpose: Returns a `THREE.Points` mesh with a custom `ShaderMaterial`; no class needed because there is no per-instance behavior beyond pushing `uTime`.
- Examples: `src/js/starfield.js:9-79`
- Pattern: Pure factory.

**`parseMKClassification` / `lookupHYGStar` (pure parsers):**
- Purpose: Take a string → return a Sun-parameter object (or `null`).
- Examples: `src/js/stellarClassifier.js:39-191`, `src/js/stellarClassifier.js:212-236`
- Pattern: Pure function with regex + lookup tables; no Three.js scene-graph side effects.

**GLSL template-string modules:**
- Purpose: Reusable shader snippets composed via JS string interpolation. `simplexNoiseGLSL`, `blackbodyGLSL`, and `valueNoiseGLSL` are concatenated into fragment shaders using `${...}` placeholders.
- Examples: `src/js/shaders.js:4-179` (helpers), `src/js/shaders.js:214` (`${valueNoiseGLSL}` injected into `surfaceFragmentShader`).
- Pattern: Header-include-by-string-template — the JS equivalent of `#include`.

## Entry Points

**HTML entry:**
- Location: `index.html`
- Triggers: Browser page load.
- Responsibilities: Mount DOM nodes (`#canvas-container`, `#space-hud`, `#control-panel`, `#gui-container`, `#loader`), load Google Fonts, load the stylesheet via Vite (imported in `main.js`), and bootstrap the JS module.

**JS entry:**
- Location: `src/js/main.js`
- Triggers: `window.onload = init` (`src/js/main.js:424`).
- Responsibilities: Build the scene graph, wire DOM events, mount lil-gui, and start the animation loop.

**Vite dev/build entry:**
- Location: `package.json` scripts (`vite`, `vite build`, `vite preview`).
- Triggers: `npm run dev` / `npm run build` / `npm run preview`.
- Responsibilities: Vite uses the root `index.html` as the entry; the build output is committed in `dist/` (`dist/index.html`, `dist/assets/index-*.js`, `dist/assets/index-*.css`).

## Architectural Constraints

- **Single-threaded:** Standard browser main-thread execution. No Web Workers, no `OffscreenCanvas`, no `SharedArrayBuffer`. All shader compilation and uniform updates happen on the main thread inside `animate()`.
- **Global state:** All long-lived references (`scene`, `camera`, `renderer`, `controls`, `gui`, `sun`, `starfield`, `composer`, `bloomPass`, `clock`, `timeSpeed`, `isFlying`, `flightTargetPos`, `flightTargetLookAt`, `flightSpeed`, `lastTelemetryUpdateTime`, `usePostProcessing`) live as module-level `let`/`const` bindings inside `src/js/main.js`. Other modules cannot read or mutate them — they must be wired through arguments (`new Sun(scene)`, `sun.update(elapsed, bloomPass.strength)`).
- **Circular imports:** None. The dependency DAG is `main.js → {sun.js, starfield.js, stellarClassifier.js}`, with `sun.js → shaders.js` and `starfield.js → shaders.js`. Leaf module `shaders.js` imports nothing.
- **WebGL 2 only:** `THREE.WebGLRenderer` from Three.js r184 picks WebGL2 by default; there is no WebGL1 fallback path.
- **Custom shaders are stringly-typed:** No type checking, no GLSL linting, no source maps for shader errors. Compilation failures surface only in the browser's WebGL warning channel.
- **Init order is implicit:** `setupGUI()` references `bloomPass`, `renderer`, `sun.params`, and `sun.<material>` — it must run after step 5 of `init()` (composer/bloom construction) and after step 4 (Sun construction). `setupHUDBindings()` references `sun`, so it also depends on step 4.
- **Pixel-ratio cap:** `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))` (`src/js/main.js:50`) — Retina displays render at 2×, not native, to bound fill-rate.
- **Half-resolution bloom:** `UnrealBloomPass` is constructed with `new THREE.Vector2(width/2, height/2)` and re-sized to `width/2 × height/2` in `onWindowResize()` (`src/js/main.js:77-82`, `:419`). The full-resolution composer output then upsamples; this is an intentional fill-rate optimization.

## Anti-Patterns

### Repetitive manual GUI ↔ uniform wiring

**What happens:** Every lil-gui slider has its own hand-written `.onChange(() => sun.coreMaterial.uniforms.uXxx.value = sun.params.xxx)` callback. There are ~15 such callbacks in `setupGUI()` (`src/js/main.js:127-168`), and each one duplicates the binding pattern.
**Why it's wrong:** Adding a new parameter requires editing both `sun.js` (constructor, `setPreset`) and `main.js` (`setupGUI`), and renaming a uniform requires updating ~3 places. It is the root cause of the very long `setPreset()` block (`src/js/sun.js:380-398`) that has to re-push every uniform after every preset change.
**Do this instead:** Add a small helper on `Sun` (e.g., `Sun.bindControl(folder, paramName, range, materialName, uniformName)`) that performs the slider creation, `onChange`, and uniform write in one call. Alternatively, drive uniforms directly off `sun.params` once per frame inside `sun.update()` (so `onChange` becomes a no-op and `setPreset` only needs to mutate `params`).

### Custom-class HUD update repeats preset HUD update

**What happens:** `setupHUDBindings()` contains a per-preset HUD update block (`src/js/main.js:200-213`) and a separate custom-class HUD update block (`src/js/main.js:279-295`) that re-derives the same `yellow-dwarf` / `red-giant` / `blue-super` / `white-dwarf` CSS classes from a different input (preset name vs. spectral letter), with subtly different branching.
**Why it's wrong:** Drift risk — the two branches can disagree about how to classify the same star.
**Do this instead:** Extract a `setHUDStarClass(displayName, temperatureOrSpectralPrefix)` helper that owns the CSS-class mapping; call it from both places.

### Ignored argument in `Sun.update`

**What happens:** `sun.update(elapsed, bloomPass.strength)` is called with `bloomPass.strength` (`src/js/main.js:401`), but `Sun.update(time, bloomStrength = 1.0)` never reads `bloomStrength` (`src/js/sun.js:266-281`).
**Why it's wrong:** Misleading API — readers expect bloom strength to drive corona behavior, but it does not.
**Do this instead:** Either consume `bloomStrength` (the comment at `src/js/sun.js:277` says "If the bloom is stronger, the corona spreads wider", but the implementation only uses `Math.sin(time * 0.8)`), or drop the parameter.

### Geometry parameters are not auto-rescaled with `sun.params.scale`

**What happens:** Core, prominence, and corona geometries are sized once at constructor time using the initial `this.params.scale` (`src/js/sun.js:130`, `:153`, `:178`). `setPreset()` then changes `group.scale` instead of rebuilding the geometry — relying on Three.js to multiply through.
**Why it's wrong:** Internally the corona shader expects a fixed `coreScaleDist = 0.416` ratio (`src/js/shaders.js:435`) and the prominence shell sits at `scale * 1.01`. Changing `params.scale` via the group works because the ratio is preserved, but anyone changing geometry constants in the constructor must remember this — there is no comment.
**Do this instead:** Document the invariant ("`group.scale` is the only path to resize; geometry constants must keep core:corona:prom ratio = 1 : 4.8 : 1.01") at the top of `Sun`.

## Error Handling

**Strategy:** Defensive ignore. The codebase is a single-page WebGL demo; there is no error-handling framework, no logger, no `try/catch`, and no Sentry-style reporter.

**Patterns:**
- **Parser returns `null` on bad input:** `parseMKClassification` and `lookupHYGStar` return `null` for unrecognized strings (`src/js/stellarClassifier.js:50`, `:235`). The caller in `main.js:applyCustomClass` checks for null and flashes the input border red for 1 s (`src/js/main.js:257-264`).
- **Shader/WebGL errors:** Not handled. If a shader fails to compile, Three.js writes a console warning and the affected mesh draws as transparent or black.
- **Asset/font loading:** `<link>` tags for Google Fonts use `rel="preconnect"` (no error handler). The loader bar (`#load-progress`) is advanced by hard-coded percentages (30 / 60 / 80 / 100) inside `init()`, not driven by real `LoadingManager` events (`src/js/main.js:64-97`).
- **Resize:** `onWindowResize()` unconditionally recomputes camera aspect, renderer size, composer size, and bloom size (`src/js/main.js:412-421`); no debounce.

## Cross-Cutting Concerns

**Logging:** None. There are no `console.log` / `console.warn` / `console.error` calls.

**Validation:** Inline only — regex validation in `parseMKClassification` (`src/js/stellarClassifier.js:47-50`) and range clamping for `baseTemp` (`src/js/stellarClassifier.js:90`).

**Authentication:** Not applicable (no backend).

**Configuration:** Hard-coded constants throughout (`composer` weights, autopilot target positions per `data-distance` attribute at `src/js/main.js:230-235`, magic numbers like `140.0` minimum camera distance, `800.0` units-per-AU, `25000-35000` starfield shell radius). There is no `config.js` or environment-variable layer.

**Asset loading:** All textures are procedural — `createGlowTexture`, `createRingTexture`, `createHexagonTexture` build `CanvasTexture` instances at runtime (`src/js/sun.js:13-93`). There are no image, GLTF, or HDR asset loads in the render pipeline. `src/assets/` (`hero.png`, `javascript.svg`, `vite.svg`) and `public/` (`favicon.svg`, `icons.svg`) hold static files but are not consumed by the runtime JS.

**GUI mounting:** lil-gui is mounted into a user-provided container (`document.getElementById('gui-container')`, `src/js/main.js:121`) rather than the default body-attached panel; this is why the glassmorphism wrapper in `#control-panel` works.

**Resource cleanup:** `updateLensFlares()` explicitly disposes prior `CanvasTexture` references (`this.currentGlowTexture.dispose()`) before generating new ones (`src/js/sun.js:215-217`) — a deliberate guard against GPU memory leaks when presets are changed rapidly.

---

*Architecture analysis: 2026-05-20*
