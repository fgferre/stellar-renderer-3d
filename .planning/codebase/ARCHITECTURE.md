<!-- refreshed: 2026-05-20 -->
# Architecture

**Analysis Date:** 2026-05-20

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                       Browser / DOM Layer                            │
│  `index.html`  (canvas-container, space-hud, control-panel,          │
│                  comparison-labels-container, loader)                │
│  `src/style.css`  (glassmorphism HUD, 3D label overlays)             │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │ window.onload
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                Application Orchestrator (Entry Point)                │
│                       `src/js/main.js`                                │
│  - Scene/Camera/Renderer/Composer bootstrap                          │
│  - lil-gui mounting + HUD DOM bindings                               │
│  - Autopilot flight + cinematic flyby timeline                       │
│  - Comparison-mode lifecycle + 3D HTML label projection              │
│  - requestAnimationFrame loop (telemetry, exposure, render)          │
└────────┬────────────────────┬─────────────────────┬─────────────────┘
         │                    │                     │
         ▼                    ▼                     ▼
┌────────────────────┐ ┌─────────────────┐ ┌───────────────────────┐
│   Sun class        │ │  Starfield      │ │  Stellar Classifier   │
│  `src/js/sun.js`   │ │ `src/js/        │ │ `src/js/              │
│                    │ │  starfield.js`  │ │  stellarClassifier.js`│
│  - core + prom +   │ │  - 6000 Points  │ │  - MK parser regex    │
│    corona + flare  │ │    on sky shell │ │  - blackbody color    │
│  - preset slots    │ │  - per-particle │ │  - HYG catalog map    │
│  - applyParams()   │ │    twinkle      │ │    (17 stars)         │
│  - update(time)    │ │                 │ │                       │
└────────┬───────────┘ └────────┬────────┘ └───────────────────────┘
         │                      │
         ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Shader Module (GLSL template literals)                  │
│                    `src/js/shaders.js`                                │
│  Helpers: simplexNoiseGLSL, blackbodyGLSL, valueNoiseGLSL            │
│  Programs: surface{V,F}, prominence{V,F}, corona{V,F},               │
│            starfield{V,F}                                            │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Three.js / WebGL 2 GPU pipeline                         │
│   ShaderMaterials → Mesh / Points → Scene → WebGLRenderer            │
│   Optional: EffectComposer (RenderPass → UnrealBloom → OutputPass)   │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| HTML shell | Canvas mount point, HUD markup, loader, label container | `index.html` |
| Stylesheet | Glassmorphism HUD, 3D label cards, loader animation | `src/style.css` |
| Orchestrator | Scene/camera/renderer setup, render loop, mode lifecycle, GUI, HUD events | `src/js/main.js` |
| Sun class | One stellar body: 3 shader meshes + lens flare + preset slots | `src/js/sun.js` |
| Shaders | GLSL helpers + 4 shader programs (surface, prominence, corona, starfield) | `src/js/shaders.js` |
| Starfield | Procedural BufferGeometry of 6000 twinkling points on a far shell | `src/js/starfield.js` |
| Classifier | MK spectral parser + Kelvin→RGB + HYG hard-coded catalog | `src/js/stellarClassifier.js` |
| Telemetry HUD | Live DOM read-outs (distance, velocity, temperature, mass, radius, luminosity) | `index.html` + `src/js/main.js` |
| 3D labels | DOM `<div>`s projected from world-space star positions per frame | `index.html` + `src/style.css` + `src/js/main.js:586-635` |

## Pattern Overview

**Overall:** Modular ES-module architecture with a single orchestrator (`main.js`) coordinating an object-oriented scene model (`Sun` class), a pure-function shader/material library (`shaders.js`), procedural factories (`starfield.js`), and a stateless data/parser library (`stellarClassifier.js`).

