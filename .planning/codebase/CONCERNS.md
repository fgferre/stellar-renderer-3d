# Codebase Concerns

**Analysis Date:** 2026-05-20

## Tech Debt

**Fragile DOM Initialization at Module Load:**
- Issue: DOM elements are queried at module top-level via `document.getElementById` before `init()` runs, with no null-checks before `.querySelector` chaining.
- Files: `src/js/main.js:29-34`
- Impact: Line 32 (`document.getElementById('hud-star-class').querySelector('.reading-value')`) throws `TypeError` if the `#hud-star-class` element is missing or if the script is loaded before DOM parsing completes. The script is loaded as a module (deferred) from `index.html:110`, so this works in practice, but the pattern remains fragile to template renaming.
- Fix approach: Move DOM queries inside `init()` (called via `window.onload` at `src/js/main.js:424`), or use optional chaining and null guards.

**Repeated Inline Uniform Wiring in GUI Setup:**
- Issue: Each `gui.add(...)` call inlines an explicit `onChange` lambda that copies a `sun.params` value into `sun.coreMaterial.uniforms.X.value`. The same param-to-uniform pairing is then duplicated in `Sun.setPreset()` lines 381-398.
- Files: `src/js/main.js:127-148`, `src/js/sun.js:381-398`
- Impact: Adding a new parameter requires synchronized edits in three places (params init, GUI binding, `setPreset` uniform write). Easy to drift.
- Fix approach: Centralize a `params → uniforms` mapping table and use it both for the GUI bindings and inside `setPreset()`.

**Bidirectional Coupling Between `main.js` and `Sun` Internals:**
- Issue: `main.js` reaches into `sun.coreMaterial.uniforms.uHighTemp.value` directly (lines 127-148) rather than going through a setter on `Sun`. `main.js` also mutates `sun.params.lensFlaresEnabled` from `updateAutoExposure` (lines 340-347).
- Files: `src/js/main.js:127-148`, `src/js/main.js:340-347`
- Impact: `Sun` cannot enforce invariants on its own state; consumers depend on private fields.
- Fix approach: Expose `Sun.setUniform(name, value)` or per-parameter setters that internally update both `params` and uniforms.

**Hardcoded Magic Numbers Scattered Across Files:**
- Issue: Physical and scene constants are inlined throughout the codebase instead of being centralized in a single config module:
  - Scene scale ratio `800.0 units = 1 AU` (`src/js/main.js:353`)
  - Earth orbital reference `29.78 km/s` (`src/js/main.js:357`)
  - Sun reference temp `5778 K` (`src/js/stellarClassifier.js:194-195, 217`)
  - Auto-exposure normalization range `140.0`/`5860.0` (`src/js/main.js:321`)
  - Lens flare distance threshold `170.0` (`src/js/main.js:340-343`)
  - Starfield shell radius `25000-35000` (`src/js/starfield.js:26`)
  - Far clip plane `500000`, max zoom `150000.0` (`src/js/main.js:44, 61`)
  - Corona billboard radius ratio `100.0 / 240.0 = 0.416` (`src/js/shaders.js:434-435`)
- Impact: Tuning the simulation requires hunting through three or four files; the corona shader's `coreScaleDist = 0.416` is a hand-computed constant that will silently desync if `coronaSize` (`src/js/sun.js:178`) or core scale changes.
- Fix approach: Create `src/js/config.js` (or `constants.js`) exporting `SCENE_SCALE`, `T_SUN`, `CORONA_RADIUS_RATIO`, etc. Pass `coreScaleDist` to the shader as a uniform rather than a hardcoded literal.