**Key Characteristics:**
- Single entry point (`src/js/main.js`) bootstrapped via `window.onload`. No bundler/router/state-manager abstraction beyond Vite's module graph.
- One class with composition (`Sun`) owns the entire visual stack for a single star: core sphere, prominence shell, corona billboard, lens-flare group, plus 4 preset state slots.
- Shaders are imported as tagged template-literal strings; GLSL helpers (`simplexNoiseGLSL`, `blackbodyGLSL`, `valueNoiseGLSL`) are composed via `${}` interpolation into program bodies.
- Mode switching (single-star vs. comparison vs. cinematic) is implemented as module-scoped boolean flags + an `activeFocusedStar` pointer rather than a formal state machine.
- HUD/UI logic lives directly in `main.js` (DOM `getElementById` + `addEventListener`). No framework/components.
- Animation is fully driven by a single `requestAnimationFrame` loop in `main.js:1081-1214` (`animate()`), with `THREE.Clock` providing `elapsed`/`delta`. Time is multiplied by `timeSpeed` for shader uniforms.

## Layers

**Presentation / DOM (HTML + CSS):**
- Purpose: Cockpit HUD chrome, 3D label cards, control panel, loader overlay.
- Location: `index.html`, `src/style.css`
- Contains: Static markup, glassmorphism styling, lil-gui theming overrides, mobile media queries.
- Depends on: Three.js renderer canvas (mounted in `#canvas-container`), lil-gui (mounted in `#gui-container`).
- Used by: All event-binding/projection code in `main.js`.

**Orchestrator / Application Layer:**
- Purpose: Bootstraps WebGL, owns mutable application state, drives the render loop.
- Location: `src/js/main.js`
- Contains: `init()`, `animate()`, mode handlers (`enterComparisonMode`, `exitComparisonMode`, `startCinematicFlyby`, `stopCinematicFlyby`), camera helpers (`updateCinematicCamera`, `updateAutoExposure`), HUD helpers (`updatePhysicalHUD`, `updateTelemetry`, `updateHTML3DLabels`), event-binding (`setupHUDBindings`, `setupGUI`).
- Depends on: `three`, `three/examples/jsm/controls/OrbitControls`, post-processing passes, `lil-gui`, `Sun`, `createStarfield`, `parseMKClassification`, `lookupHYGStar`, `kelvinToColorGrading`.
- Used by: The browser (via the `<script type="module">` tag in `index.html:154`).

**Scene-Object Layer (`Sun` class):**
- Purpose: Encapsulates one stellar body's geometry, materials, animation, and preset state.
- Location: `src/js/sun.js`
- Contains: `Sun` ES6 class with `initCore`, `initProminences`, `initCorona`, `initLensFlares`, `updateLensFlares`, `update`, `getPresetDefaultSettings`, `applyCurrentParams`, `resetCurrentPresetToDefault`, `setPreset`, `copyParams`, `getDefaultParams`. Module-private canvas-texture helpers (`createGlowTexture`, `createRingTexture`, `createHexagonTexture`).
- Depends on: `three`, `Lensflare`/`LensflareElement` from `three/examples/jsm/objects`, all `*Shader` exports from `./shaders.js`.
- Used by: `main.js:93` (the main sun) and `main.js:333-342` (each comparison-lineup star).

**Shader / GPU Layer:**
- Purpose: GLSL programs for the 4 procedural materials, plus reusable noise/blackbody helpers.
- Location: `src/js/shaders.js`
- Contains: Exported strings (`simplexNoiseGLSL`, `blackbodyGLSL`, `valueNoiseGLSL`, `surfaceVertexShader`, `surfaceFragmentShader`, `prominenceVertexShader`, `prominenceFragmentShader`, `coronaVertexShader`, `coronaFragmentShader`, `starfieldVertexShader`, `starfieldFragmentShader`).
- Depends on: Nothing (pure strings).
- Used by: `src/js/sun.js`, `src/js/starfield.js`.

**Data / Classification Layer:**
- Purpose: Translate physics input (Kelvin temperature, MK spectral string, catalog name) into shader-parameter objects consumable by `Sun.setPreset()`.
- Location: `src/js/stellarClassifier.js`
- Contains: `kelvinToColorGrading(temp)`, `parseMKClassification(spectralString)`, `HYG_DATABASE` constant (17 catalog entries), `lookupHYGStar(nameQuery)`.
- Depends on: `three` (only for `THREE.Vector3`).
- Used by: `main.js:163-220, 884-944` (custom-class input + GUI temp slider) and `main.js:318-342` (12-star lineup population).