**Hardcoded DOM IDs Throughout `main.js`:**
- Issue: 10+ string IDs (`#canvas-container`, `#gui-container`, `#control-panel`, `#toggle-panel`, `#val-distance`, `#val-velocity`, `#val-temperature`, `#hud-star-class`, `#load-progress`, `#loader`, `#input-custom-class`, `#btn-apply-custom-class`) are hardcoded as inline string literals.
- Files: `src/js/main.js:29-34, 54, 121, 172-173, 240-241`
- Impact: Renaming any HTML id silently breaks the app at runtime with no compile-time warning.
- Fix approach: Extract into a constants object: `const DOM_IDS = { canvasContainer: 'canvas-container', ... }`.

**Duplicated Texture Generation Logic:**
- Issue: `createGlowTexture`, `createRingTexture`, `createHexagonTexture` (`src/js/sun.js:13-93`) each repeat the same boilerplate: create canvas, get 2D context, decompose `THREE.Color` into r/g/b ints, fill, return `THREE.CanvasTexture`.
- Files: `src/js/sun.js:13-93`
- Impact: ~80 lines that could be ~25 with a shared helper.
- Fix approach: Extract `withCanvasTexture(size, drawFn)` helper.

**Duplicated `sol` Preset Defaults:**
- Issue: The default Sol parameters are written once in the `Sun` constructor (`src/js/sun.js:101-120`) and again inside `setPreset('sol')` (`src/js/sun.js:291-308`). The two copies differ subtly — `lowTemp` is `4200.0` in the constructor vs. `4400.0` in the preset.
- Files: `src/js/sun.js:101-120`, `src/js/sun.js:291-308`
- Impact: The first-load "Sol" state does not match the state restored when the user clicks the Sol preset button. Subtle and easy to miss.
- Fix approach: Define presets in a module-level constant, then call `setPreset('sol')` from the constructor.

**Empty `simplexNoiseGLSL` Export Unused for Surface Shader:**
- Issue: `shaders.js` exports both `simplexNoiseGLSL` and `valueNoiseGLSL`, but the surface fragment shader uses only `valueNoiseGLSL` while prominences/corona use `simplexNoiseGLSL`. This is intentional, but the comment header at `src/js/shaders.js:1` (`Custom GLSL 3.0 / WebGL 2 Shaders`) is misleading — the shaders contain no GLSL 3.00 ES `#version` directive and rely on Three.js to inject the version. The "WebGL 2" claim in the comment, HTML title, and footer is mostly cosmetic.
- Files: `src/js/shaders.js:1`, `index.html:9, 93`
- Impact: No actual breakage, but a future contributor may believe GLSL ES 3.00 features (e.g., `texture()` over `texture2D()`, integer ops, `in/out` qualifiers) can be used and find them broken.
- Fix approach: Either upgrade `THREE.ShaderMaterial` to `THREE.RawShaderMaterial` with explicit `#version 300 es`, or remove the "WebGL 2" wording and the GLSL 3.0 comment.

## Known Bugs

**Resize Handler Runs Before `composer` is Defined Under Some Loads:**
- Symptoms: `composer.setSize(...)` at `src/js/main.js:417` is called unconditionally inside `onWindowResize`. While `init()` registers the listener only after creating the composer, any resize fired between `composer = ...` (line 86) and `window.addEventListener('resize', ...)` (line 105) is impossible — but if `init` ever fails partway, the listener might still be attached, leading to a `TypeError: Cannot read properties of undefined`.
- Files: `src/js/main.js:412-421`
- Trigger: Errors during scene construction (e.g., WebGL context failure) followed by a window resize.
- Workaround: Add `if (composer) composer.setSize(...)`.

**`updateTelemetry` Receives `delta` But Never Uses It:**
- Symptoms: Line 351 declares `function updateTelemetry(distance, delta)` and the caller passes `delta` (line 396), but the parameter is never referenced. Telemetry values are recomputed every tick rather than smoothed over `delta`, so the displayed sensor temperature and orbital speed jitter visibly if the user spins the camera quickly.
- Files: `src/js/main.js:351-366`, `src/js/main.js:396`
- Trigger: Any camera movement.
- Workaround: Either remove the unused param or use it to lerp the displayed values toward their targets.