## Data Flow

### Primary Request Path (page load → first frame)

1. Browser parses `index.html` and fires `window.onload` (`src/js/main.js:1228`).
2. `init()` (`src/js/main.js:60-153`) constructs `THREE.Scene`, `PerspectiveCamera` (FOV 45, far 500000), `WebGLRenderer` with ACES tone mapping, and attaches `OrbitControls`.
3. `new Sun(scene)` (`src/js/main.js:93`) calls `Sun` constructor (`src/js/sun.js:143-166`) which instantiates 4 preset slots, then runs `initCore` (surface mesh, sphere 100u, 80×80 segs), `initProminences` (shell at 101u, 140×140 segs, additive blend), `initCorona` (480-unit billboard plane), `initLensFlares`.
4. `createStarfield(6000)` (`src/js/main.js:114`) builds a `THREE.Points` cloud on a 25k-35k unit radius shell and is added to the scene.
5. `EffectComposer` is wired with `RenderPass` → `UnrealBloomPass` (half-res, strength 1.8) → `OutputPass` (`src/js/main.js:118-133`).
6. `setupHUDBindings()` (`src/js/main.js:762-967`) wires preset buttons, autopilot nav buttons, comparison toggle, scale-mode toggle, cinematic-flyby button, custom-class input. `setupGUI()` (`src/js/main.js:174-284`) mounts `lil-gui` inside `#gui-container` with 5 folders.
7. Loader fades out, `window` resize listener attaches, `animate()` starts.

### Render Loop Frame Path (`animate()` at `src/js/main.js:1081-1214`)

1. `requestAnimationFrame(animate)` is re-queued.
2. `delta = clock.getDelta()`, `elapsed = clock.getElapsedTime() * timeSpeed`.
3. Camera update branch:
   - If `isCinematicMode`: `cinematicTime += delta`; `updateCinematicCamera()` selects one of 4 timed shot blocks and writes `camera.position` + `controls.target` directly.
   - Else if `isFlying`: `camera.position.lerp(flightTargetPos, 0.035)`, `controls.target.lerp(flightTargetLookAt, 0.035)`. Auto-cancels when within scale-aware threshold.
   - Otherwise user input drives `OrbitControls`.
4. `controls.update()` (with damping 0.05).
5. `starfield.position.copy(camera.position)` — the sky shell follows the camera so it never gets clipped.
6. Distance to `activeFocusedStar.group.position` (or `sun`) is computed for telemetry + exposure.
7. `updateAutoExposure(distance)` (`src/js/main.js:1006-1042`) eases `renderer.toneMappingExposure` toward a target derived from normalized distance, eases bloom strength/threshold, and toggles lens flares off when very close.
8. Every >0.1s real time, `updateTelemetry(distance, delta)` updates HUD DOM read-outs (AU distance, Keplerian velocity, blackbody sensor temp).
9. Per-star update:
    - If `isComparisonMode`: iterate `comparisonStars`, compute target X/Y/Z from `comparisonBasePositions` + cinematic choreography blocks (`cinematicTime < 6` assembly, `7-16` David & Goliath transit), lerp `star.group.position` toward target at 0.15, then `star.update(elapsed, bloomPass.strength)`.
    - Else: `sun.update(elapsed, bloomPass.strength)` → writes `uTime` uniforms on all 3 materials, rotates the group on Y, applies pulsation/oblateness scale, pulses the corona billboard slightly.
10. `starfield.material.uniforms.uTime.value = elapsed`.
11. `updateHTML3DLabels()` (`src/js/main.js:586-635`) projects each comparison-star world position through `camera.matrixWorldInverse` + `camera.projectionMatrix` to CSS pixel coords and writes `style.left`/`style.top` on each `.star-label-3d` div.
12. Render branch: `usePostProcessing` selects `composer.render()` vs. direct `renderer.render(scene, camera)`. Default is direct (60 FPS target).

### 12-Star Comparison Lineup Orchestration

1. User clicks `#btn-comparison-mode` → `enterComparisonMode()` (`src/js/main.js:287-394`).
2. `mainSunParamsBackup` snapshots the main sun's parameters to prevent leaks on exit.
3. `controls.maxDistance` is widened to 20,000,000 and `camera.far` to 30,000,000 to accommodate the huge linear lineup.
4. On first entry, a lazy `comparisonGroup = new THREE.Group()` is added to the scene. The 12-star lineup is hard-coded (`src/js/main.js:318-332`): Sirius B, Proxima Centauri, Sun (Sol), Sirius A, Vega, Arcturus, Aldebaran, Rigel, Deneb, Antares, Betelgeuse, UY Scuti.
5. For each entry, `new Sun(comparisonGroup)` instantiates a full Sun child, `lookupHYGStar(query)` returns a parameter object from the HYG catalog (`src/js/stellarClassifier.js:329-348`), `star.setPreset(settings)` applies it, and `displayName`/`visualScaleDefault` are stored on the instance.
6. Focus-target buttons and label `<div>`s are generated dynamically into `#comparison-focus-grid` and `#comparison-labels-container`.
7. `updateComparisonLayout()` (`src/js/main.js:501-576`) computes X positions along a line:
   - `comparisonScaleMode === 'visual'`: uses `visualScaleDefault` (log-compressed) with tight 8% gaps + 20u offset, for the educational-poster look.
   - `comparisonScaleMode === 'real'`: uses raw `params.radius` for linear/proportional spacing with 1.5× radius gaps + 200u offset.
8. `focusOnComparisonStar(2)` defaults focus to Sol; the active star's X drives flight target + GUI sync + HUD class code.
9. Exit via `exitComparisonMode()` restores `mainSunParamsBackup`, camera limits, HUD, and flies the camera back to origin.

### Cinematic Flyby Coordination

The cinematic system uses a single `cinematicTime` accumulator (seconds) and four hard-coded timeline shots in `updateCinematicCamera()` (`src/js/main.js:675-759`):

| Shot | Time window | Behavior |
|------|-------------|----------|
| Take 1 — Stellar Assembly Pan | 0.0 – 7.0 s | `camera.position.lerpVectors(startCam, endCam, ease)` between two `THREE.Vector3` endpoints anchored to Sirius B and Sol. `ease = t*t*(3-2*t)` (smoothstep). |
| Take 2 — David & Goliath Eclipse / Transit | 7.0 – 16.0 s | Camera locks in front of Betelgeuse (`posLast - D_giant`); individual stars (Sirius B, Sol, Rigel) are choreographed across the camera frustum at 4/16/42% screen height, with `targetZ` interpolated between `±zLim` using a per-star `tTake2` offset. Per-star transit math lives inside the `animate()` loop at `src/js/main.js:1146-1184`. |
| Take 3 — Supersonic Photosphere Canyon Flight | 16.0 – 27.0 s | `currentX = lerp(pos0, posLast, ease)`. Nearest-star scan picks `nearestStar` to compute frame-by-frame `height`, `depth`, sinusoidal `wobbleY`/`wobbleZ` for "speed" feel. |
| Take 4 — Cosmic Landscape Pullback | 27.0 – 38.0 s | Dynamic pullback distance fits the full lineup (`pos0 → posLast`) inside the viewport using FOV math. After 38 s, `stopCinematicFlyby()` is invoked. |

Star body positions are simultaneously interpolated in `animate()` (`src/js/main.js:1124-1193`) using `THREE.MathUtils.lerp(currentPosition, targetPosition, 0.15)` per axis, so star choreography eases independently from camera shot timing.