**Custom Class Parser Regex Edge Case for Single-Digit Subclass with No Luminosity:**
- Symptoms: Regex `/^([OBAFGKM]|D[ABCOQXY])([0-9]?)(I[AB]|I{1,3}|IV|V|VI|VII)?$/` at `src/js/stellarClassifier.js:47`. A plain spectral letter like `"G"` would parse with `subclass=''` → defaulted to `5`, and `lumClass=undefined` → defaulted to `V`. This is fine, but `"DA"` (white dwarf no subclass) yields `subclass=5`, `lumClass='VII'`. `"DAVI"` would not match (no digit between `DA` and `VI`). The HYG entry `"VEGA"` (`A0V`) does parse, but a query like `"vega "` (trailing space stripped) is normalized correctly by `lookupHYGStar` (line 213 strips non-alphanumerics) yet `parseMKClassification` (line 41) only trims whitespace and uppercases — internal whitespace inside an MK string would still pass through `.replace(/\s+/g, '')`, which actually handles it. So no real bug here, but the two normalization functions diverge.
- Files: `src/js/stellarClassifier.js:41`, `src/js/stellarClassifier.js:213`
- Trigger: Passing strings with mixed separators like `"G-2-V"` succeeds in HYG lookup but fails MK parse.
- Workaround: Unify normalization (strip `[^A-Z0-9]` in both code paths).

**`isFlying` Never Clears `flightTargetLookAt`:**
- Symptoms: `flightTargetLookAt` is declared as `new THREE.Vector3(0, 0, 0)` (`src/js/main.js:25`) and is lerped into `controls.target` each frame while flying. The `nav-btn` handlers (lines 218-237) set `flightTargetPos` but never write `flightTargetLookAt`, so it permanently remains `(0,0,0)`. Functionally this works because the star sits at origin, but it is dead code that obscures intent.
- Files: `src/js/main.js:25`, `src/js/main.js:218-237`, `src/js/main.js:378`
- Trigger: Any autopilot button click.
- Workaround: Either remove `flightTargetLookAt` entirely or wire it to a per-button target.

**`updateAutoExposure` Force-Toggles `lensFlaresEnabled` Every Frame:**
- Symptoms: Lines 340-347 set `sun.params.lensFlaresEnabled = false` then call `sun.updateLensFlares()` whenever camera distance < 170. Each toggle re-disposes the old canvas textures and creates three new ones (~512×512, 512×512, 128×128) via `document.createElement('canvas')`. While the `false` branch returns early without allocating, the camera hovering near the threshold causes `updateLensFlares` to be called twice per frame transition.
- Files: `src/js/main.js:340-347`, `src/js/sun.js:208-263`
- Trigger: Camera oscillation around distance ≈ 170 (very common with damped orbit controls).
- Workaround: Track previous state and call `updateLensFlares()` only on actual transitions.

## Security Considerations

**External Font CDN Without SRI or CSP:**
- Risk: `index.html:13-15` loads `https://fonts.googleapis.com/css2` and pre-connects to `https://fonts.gstatic.com`. No `Content-Security-Policy` header, no Subresource Integrity hash. A compromised Google Fonts endpoint could inject arbitrary CSS that, while unlikely to execute JS, could exfiltrate IP/User-Agent for every page visit.
- Files: `index.html:13-15`
- Current mitigation: `crossorigin` attribute on the preconnect; no JS is served from these origins.
- Recommendations: Add a `<meta http-equiv="Content-Security-Policy" content="...">` block restricting `font-src` to `https://fonts.gstatic.com` and `style-src` to `'self' https://fonts.googleapis.com 'unsafe-inline'` (Vite injects inline styles). For a fully self-contained build, vendor the Orbitron + Outfit fonts locally.