**State Management:**
- All mutable state is held as `let`-bound module-scope variables at the top of `main.js`: `scene, camera, renderer, controls, gui, sun, starfield, composer, bloomPass, clock, timeSpeed, isFlying, flightTargetPos, flightTargetLookAt, flightSpeed, isComparisonMode, comparisonGroup, comparisonStars, activeFocusedStar, comparisonScaleMode, mainSunParamsBackup, isCinematicMode, cinematicTime, comparisonBasePositions`.
- Per-star state is encapsulated on each `Sun` instance: `group, coreMesh, coreMaterial, promMesh, promMaterial, coronaMesh, coronaMaterial, flareGroup, params, presetStates, currentPresetName, displayName, visualScaleDefault, currentGlowTexture, currentRingTexture, currentHexTexture`.
- No external store, no React/Vue/Svelte reactivity, no event bus.

## Key Abstractions

**`Sun` (class — `src/js/sun.js:95-530`):**
- Purpose: Procedurally generated star body — owns 3 `ShaderMaterial`-backed meshes (core sphere, prominence shell, corona billboard) plus a procedural lens-flare group inside a single `THREE.Group`.
- Pattern: Composition over inheritance. Internally maintains a `presetStates` map (`sol`/`redgiant`/`bluesuper`/`whitedwarf`/`custom`) so each preset retains user edits when switching back.
- Examples: `new Sun(scene)` (`main.js:93`), `new Sun(comparisonGroup)` (`main.js:334`).

**Shader template literals (`src/js/shaders.js`):**
- Purpose: GLSL programs as tagged template strings, with `${helperGLSL}` interpolation for code reuse.
- Pattern: Helpers (`simplexNoiseGLSL`, `valueNoiseGLSL`, `blackbodyGLSL`) are interpolated into fragment-shader bodies (e.g. `src/js/shaders.js:217` injects `valueNoiseGLSL` into `surfaceFragmentShader`).
- Examples: `surfaceFragmentShader`, `prominenceFragmentShader`, `coronaFragmentShader` all consume `${blackbodyGLSL}` for stellar-temperature → RGB conversion.

**Parameter object (`params`):**
- Purpose: A plain JS object of ~25 scalar/Vector3 fields that fully describes a star's visual appearance and physical metadata.
- Pattern: Shape defined by `Sun.getDefaultParams()` (`src/js/sun.js:96-127`); cloned/copied via `Sun.copyParams(source, target)` (`src/js/sun.js:129-141`) which deep-copies `THREE.Vector3` fields.
- Examples: `sun.params`, every entry of `comparisonStars[i].params`, the return value of `parseMKClassification()`, the return value of `lookupHYGStar()`.

**Preset slot map (`presetStates`):**
- Purpose: Persist 5 independent star configurations on each `Sun` instance, so the user can flip between `sol`, `redgiant`, `bluesuper`, `whitedwarf`, and `custom` without losing prior edits.
- Pattern: When `setPreset(name)` runs (`src/js/sun.js:504-529`), the *current* `params` is first copied back into its slot, then the new slot is loaded and `applyCurrentParams()` writes all uniforms.

**HYG_DATABASE catalog (`src/js/stellarClassifier.js:329-348`):**
- Purpose: Hard-coded lookup of 17 famous stars (Sun, Sirius A/B, Betelgeuse, Rigel, Vega, Aldebaran, Polaris, Proxima Centauri, Canopus, Arcturus, Antares, Deneb, Altair, UY Scuti).
- Pattern: `lookupHYGStar()` (`src/js/stellarClassifier.js:350-404`) takes a normalized name key, runs `parseMKClassification()` on the catalog `spect` field, then overrides `mass`/`radius`/`lum`/`vRot`/`colorGrading` with the catalog values and applies per-star physical hand-tuning (e.g. Vega oblateness 0.83, Betelgeuse rotation 0.002).

## Entry Points

**`window.onload` → `init()`:**
- Location: `src/js/main.js:1228`
- Triggers: Browser finishes parsing `index.html` and loading the module graph.
- Responsibilities: Bootstrap the entire app (scene, camera, renderer, post-processing, sun, starfield, GUI, HUD bindings, animation loop).

**Vite `<script type="module">`:**
- Location: `index.html:154` — `<script type="module" src="/src/js/main.js"></script>`.
- Triggers: ES-module graph load; pulls in `three`, `lil-gui`, and the project's 5 modules transitively.
- Responsibilities: Single bundler entry for `vite build`.

**Vite config:**
- No explicit `vite.config.*` file detected at the project root. Vite uses its defaults: project root is the repo, `index.html` is the implicit entry, output goes to `dist/`.

## Architectural Constraints

- **Threading:** Single-threaded (browser main thread). All animation/rendering runs inside `requestAnimationFrame`. No Web Workers, no `OffscreenCanvas`, no GPU compute beyond the WebGL pipeline.
- **Global state:** All application state is module-scope `let` bindings at the top of `src/js/main.js:14-46`. No singleton wrapper; the orchestrator IS the singleton.
- **Circular imports:** None observed. The dependency graph is a DAG: `main → {sun, starfield, classifier}`; `{sun, starfield} → shaders`; `classifier → three only`.
- **DOM coupling:** `main.js` directly reaches into DOM via `document.getElementById` and `document.querySelectorAll` at module load time (`main.js:48-57`), meaning the file is unusable without `index.html`'s exact element IDs (`val-distance`, `val-velocity`, `hud-star-class`, `comparison-focus-grid`, `comparison-labels-container`, `btn-preset-sol`, `btn-comparison-mode`, `btn-cinematic-flyby`, `btn-scale-visual`, `btn-scale-real`, `input-custom-class`, `btn-apply-custom-class`, `gui-container`, `control-panel`, `toggle-panel`, etc.).
- **WebGL 2 / Three.js version coupling:** Three.js `^0.184.0` is required; the post-processing imports (`OutputPass`) and shader uniform conventions (`vec3`, no `precision` line) target WebGL2-class behavior.
- **Cinematic-mode constraint:** `controls.enabled = false` during cinematic flyby (`main.js:644`), so any user pointer interaction during the cinematic is intentionally ignored. Restored on `stopCinematicFlyby()` (`main.js:661`).
- **Memory:** Lens-flare textures are explicitly `.dispose()`-ed in `Sun.updateLensFlares()` (`src/js/sun.js:259-261`) to prevent GPU leaks on preset switches. Geometries and ShaderMaterials are *not* disposed on mode-exit; they live for the lifetime of the page.

## Anti-Patterns

### Mixed concerns in the orchestrator

**What happens:** `src/js/main.js` (1,228 lines) blends scene setup, render loop, lil-gui mounting, raw DOM event binding, HUD text formatting, autopilot easing, cinematic timeline math, comparison-mode lifecycle, and 3D-to-2D label projection in a single module-scope namespace.
**Why it's wrong:** Any change to one subsystem (e.g. timeline shot timing) requires editing the same file as unrelated subsystems (e.g. preset button styling), and module-scope `let` flags (`isFlying`, `isCinematicMode`, `isComparisonMode`) are mutated from many call sites with no encapsulation. Future contributors must read the entire file to find related state.
**Do this instead:** Split into focused modules — e.g. `src/js/cameraController.js` (autopilot + cinematic), `src/js/comparisonMode.js` (lineup lifecycle + layout), `src/js/hudBindings.js` (DOM event wiring), `src/js/telemetry.js` (DOM read-out formatting). Use a small event bus or pass `state` objects explicitly.

### Cinematic choreography duplicated across functions

**What happens:** The cinematic per-shot timeline lives in two places: `updateCinematicCamera()` (`src/js/main.js:675-759`) handles camera math for shots 1-4, while the per-star choreography for Take 2 (David & Goliath transit) is duplicated inline inside `animate()` (`src/js/main.js:1137-1185`). Both use the same `cinematicTime` global and identical FOV math.
**Why it's wrong:** Changing a shot timing or screen-percentage requires synchronized edits in two locations, and the per-star block in `animate()` is hard to find when looking at "cinematic" logic.
**Do this instead:** Move all per-frame cinematic updates into `updateCinematicCamera()` (or rename it `updateCinematic()`) and have it return / mutate both camera and star positions in one place.

### Magic numbers / hand-tuned constants