**No CSP Configured:**
- Risk: The HTML page ships with no CSP, no `X-Content-Type-Options`, no `Referrer-Policy`. While this is a client-only WebGL renderer with no remote data fetches besides fonts, future contributors might add `fetch()` calls (e.g., to a star catalog API) without realizing the page is unprotected.
- Files: `index.html` (entire file)
- Current mitigation: No dynamic HTML injection (`innerHTML` is never used in `src/`); `eval`/`Function` are absent.
- Recommendations: Add a minimal CSP `<meta>` allowing only `'self'` for scripts and the fonts domain for styles.

**User Input Surfaced Into DOM Without Validation:**
- Risk: `applyCustomClass` reads `customInput.value` (`src/js/main.js:244`) and on success writes it to `hudStarClass.textContent` (`src/js/main.js:295`). `textContent` (not `innerHTML`) is used, which neutralizes any XSS payload. However, the input has no length cap, so a user could paste a 10 MB string and force a heavy regex match on `src/js/stellarClassifier.js:47`. The regex is anchored with `^...$` so it short-circuits quickly, but the `.toUpperCase()` and `.replace(/\s+/g, '')` on the full string still allocate.
- Files: `src/js/main.js:244`, `src/js/stellarClassifier.js:41`
- Current mitigation: `textContent` write is safe from XSS; regex is anchored.
- Recommendations: Add `customInput.maxLength = 16` either on the HTML element (`index.html:70`) or programmatically.

## Performance Bottlenecks

**High-Polygon Spheres for the Prominence Shell:**
- Problem: `promGeometry = new THREE.SphereGeometry(scale * 1.01, 140, 140)` (`src/js/sun.js:153`) yields ~39,000 vertices, each running a multi-octave Simplex noise vertex shader. The core sphere is 80×80 (~12,800 vertices). Combined with the corona plane and starfield (6,000 points), this is fine on desktop GPUs but will struggle on integrated mobile GPUs.
- Files: `src/js/sun.js:130, 153`
- Cause: Static high tessellation regardless of camera distance.
- Improvement path: Implement LOD — swap to a 60×60 or 40×40 sphere when `camera.position.length() > 5000`; or use Three.js `LOD` helper.

**Per-Frame Heavy Shaders With No Distance-Based Quality Scaling:**
- Problem: The surface fragment shader runs three `warpedFbm3D` calls (each = 3 octaves × value noise × warp = 27 noise samples per pixel). Plus sunspot and plage `fbm3D` (~6 more samples each). At 1080p, this is ~26 million noise samples per frame for the surface alone, and the framerate is not adaptive.
- Files: `src/js/shaders.js:200-305`, `src/js/sun.js:130-148`
- Cause: Shader complexity is constant; no LOD or fewer octaves at far distances.
- Improvement path: Pass an `uQualityLevel` uniform driven by `camera.position.length()` and reduce FBM octaves (3 → 2 → 1) at distance.

**Corona Billboard Discards Roughly 75 Percent of Fragments:**
- Problem: The corona plane (`src/js/sun.js:179`) is `coronaSize × coronaSize` (`scale * 4.8 * scale * 4.8`). The fragment shader discards everything outside `uvDist > 0.5` (a circle inscribed in the square — ~21 percent waste) and again everything inside `scaleDist < 0.416` (the core silhouette — another ~17 percent). That is overdraw of ~38 percent of the plane's pixels with shader work that ends in `discard`.
- Files: `src/js/sun.js:179`, `src/js/shaders.js:421-440`
- Cause: Square-plane billboard for a circular volumetric effect.
- Improvement path: Use a circular geometry (`THREE.CircleGeometry` or a sphere mesh) or a tight quad with hardcoded UV bounds that exclude the core.

**`UnrealBloomPass` Allocated Even When Disabled:**
- Problem: `usePostProcessing = false` by default (`src/js/main.js:20`), yet `EffectComposer`, `RenderPass`, `UnrealBloomPass`, and `OutputPass` are constructed unconditionally during `init()` (lines 75-89). `UnrealBloomPass` allocates a chain of MIPmap render targets (~5 levels of half-resolution textures); on a 1080p screen this reserves ~6 MB of GPU memory that is unused. Worse, `updateAutoExposure` writes `bloomPass.strength = 0.0` every frame even in direct-render mode (line 335).
- Files: `src/js/main.js:20, 75-89, 327-337`
- Cause: Eager initialization.
- Improvement path: Defer `composer`/`bloomPass` construction to first toggle of `useBloom`; or share the render targets with the main framebuffer.

**Bloom Pass Resize Independent of Renderer Resize:**
- Problem: `onWindowResize` calls `renderer.setSize`, `composer.setSize`, and then `bloomPass.setSize(width/2, height/2)` separately (lines 416-420). The composer already manages internal pass sizes; manually overriding `bloomPass.setSize` after `composer.setSize` re-resets to half-resolution. This is correct but fragile.
- Files: `src/js/main.js:412-421`
- Cause: Two-step resize.
- Improvement path: Subclass `UnrealBloomPass` to expose a `resolutionScale` and have it react to composer resize automatically.

**No `frustumCulled` Configuration on the Sun Group:**
- Problem: Three.js auto-frustum-culls per-mesh, but the prominence and corona shells extend beyond their geometry's bounding sphere due to vertex displacement and shader scaling (`pulseScale = 1.0 + 0.02 * Math.sin(...)`). When the camera is at a steep angle, the bounding sphere may be culled before the rendered geometry is fully off-screen. The current `coreScaleDist = 0.416` hardcoded ratio (`src/js/shaders.js:435`) compounds this — if the bounding box test passes but the corona is mostly transparent, you still pay full overdraw.
- Files: `src/js/sun.js:280`, `src/js/shaders.js:435`
- Cause: Mesh `boundingSphere` does not reflect shader-displaced geometry.
- Improvement path: Set `coreMesh.frustumCulled = false` and `promMesh.frustumCulled = false` (small scene, one star), or manually compute correct bounding spheres with displacement headroom.

**Three.js Bundle Size — 626 KB Production JS:**
- Problem: `dist/assets/index-Cc6hYQRo.js` weighs 626,461 bytes minified. The dependencies are `three@0.184.0` (~620 KB) plus `lil-gui@0.21.0` (~30 KB). The entire `three/examples/jsm` postprocessing chain is bundled even when `usePostProcessing = false` by default.
- Files: `package.json:14-17`, `dist/assets/index-Cc6hYQRo.js`
- Cause: Default Vite ESM tree-shaking includes everything reachable through static imports.
- Improvement path: Lazy-import `EffectComposer`, `RenderPass`, `UnrealBloomPass`, `OutputPass` only when the user toggles `useBloom`; consider `three`'s upcoming `three/webgpu` build for slimmer modules; gzip currently brings this to ~165 KB, which is acceptable.

**Telemetry DOM Writes Every 100 ms Regardless of Visibility:**
- Problem: `updateTelemetry` (`src/js/main.js:351-366`) writes to `valDistance.textContent`, `valVelocity.textContent`, `valTemperature.textContent` every 100 ms even when the HUD is collapsed (`#control-panel.collapsed`). DOM `textContent` writes trigger layout reflow on the HUD readout boxes.
- Files: `src/js/main.js:351-366`, `src/js/main.js:395-398`
- Cause: No visibility check.
- Improvement path: Skip the write when the HUD is offscreen or collapsed (`controlPanel.classList.contains('collapsed')`).

## Fragile Areas

**No WebGL Context Loss Handling:**
- Files: `src/js/main.js:48-54`
- Why fragile: `THREE.WebGLRenderer` is constructed without subscribing to `webglcontextlost`/`webglcontextrestored` events on `renderer.domElement`. If the GPU resets (driver crash, tab background-throttling, mobile suspend/resume), the canvas turns black permanently and the user must reload. All shader programs, textures, and buffers need re-upload.
- Safe modification: Add listeners that call `renderer.dispose()` and rerun `init()` on restore. Three.js does some of this internally, but custom `ShaderMaterial` uniforms (`uTime`, etc.) need explicit reattachment.
- Test coverage: None — there is no test suite at all in this repo.