**What happens:** Numeric constants are scattered throughout the codebase with little to no commentary — e.g. flight easing factor `0.035` (`main.js:32`), starfield shell radius `25000 + Math.random() * 10000` (`starfield.js:26`), sphere radius `100.0` baked into both `Sun.initCore` (`sun.js:170`) and `updateComparisonLayout()` spacing math (`main.js:520, 538`), corona size `480.0` (`sun.js:222`), AU scale `1 AU = 800 units` (`main.js:1050`).
**Why it's wrong:** Tweaking the visual scale of stars requires hunting through both `sun.js` and `main.js`. The implicit "100u = 1 sun radius" contract between `Sun` and `main.js` is invisible.
**Do this instead:** Extract a `src/js/constants.js` module exporting named constants (`SUN_RADIUS_UNITS`, `UNITS_PER_AU`, `STARFIELD_SHELL_INNER`, `STARFIELD_SHELL_THICKNESS`, `CINEMATIC_TAKE_DURATIONS`, etc.).

### DOM lookups at module-load time

**What happens:** Top-of-file `document.getElementById('val-distance')` etc. (`main.js:48-57`) run at module evaluation, before `init()`, before the loader fades, and before `window.onload`.
**Why it's wrong:** If the HTML structure changes or any of these IDs disappears, the module silently captures `null` and later `valDistance.textContent = ...` throws. There is no defensive guard.
**Do this instead:** Move all DOM-lookup constants into `init()` (or `setupHUDBindings()`) after the DOM is known to be ready, and validate `if (!el) throw new Error('missing #val-distance')`.

### Hard-coded 12-star list with positional indices

**What happens:** The comparison lineup is a 12-element array in `enterComparisonMode()` (`main.js:318-332`) and the cinematic Take 2 references `index === 0`, `index === 2`, `index === 7` directly (`main.js:1156, 1166, 1176`).
**Why it's wrong:** Re-ordering the lineup (or adding a star) requires manually updating index references in multiple places, including inside the inner `animate()` loop.
**Do this instead:** Tag stars by stable identifier (e.g. `query: "SIRIUSB"`) and look up indices via `.findIndex()`, or move the lineup to a config object that maps role names (`'transit-small'`, `'transit-medium'`, `'transit-giant'`) to query strings.

## Error Handling

**Strategy:** Defensive optional chaining + silent no-ops. There is no `try/catch`, no error reporter, no logger framework.

**Patterns:**
- Null guards via `if (!star || !star.params) return;` (`main.js:1008, 1047, 1068`).
- Optional-chaining for DOM queries: `document.querySelector('.nav-btn[data-distance].active')?.getAttribute(...)` (`main.js:563`).
- Invalid user input on the custom-class field flashes the input border red for 1 s and returns silently (`main.js:902-908`).
- `parseMKClassification()` returns `null` on regex mismatch (`stellarClassifier.js:58`) and callers branch on that.
- `lookupHYGStar()` returns `null` when the key is unknown (`stellarClassifier.js:403`).

## Cross-Cutting Concerns

**Logging:** None. No `console.log`/`console.warn` calls observed in the production code path.

**Validation:** Only the MK spectral regex in `parseMKClassification()` (`stellarClassifier.js:55`). GUI sliders use built-in `lil-gui` min/max/step clamping.

**Authentication:** Not applicable (client-only renderer, no backend).

**Configuration:** No config files. All "configuration" is hard-coded into `src/js/sun.js` (`getPresetDefaultSettings`) and `src/js/stellarClassifier.js` (`HYG_DATABASE`).

**Asset Loading:** Vite static-imports `../style.css` from `main.js:9`. Other assets in `src/assets/` (`hero.png`, `javascript.svg`, `vite.svg`) and `public/` (`favicon.svg`, `icons.svg`) are not referenced from any JS source — they are leftover Vite scaffold files. All textures are procedurally generated at runtime (`createGlowTexture`, `createRingTexture`, `createHexagonTexture` in `src/js/sun.js:13-93`). Google Fonts (`Orbitron`, `Outfit`) are loaded via `<link>` in `index.html:13-15`.

---

*Architecture analysis: 2026-05-20*