**No `WebGLRenderer` Failure Fallback:**
- Files: `src/js/main.js:48`
- Why fragile: `new THREE.WebGLRenderer({...})` throws if the browser cannot create a WebGL context (older browsers, headless environments, GPU blacklist). The throw propagates out of `init()` and the loader screen never fades — the user sees `INITIALIZING STELLAR SHADERS...` forever with no error message.
- Safe modification: Wrap in `try { ... } catch (err) { showFallbackMessage(err); }` and display a "WebGL not supported" overlay.
- Test coverage: None.

**No `dispose()` Pathway for Scene Objects:**
- Files: `src/js/sun.js:128-198`, `src/js/starfield.js:9-79`
- Why fragile: `Sun` allocates four meshes (core, prominences, corona, flare group) with materials and geometries. Only the lens flare textures are disposed (`src/js/sun.js:214-217`). If the app were ever embedded as a widget that remounts (e.g., React with `useEffect`), every remount would leak the geometry, material, and shader program for the core, prominences, corona, and starfield. Currently a single-page-load app, so the leak does not manifest, but it is a future-foot-gun.
- Safe modification: Add `Sun.dispose()` calling `geometry.dispose()` and `material.dispose()` on every owned object; similarly add an `unmount` path that removes the resize listener.
- Test coverage: None.

**Animation Loop Cannot Be Stopped:**
- Files: `src/js/main.js:369-410`
- Why fragile: `animate()` calls `requestAnimationFrame(animate)` unconditionally with no stored handle. There is no way to pause or stop the loop (e.g., on tab visibility change). The browser will throttle to ~1 fps when the tab is backgrounded, but the loop still ticks, mutates `clock`, and re-renders. Slack telemetry timestamps will drift far when the tab is reactivated.
- Safe modification: Store the handle (`const id = requestAnimationFrame(animate)`), expose a `stop()` that calls `cancelAnimationFrame(id)`, and listen for `document.visibilitychange`.
- Test coverage: None.

**Global Module-Scope State With No Reset Path:**
- Files: `src/js/main.js:15-26`
- Why fragile: Eight `let`-bound module globals (`scene`, `camera`, `renderer`, `controls`, `gui`, `sun`, `starfield`, `composer`, `bloomPass`, `clock`, `timeSpeed`, etc.) plus `isFlying`/`flightTargetPos`/`flightTargetLookAt`/`flightSpeed`. Reloading the scene without a full page refresh is impossible.
- Safe modification: Encapsulate into an `App` class with `mount(rootEl)` / `unmount()` lifecycle methods.
- Test coverage: None.

**Loader Screen Hidden on a Fixed 600 ms Timer Regardless of Init Result:**
- Files: `src/js/main.js:100-102`
- Why fragile: The loader fade-out is `setTimeout(..., 600)` and is unconditional. If `init()` succeeds in 50 ms (cached page reload), the loader still displays for 600 ms. If `init()` throws between `updateLoadProgress(100)` and the timer (very narrow window), the loader still hides but the page is broken.
- Safe modification: Trigger fade-out at the end of the first `animate()` frame instead of via timer.
- Test coverage: None.

**`onWindowResize` Has No `composer`/`bloomPass` Existence Guard:**
- Files: `src/js/main.js:412-421`
- Why fragile: Calls `composer.setSize` directly; if `init()` ever moves construction order or partially fails, a resize throws.
- Safe modification: `if (composer) composer.setSize(...); if (bloomPass) bloomPass.setSize(...);`.
- Test coverage: None.

**`OrbitControls.minDistance` Tied to Hardcoded Magic `140.0 * scale`:**
- Files: `src/js/main.js:60, 194, 273`
- Why fragile: Three different code paths (init, preset button, custom-class) each rewrite `controls.minDistance = 140.0 * sun.params.scale`. The hardcoded `140.0` should be derived from `sun.params.scale * 1.4` or similar — currently it ignores the prominence shell radius (`scale * 1.01`) and lets the camera clip inside the prominence sphere on certain settings.
- Safe modification: Encapsulate as `Sun.getMinSafeCameraDistance()` returning a computed value.
- Test coverage: None.

## Scaling Limits

**Single-Star Scene by Design:**
- Current capacity: 1 procedural star + 1 starfield (6000 points) + 1 lens flare system.
- Limit: The `Sun` class is a singleton-ish — `main.js` holds one `sun` global. Multi-star scenes (e.g., a binary system) would require duplicating the entire `Sun` instantiation, doubling GPU shader cost.
- Scaling path: Refactor `Sun` to accept a `position` and allow multiple instances; share shader programs across instances; consider instanced rendering for many distant stars.

**Hardcoded Camera Far Plane of 500,000 Units:**
- Current capacity: 500,000 units (`src/js/main.js:44`), with starfield shell at 25,000-35,000 and `controls.maxDistance = 150,000` (`src/js/main.js:61`).
- Limit: The depth buffer precision at this near/far ratio (1.0 to 500,000) is poor. Z-fighting is possible between the starfield (z ≈ 30,000) and the corona (z ≈ 480 at default scale). Currently masked by `depthWrite: false` on the corona and starfield.
- Scaling path: Use a logarithmic depth buffer (`renderer = new THREE.WebGLRenderer({ logarithmicDepthBuffer: true })`); reduce far plane.

**`devicePixelRatio` Capped at 2.0:**
- Current capacity: `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))` (`src/js/main.js:50`).
- Limit: On 4K/5K Retina displays, this means a 4096×2160 viewport renders at 4096×2160 (DPR 2 of 1920×1080), but high-DPR phones can hit DPR 3 or 4 — rendering would still be at 2x. This is actually a good performance choice; flagging only because the user has no way to override for a quality-first preview.
- Scaling path: Expose `pixelRatioCap` in the GUI; document the rationale.

## Dependencies at Risk

**`three@^0.184.0` Major-Version Churn:**
- Risk: Three.js ships breaking changes roughly every 6-8 months. `^0.184.0` allows automatic upgrade through `0.x` minors but with `0.x` versions, `^` is treated as `~` by npm (only patches). Still, the `examples/jsm` paths (OrbitControls, EffectComposer, UnrealBloomPass, Lensflare) have moved across recent versions.
- Impact: A `npm install` on a fresh clone could pick up `0.184.x` patches that change the lens flare API, breaking `src/js/sun.js:248-260`.
- Migration plan: Pin to an exact version (`"three": "0.184.0"`) in `package.json`. Re-test against newer minors in a separate branch.

**`vite@^8.0.12`:**
- Risk: Vite 8 is recent; major-version upgrades historically broke plugin compatibility.
- Impact: A future `vite@9` may break the implicit dev/build pipeline.
- Migration plan: Pin major version range (`"vite": "^8.0.0"` is fine; consider `~8.0.0` to avoid 8.1 surprises if any).

**`lil-gui@^0.21.0`:**
- Risk: Pre-1.0 library; API changes in `0.x` minors.
- Impact: `gui.folders.forEach(folder => folder.controllers.forEach(c => c.updateDisplay()))` (`src/js/main.js:309-314`) relies on `folders` and `controllers` arrays existing. Renamed in earlier versions.
- Migration plan: Pin to `0.21.x`.

**No `engines` field in `package.json`:**
- Risk: No specified Node version, no `engines`, no `.nvmrc`.
- Impact: Vite 8 requires Node 22+ to build; contributors on Node 18 silently fail.
- Migration plan: Add `"engines": { "node": ">=22" }` and an `.nvmrc`.

## Missing Critical Features

**No Asset Preloading or Loading Manager:**
- Problem: The loader bar at `index.html:104-106` is animated by `updateLoadProgress(30/60/80/100)` (`src/js/main.js:64, 68, 72, 97`) called at fixed milestones — it does not actually track loading of anything. No textures or models are loaded from disk; the entire scene is procedural. The "progress bar" is a visual prop.
- Blocks: Honest user feedback during initialization. If shader compilation becomes slow, the user sees no indicator.
- Recommendation: Either remove the progress bar or hook it to `THREE.DefaultLoadingManager` once external assets exist; alternatively, measure shader-compile time via `renderer.compile(scene, camera)` and report real progress.

**No Error Display UI:**
- Problem: There is no error overlay, no `try/catch` around `init()`, no `unhandledrejection` listener. Any failure (WebGL unsupported, shader compile error, geometry NaN) leaves the page in a broken state with messages only in DevTools.
- Blocks: Diagnosing user-reported issues remotely.
- Recommendation: Add a top-level `try/catch` in `init`, plus `window.addEventListener('error', ...)` and `window.addEventListener('unhandledrejection', ...)` that surface a banner in the loader screen.

**No Mobile/Touch Affordances:**
- Problem: The HUD has fixed pixel widths (`#space-hud { width: 380px }` per `src/style.css:45`). The control panel uses `lil-gui` which is keyboard/mouse-first. No touch-action CSS and no orientation-change handling beyond the resize listener.
- Blocks: Mobile users.
- Recommendation: Either explicitly target desktop and warn mobile users, or add responsive media queries and `OrbitControls`'s touch-rotation tuning.

**No Frame-Rate Cap or VSync Awareness:**
- Problem: On a 240 Hz display the simulation runs 4x faster than on 60 Hz because `clock.getDelta()` is multiplied by `timeSpeed` (`src/js/main.js:373`). The result is consistent in seconds but the visual feel of `convectionSpeed` etc. shifts per monitor.
- Blocks: Cross-display visual consistency.
- Recommendation: Fix the simulation timestep (e.g., always advance by `delta` capped at 1/30) or document the per-Hz tuning.

## Test Coverage Gaps

**No Test Suite Exists:**
- What's not tested: Everything. There is no `package.json` test script, no `tests/`, `__tests__/`, `*.test.*`, `*.spec.*` files anywhere. No `jest`, `vitest`, `mocha`, `playwright`, or any test runner in `devDependencies`.
- Files: `package.json` (no `test` script in `scripts`)
- Risk: Refactoring `parseMKClassification` or `kelvinToColorGrading` could silently break the input handling with no signal until a user types a spectral class.
- Priority: Medium — for a pure-render demo project, the cost/value of full coverage is low, but `stellarClassifier.js` is a pure-function module that is trivially testable and would catch regex regressions.

**No Linting or Type Checking:**
- What's not tested: No ESLint, no Prettier, no TypeScript, no JSDoc type checking.
- Files: Root project (no `.eslintrc*`, no `tsconfig.json`, no `biome.json`)
- Risk: Typos in uniform names (`uHighTemp` vs `uHightemp`) silently fail at shader-link time with a console warning that is easy to miss.
- Priority: Medium — adding `eslint` + `@typescript-eslint` with `// @ts-check` in `main.js` would catch most class-of-bug issues for ~30 minutes of setup.

**Specific Untested Modules:**
- `src/js/stellarClassifier.js:39-191` (`parseMKClassification`): Regex parser with ~150 branches based on spectral class × luminosity class. Trivially unit-testable; currently relies on visual inspection.
- `src/js/stellarClassifier.js:212-236` (`lookupHYGStar`): Star database lookup. Hand-typed entries — typos in `HYG_DATABASE` would only be caught by manual click-through.
- `src/js/stellarClassifier.js:4-33` (`kelvinToColorGrading`): Pure function with magic constants; trivial to test against known temperatures.

---

*Concerns audit: 2026-05-20*
