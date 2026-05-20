# Codebase Concerns

**Analysis Date:** 2026-05-20

## Tech Debt

**main.js is a "god file" orchestrator:**
- Issue: Single module of 1,228 lines handles WebGL setup, scene composition, GUI wiring, HUD/DOM event binding, telemetry, autopilot flight, comparison mode lifecycle, cinematic flyby choreography, HTML 3D label projection, and the render loop.
- Files: `src/js/main.js` (1228 lines)
- Impact: Any change carries broad surface area; new features bolt on as additional global variables and `setupHUDBindings()` clauses; reading flow requires scrolling across unrelated subsystems.
- Fix approach: Extract subsystems into modules — `controllers/autopilot.js` (state at `main.js:28-32`, logic at `main.js:1091-1102`), `controllers/comparison.js` (state at `main.js:34-40`, lifecycle at `main.js:287-584`), `controllers/cinematic.js` (lifecycle at `main.js:637-759`, animation choreography at `main.js:1137-1186`), `ui/hud.js` (telemetry helpers at `main.js:1044-1078`), `ui/labels.js` (3D label projection at `main.js:586-635`), `ui/gui.js` (lil-gui wiring at `main.js:173-284`). Keep `main.js` as a thin bootstrap.

**`bloomStrength` parameter accepted but never read:**
- Issue: `Sun.update(time, bloomStrength = 1.0)` declares `bloomStrength`, but the body never references it. Callers at `main.js:1196` and `main.js:1199` still pass `bloomPass.strength`.
- Files: `src/js/sun.js:310`
- Impact: Dead API surface; suggests an unfinished feature (corona reacts to bloom) — comment at `src/js/sun.js:343-344` ("Dynamically adjust corona density and lens flare scale based on bloom") describes behavior that is not implemented.
- Fix approach: Either drop the parameter and the misleading comment, or wire bloom-driven corona scaling.

**Dead `sizeUniform` local in render hot path:**
- Issue: `const sizeUniform = this.coronaMaterial.uniforms.uScale.value;` is assigned every frame and never read.
- Files: `src/js/sun.js:345`
- Impact: Minor — a redundant property lookup per star per frame (12 lookups/frame in comparison mode). Mostly clutter.
- Fix approach: Delete the line.

**Inline styling sprawl in JS overrides external stylesheet:**
- Issue: Button states (background, border, color) are mutated via `element.style.*` on enter/exit of comparison and cinematic modes, fighting the `.nav-btn.active` rules in `style.css`.
- Files: `src/js/main.js:310-312`, `main.js:439-441`, `main.js:652-668`, `main.js:904-906`, `main.js:910`
- Impact: Two parallel sources of truth (CSS + JS). Adding a new visual state means hunting through both. Specificity issues already required `style.css:180-183` per-preset overrides.
- Fix approach: Add CSS classes (e.g., `.btn-state-active`, `.btn-state-flyby`, `.btn-state-stop`) and toggle them via `classList`. Move all color/background literals into `style.css`.

**Heavy inline `style="..."` on HUD markup in `index.html`:**
- Issue: 14 inline `style=` attributes carry layout/typography for HUD subsections (`index.html:85-88`, `index.html:99-121`).
- Files: `index.html:85-121`
- Impact: Same dual-source-of-truth problem; `style.css` controls some HUD pieces while critical layout lives in HTML. Breaks at media-query boundaries.
- Fix approach: Lift the inline styles into named CSS classes in `style.css` and reference them by class.

**Cinematic timeline is a chain of hardcoded magic time gates:**
- Issue: `updateCinematicCamera` and the per-star choreographer use literal seconds (7.0, 16.0, 27.0, 38.0; and 6.0/7.0 split) intermingled with star-index literals (0, 2, 7).
- Files: `src/js/main.js:688-759`, `main.js:1137-1186`
- Impact: Adding a star or rebalancing a "Take" requires editing two locations in lockstep. The index `7` references "Rigel" only by position in the lineup array (`main.js:326`); reordering the lineup silently breaks the eclipse take.
- Fix approach: Introduce a `cinematicTimeline` config (array of `{ start, end, name, focusIndex, ... }`) and a separate `starIndexByName` lookup. Drive both the camera path and the per-star choreography from the same table.

**`comparisonStars[index] = 7` magic constant for "Rigel":**
- Issue: The David & Goliath take addresses Sirius B / Sol / Rigel by index 0, 2, 7 in the lineup array.
- Files: `src/js/main.js:1156`, `main.js:1166`, `main.js:1176`; lineup at `main.js:318-331`
- Impact: Coupling between lineup ordering and animation logic is unenforced.
- Fix approach: Look up indices by name (`.findIndex(d => d.name === 'Rigel')`).

**Color-class assignment via `displayName.includes(...)` substring sniffing:**
- Issue: `focusOnComparisonStar` decides whether to apply the `yellow-dwarf`/`red-giant`/`blue-super`/`white-dwarf` CSS class by string-searching the display name for "Arcturus", "Aldebaran", "Antares", "Betelgeuse", "UY Scuti", "Red", "Rigel", "Deneb", "Vega", "Sirius A", "Blue".
- Files: `src/js/main.js:486-494`
- Impact: Adding a new star requires editing both `lineupData` and the if-chain. Each catalog star already has `params.specClass`, `params.highTemp`, and `params.lum` to drive the same decision physically.
- Fix approach: Derive the CSS class from `star.params.highTemp` ranges (the same logic already used in `Sun.updateLensFlares` at `sun.js:272-284`). Centralize "temperature → CSS class" in one helper.

**Custom-class prefix parsing is brittle and crash-prone:**
- Issue: `prefix = isHYG ? settings.displayName.split('(')[1][0] : cleanStr[0]` — if a HYG entry's `displayName` lacks `(` (e.g. a future entry), this throws `TypeError: Cannot read properties of undefined (reading '0')`.
- Files: `src/js/main.js:928`
- Impact: Adding a HYG entry without parenthesized spectral suffix silently crashes the GENERATE button.
- Fix approach: Use `params.specClass` (already returned by `parseMKClassification` at `stellarClassifier.js:323`) instead of re-parsing the display name.

**Hardcoded scale-to-AU conversion:**
- Issue: `const distanceAU = distance / 800.0;` — magic constant tying telemetry to scene scale.
- Files: `src/js/main.js:1050`
- Impact: Any change to `coreGeometry` radius (currently 100.0 at `sun.js:170`) breaks the AU readout. Same risk for `baseSpeedVal = 29.78` km/s and `radiationFluxTemp` formula.
- Fix approach: Define `SCENE_UNITS_PER_AU = 800.0` next to other rendering constants and reference from telemetry.

**Forgotten/stale `// HYG Database` schema:**
- Issue: HYG entries hardcode `temp`, `lum`, `mass`, `radius`, `vRot` but also store `spect`. `lookupHYGStar` overwrites the `parseMKClassification` estimates with catalog values (`stellarClassifier.js:372-380`). Some overrides (`oblateness`, `polarJetIntensity`) live in a per-name `if` chain at `stellarClassifier.js:383-398` rather than as data on the entry.
- Files: `src/js/stellarClassifier.js:329-348`, `:383-398`
- Impact: New catalog stars with special oblateness/jet behavior must be added to two places.
- Fix approach: Extend HYG entries with optional `oblateness`, `polarJetIntensity`, `rotationSpeed` fields and apply them generically.

## Known Bugs

**Resize before composer exists crashes init race:**
- Symptoms: `onWindowResize` calls `composer.setSize(...)` unconditionally at `main.js:1221`. If a resize event fires before `composer` is constructed (composer is created at line 130, listener registered at line 149 — currently safe), or if init throws after the listener is registered but before composer assignment, the handler throws `TypeError: Cannot read properties of undefined (reading 'setSize')`.
- Files: `src/js/main.js:1216-1225`
- Trigger: Init failure between `addEventListener('resize', …)` and the composer assignment.
- Workaround: None.
- Fix approach: Guard with `if (composer) composer.setSize(...)` mirroring the existing `if (bloomPass)` check.

**Color picker swaps to blue-channel-dominant lose data:**
- Symptoms: `surfaceFragmentShader` swizzles palette via `.bgr` when `uColorGrading.z > uColorGrading.x * 1.05` (`shaders.js:244-254`). The GUI proxy that reads `colorGrading` divides by the max channel to derive a hex string (`main.js:96-102`, `main.js:976-984`). After a swap and re-paint, the proxy hex no longer round-trips to the same RGB.
- Files: `src/js/shaders.js:244-254`, `src/js/main.js:976-984`, `main.js:210-219`
- Trigger: Pick "Blue Supergiant" preset, then drag the "Star Tint Color" picker.
- Workaround: Reset to default.
- Fix approach: Stop encoding the magnitude inside `colorGrading.xyz`; store hue/saturation separately from a brightness scalar so the GUI proxy and the shader agree.

**`copyParams` only copies keys present on `source`:**
- Symptoms: `copyParams(source, target)` iterates `for (const key in source)`. When entering comparison mode, `mainSunParamsBackup` is initialized to `{}` and populated from `sun.params` (`main.js:292-293`). On exit, `sun.copyParams(mainSunParamsBackup, sun.params)` will not unset keys added during comparison if any.
- Files: `src/js/sun.js:129-141`, `src/js/main.js:292-293`, `main.js:405-408`
- Trigger: A future code path that adds a property to `sun.params` while in comparison mode would persist after exit.
- Workaround: Today the param schema is closed.
- Fix approach: Snapshot all known params; or store a deep-clone of `sun.params` (defaults + values) rather than iterating `source`.

**`updateAutoExposure` mutates `star.params.lensFlaresEnabled` permanently:**
- Symptoms: When the camera enters the close-range "no flare" zone, the code writes `star.params.lensFlaresEnabled = false` (`main.js:1035`). On exiting the zone, it restores `true` only if `sun.params.lensFlaresEnabled` is also true (`main.js:1037`). If the user disables flares globally while close, then zooms out, the focused star is restored to enabled regardless of the user's intent on that specific star.
- Files: `src/js/main.js:1034-1041`
- Trigger: Toggle "Camera Lens Flares" off in close orbit, zoom out.
- Workaround: Toggle off again.
- Fix approach: Track a separate `_flareForceOff` flag rather than overwriting `params.lensFlaresEnabled`.

**`copyParams` loses `Vector3` instance identity on reassignment:**
- Symptoms: When `source[key]` is a `Vector3` but `target[key]` is not, `copyParams` assigns a `clone()` (`sun.js:135`). The next call could leave `target` with a fresh `Vector3` reference. Three.js `ShaderMaterial.uniforms.*.value` is set to a specific `Vector3` reference (e.g. `sun.js:476`); if a future code path bypasses `applyCurrentParams` and assumes the uniform still points to the same `Vector3`, mutating `params.colorGrading.x = ...` will not propagate to the shader.
- Files: `src/js/sun.js:129-141`, `sun.js:476-491`
- Trigger: Currently latent — guarded because `applyCurrentParams` reassigns uniform `.value` every change.
- Workaround: Always call `applyCurrentParams`.
- Fix approach: Prefer in-place `target[key].copy(source[key])` and pre-allocate Vector3s on the param object.

## Security Considerations

**Innocuous `innerHTML` use, but worth noting:**
- Risk: `labelDiv.innerHTML = ...` interpolates `star.displayName` and `star.params.radius` into HTML (`main.js:376-382`). Both originate from the in-code HYG table and the procedural classifier — not user input — so this is safe today.
- Files: `src/js/main.js:376-382`
- Current mitigation: Data is internal.
- Recommendations: If a future feature lets the user name a star or imports a catalog, switch to `textContent` for name fields.

**`input-custom-class` is regex-validated before use:**
- Risk: `parseMKClassification` regex (`stellarClassifier.js:55`) constrains user input. `lookupHYGStar` strips non-alphanumerics (`stellarClassifier.js:351`). Both feed into shader uniforms (numbers) and `displayName` (rendered via `innerHTML` in the label card).
- Files: `src/js/stellarClassifier.js:55`, `:351`; `src/js/main.js:884-944`
- Current mitigation: Regex and string sanitization.
- Recommendations: Same as above — switch the label card to `textContent` to be safe against catalog injection.

**Inline `<svg>` data URI in favicon and no CSP:**
- Risk: `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,...">` (`index.html:5`). No Content-Security-Policy meta tag. External Google Fonts loaded over HTTPS (`index.html:13-15`).
- Files: `index.html:5`, `:13-15`
- Current mitigation: None.
- Recommendations: For a deployed build, add a `<meta http-equiv="Content-Security-Policy">` allowing only `'self'`, `fonts.googleapis.com`, `fonts.gstatic.com`, and inline styles (currently required by the inline `style=` attributes).

## Performance Bottlenecks

**Comparison mode renders 12 independent Three.js scenes per star:**
- Problem: Each `new Sun(...)` creates three meshes with their own `THREE.SphereGeometry(100, 80, 80)` (12,800 verts), `THREE.SphereGeometry(101, 140, 140)` (39,200 verts), and a `THREE.PlaneGeometry`. With 12 stars: ~624k verts of sphere geometry and 36 `ShaderMaterial` instances (3 per star), each recompiled by Three.js.
- Files: `src/js/sun.js:169-191`, `:194-218`, `:221-242`; `src/js/main.js:333-342`
- Cause: No geometry sharing across instances; no `InstancedMesh`; no LOD; each star's prominence shell uses 140×140 segments regardless of screen size.
- Improvement path:
  1. Share a single `SphereGeometry(100, 80, 80)` and `SphereGeometry(101, 140, 140)` and `PlaneGeometry` module-scope; pass them into every `Sun` instance.
  2. Materials are per-instance because uniforms differ per star, but reducing per-frame uniform churn would help — the inner loop at `sun.js:312-348` writes 4 uniforms every frame even when params are static.
  3. Add LOD on the prominence shell — drop to 60×60 segments when angular size on screen is below a threshold. Same for `coreGeometry`.
  4. The corona billboard (480×480 plane) blends additively with `depthWrite: false`; consider a smaller plane when the star fills <5% of viewport.

**Prominence sphere is 140×140 segments — high vertex count for a displacement target:**
- Problem: `new THREE.SphereGeometry(101.0, 140, 140)` produces ~39k vertices per star → ~470k vertices total in the 12-star lineup just for prominences. Vertex shader runs simplex noise (~50 ALU per `snoise`, called 3× per vertex with polar jet) on every one.
- Files: `src/js/sun.js:196`
- Cause: Aggressive subdivision chosen for smooth displacement.
- Improvement path: Reduce to 96×96 in comparison mode, or implement a per-star segment count tied to current `params.scale` (small stars don't need 140×140).

**Frustum culling cannot help — every star is always inside the comparison lineup's bounding box:**
- Problem: The lineup spans `accumulatedX` up to ~10⁶+ scene units (real-scale mode), and the camera flies through it. Three.js's per-mesh frustum culling will exclude offscreen meshes, which helps; however the per-frame `sun.update()` for all 12 stars (`main.js:1195-1197`) still runs uniform updates and rotates the group regardless of visibility.
- Files: `src/js/main.js:1195-1197`; `src/js/sun.js:310-348`
- Cause: No visibility check before `star.update(...)`.
- Improvement path: Check `star.group.visible` and skip `update` when offscreen — or test against `camera.frustum` directly. Note that `Sun.update` mutates `group.scale` and `group.rotation` so a stopped star will visually freeze; that's acceptable for offscreen stars.

**12× lens-flare texture regeneration on focus change:**
- Problem: `updateLensFlares()` (`sun.js:252-307`) destroys and re-creates three `CanvasTexture` instances per `Sun` instance. `updateComparisonLensFlares` (`main.js:578-584`) calls it for every star on every focus change.
- Files: `src/js/sun.js:252-307`; `src/js/main.js:578-584`
- Cause: Texture content depends on star temperature, but the actual canvas drawing is fast; the cost is the GPU upload (3 × 512×512 RGBA = 3 MB per star × 12 stars = 36 MB worst case).
- Improvement path: Cache textures keyed by `(colorHex, type)` across stars and reuse; or compute the lens-flare color in a tiny lookup table at module load.

**Camera frustum is huge (`far: 30,000,000`) in comparison mode:**
- Problem: `controls.maxDistance = 20000000.0; camera.far = 30000000.0` (`main.js:296-297`) gives a depth ratio of 30M:1 versus `camera.near = 1.0`. Depth-buffer precision suffers; flickering ("z-fighting") is likely on overlapping prominence/corona shells when zoomed out.
- Files: `src/js/main.js:67`, `:296-298`
- Cause: Real-scale mode pushes stars to astronomical separations.
- Improvement path: Switch to a logarithmic depth buffer (`new THREE.WebGLRenderer({ logarithmicDepthBuffer: true })`) when entering comparison mode — only available at renderer construction, so the alternative is to set `camera.near` dynamically based on camera distance.

**`window.innerWidth / innerHeight` recomputed in the render loop:**
- Problem: `aspect`, `fovRad`, `tanHalfFOV`, `effectiveTan` are recomputed every frame in `animate` (`main.js:1127-1130`) and again in `updateCinematicCamera` (`main.js:683-686`).
- Files: `src/js/main.js:683-686`, `:1127-1130`
- Cause: No cache; assumes the window can resize at any moment.
- Improvement path: Cache these values, update only in `onWindowResize`.

**Bloom pass is half-res but still runs the full chain:**
- Problem: `UnrealBloomPass` is correctly initialized at half resolution (`main.js:122`). However, `usePostProcessing` defaults to `false` (`main.js:20`), so bloom is off by default — and `bloomPass.strength` is still read every frame at `main.js:1196`, `:1199`, even when `composer.render()` isn't called.
- Files: `src/js/main.js:20`, `:122`, `:1196`, `:1199`
- Cause: `Sun.update(time, bloomStrength)` accepts the value but never uses it (see Tech Debt).
- Improvement path: Drop the parameter, drop the read of `bloomPass.strength`.

**Heavy `backdrop-filter: blur(16px) saturate(180%)` on multiple panels:**
- Problem: HUD, control panel, and label cards all use `backdrop-filter` (`style.css:32-33`, `:49-50`, `:272-273`, `:577-578`). On low-end GPUs the blur of the whole composited area behind each panel is expensive — and the panel covers ~25% of the viewport.
- Files: `src/style.css:32-33`, `:49-50`, `:272-273`, `:577-578`
- Cause: Glassmorphism design.
- Improvement path: Reduce blur radius to `8px`, or replace with a static semi-transparent background on mobile (already partial via media query at `style.css:520`).

**46 `document.getElementById`/`querySelector` calls in `main.js`:**
- Problem: Some lookups are cached at module load (`main.js:48-57`), but many are repeated inside event handlers (e.g. `document.getElementById('comparison-focus-panel')` at `main.js:304` and again at `:426`; `document.getElementById('btn-cinematic-flyby')` at `:306`, `:428`, `:649`, `:663`, `:869`).
- Files: `src/js/main.js` (multiple lines)
- Cause: Convenience over DOM-cache discipline.
- Improvement path: Cache DOM nodes alongside the existing block at `main.js:48-57`.

## Fragile Areas

**Lineup index coupling across cinematic and choreography:**
- Files: `src/js/main.js:318-331` (lineup definition), `:392` (`focusOnComparisonStar(2)` for Sol), `:672` (`focusOnComparisonStar(2)` for Sol after cinematic stop), `:678-682` (cinematic camera pos0/pos2/posLast), `:1156`/`:1166`/`:1176` (David & Goliath indices 0/2/7).
- Why fragile: Reordering the `lineupData` array silently breaks every numeric index reference.
- Safe modification: Always add stars to the end of the lineup; never reorder. Better, refactor to name-based lookup.
- Test coverage: Zero — no test suite exists.

**Param state machine — `setPreset` saves current slot before switching, but conditionally:**
- Files: `src/js/sun.js:504-529`
- Why fragile: `setPreset` saves `this.params` into `this.presetStates[this.currentPresetName]` only if the slot already exists (`sun.js:506`). For an unrecognized preset name passed as a string, it returns without doing anything (no error, no fallback). For an object, it always switches into the `custom` slot.
- Safe modification: Always pass a known preset name string or an object; never pass `undefined`.
- Test coverage: Zero.

**Loader fade-out is a fixed 600ms timeout, unrelated to actual readiness:**
- Files: `src/js/main.js:144-146`
- Why fragile: `updateLoadProgress(100)` is called synchronously inside `init`, but the loader fade only triggers 600ms later. If shader compilation stalls (it can on first frame), the user sees a faded loader over a black canvas.
- Safe modification: Fade after the first successful `animate()` frame, not a setTimeout.
- Test coverage: Zero.

**No WebGL context-loss handler:**
- Files: `src/js/main.js:71` (renderer creation, no context-loss listener)
- Why fragile: Context loss (driver crash, tab backgrounding on some browsers) leaves textures/geometries unbound. The app has no path to re-initialize.
- Safe modification: Don't background the tab for long periods on machines with intermittent GPUs.
- Test coverage: Zero.

**No WebGL2 capability check:**
- Files: `src/js/main.js:71`
- Why fragile: `THREE.WebGLRenderer` falls back to WebGL1 on browsers/devices without WebGL2; the GLSL in `shaders.js` doesn't require `#version 300 es` features, so it will technically run — but the assumption stated in the title ("WebGL 2 Simulation") goes silently false.
- Safe modification: Test in `if (!renderer.capabilities.isWebGL2) { /* warn */ }`.
- Test coverage: Zero.

**`flightSpeed = 0.035` lerp factor is frame-rate dependent:**
- Files: `src/js/main.js:32`, `:1092-1093`
- Why fragile: `camera.position.lerp(flightTargetPos, flightSpeed)` advances the same fraction per frame regardless of `delta`. At 30 FPS the autopilot is half as fast as at 60 FPS.
- Safe modification: Use `1 - Math.exp(-flightSpeed * delta * 60)` or similar frame-rate-independent damping.
- Test coverage: Zero.

**`controls.enabled = false` during cinematic, but window-resize can still affect target:**
- Files: `src/js/main.js:644`, `:661`; `:1216-1225`
- Why fragile: Resizing during cinematic re-runs `onWindowResize`, which calls `camera.updateProjectionMatrix()`. The cinematic uses cached `effectiveTan` per frame — but a resize mid-Take 2 will change `tanHalfFOV` and snap star positions to new screen-fill targets, visible as a jump.
- Safe modification: Avoid resizing during the flyby; or restart the active Take on resize.
- Test coverage: Zero.

**Cinematic `Take 2` and `Take 3` have a 1-second gap (16.0s vs lineup re-converge at 6.0s):**
- Files: `src/js/main.js:1139-1146` (assembly ends at 6.0, eclipse starts at 7.0); `:701-709` (eclipse 7.0-16.0); `:711-739` (canyon 16.0-27.0)
- Why fragile: Between 6.0s and 7.0s, stars are at base positions but the camera in `updateCinematicCamera` is still on Take 1 (which ends at 7.0). Between Take 2 end (16.0) and Take 3 start (16.0) is the boundary — fine. Between assembly (6.0) and Take 2 (7.0), star choreography is idle for 1 second.
- Safe modification: Document and intentional, or align the boundaries.
- Test coverage: Zero.

## Scaling Limits

**12 stars is the current ceiling for comparison mode:**
- Current capacity: 12 `Sun` instances × 3 meshes each = 36 active meshes, 36 ShaderMaterial compiles, ~624k sphere verts, 12 lens flare sets.
- Limit: At ~20 stars, frame budget for the prominence shell vertex shader (39k verts × 20 × simplex noise) will exceed 16 ms on integrated GPUs.
- Scaling path: Geometry sharing (one shared `SphereGeometry` per layer), LOD, and per-star visibility skipping in `animate()` (see Performance Bottlenecks).

**Starfield: 6000 points is fine; bumping to 50k would hurt:**
- Current capacity: 6000 `THREE.Points` with custom shader (`main.js:114`).
- Limit: Each point runs a per-fragment exp/sin for twinkle (`shaders.js:534-535`); ~6000 well-separated points at 1080p is GPU-cheap. 50k starts to fill rate.
- Scaling path: Reduce per-point pixel coverage by lowering `gl_PointSize` ceiling (`shaders.js:516`).

**Depth precision degrades at high `camera.far`:**
- Current capacity: `camera.far = 30,000,000` works in single mode (`main.js:67` uses 500,000).
- Limit: At 30M with `near = 1.0`, depth-buffer precision near small white dwarfs is ~10 units — barely enough to separate prominence shell (radius 101) from core (radius 100).
- Scaling path: Logarithmic depth buffer or dynamic `near`/`far` tightening.

## Dependencies at Risk

**Three.js `^0.184.0` (carat range allows minor bumps):**
- Risk: Three.js makes breaking changes between minor versions (e.g. r140s changed `OutputPass` import paths; r150+ changed color-space defaults).
- Files: `package.json:16`
- Impact: A future `npm install` could land on r185+ with `WebGLRenderer.outputColorSpace` defaults changing the tone of the lens flares.
- Migration plan: Pin to `0.184.x` (`~0.184.0`) until tested with a newer version.

**`lil-gui ^0.21.0`:**
- Risk: Active library, occasional breaking style changes (the project's CSS overrides at `style.css:332-388` depend on internal class names like `.controller`, `.fill`, `.slider`).
- Files: `package.json:15`, `src/style.css:332-388`
- Impact: A lil-gui update that renames CSS classes will leave the control panel unstyled.
- Migration plan: Pin to `~0.21.0`.

**`vite ^8.0.12` (dev-only):**
- Risk: Vite 8 is acceptable; no production runtime impact.
- Files: `package.json:12`
- Impact: Build-time only.
- Migration plan: None needed.

## Missing Critical Features

**No automated tests:**
- Problem: No test runner configured, no test files exist anywhere in the repo (excluding `node_modules`).
- Blocks: Refactoring of `main.js` cannot be verified; `parseMKClassification` and `kelvinToColorGrading` have well-defined numeric inputs/outputs and would benefit greatly from unit tests.

**No build/CI configuration:**
- Problem: No `.github/`, no `.gitlab-ci.yml`, no CI hooks. `npm run build` is local-only.
- Blocks: No regression check, no preview deploy, no lint.

**No lint/format configuration:**
- Problem: No `.eslintrc*`, no `.prettierrc`, no formatter is enforced.
- Blocks: Style drift across modules — already visible: some functions are double-spaced, some use `// 1.` numbered comments, some lines exceed 200 chars (e.g. `main.js:488`).

**No error boundary / user-facing error UI:**
- Problem: A shader compile failure on an exotic GPU will silently leave a black canvas. The loader's "INITIALIZING STELLAR SHADERS..." text persists with 100% progress but no visible scene.
- Blocks: Diagnosing user issues in the wild.

**No `requestAnimationFrame` cancellation on tab hide:**
- Problem: `requestAnimationFrame(animate)` runs unconditionally (`main.js:1082`). When the tab is hidden, the browser already throttles, but the simplex noise still computes for an invisible scene.
- Blocks: Battery life on laptops.
- Fix path: `document.addEventListener('visibilitychange', ...)` to pause the loop.

## Test Coverage Gaps

**`parseMKClassification` (`stellarClassifier.js:47-327`):**
- What's not tested: 9-branch spectral-class temperature math, 6-branch luminosity-class scale/convection/oblateness math, edge cases like "O0Ia" (would compute `mass = 80 - 0*5 = 80` then scale to `max(20, 160) = 160`).
- Files: `src/js/stellarClassifier.js`
- Risk: A typo in any of the magic-number tables silently produces wrong star physics; nothing flags it.
- Priority: High — this is the most logic-heavy, pure-function file in the codebase and is the lowest-hanging fruit for unit tests.

**`kelvinToColorGrading` (`stellarClassifier.js:4-41`):**
- What's not tested: Temperature → RGB clipping curve; the cool-star adjustment branch (`< 4000K`).
- Files: `src/js/stellarClassifier.js:4-41`
- Risk: Same as above.
- Priority: High.

**`lookupHYGStar` (`stellarClassifier.js:350-404`):**
- What's not tested: Per-star overrides for VEGA, ALTAIR, BETELGEUSE, ANTARES, RIGEL, DENEB.
- Files: `src/js/stellarClassifier.js:350-404`
- Risk: A typo in the override block silently affects only one star.
- Priority: Medium.

**`Sun.copyParams` and `Sun.setPreset` state machine (`sun.js:129-141`, `:504-529`):**
- What's not tested: Round-trip of params through `presetStates` slots, custom→preset→custom switching.
- Files: `src/js/sun.js:129-141`, `:504-529`
- Risk: A regression in preset switching is the most likely user-visible bug.
- Priority: Medium.

**`updateComparisonLayout` spacing math (`main.js:501-576`):**
- What's not tested: Two scale modes (visual log, real linear) produce non-overlapping layouts for the 12-star lineup.
- Files: `src/js/main.js:501-576`
- Risk: Adding or resizing a star could cause overlap that is only caught visually.
- Priority: Low — visual QA catches it.

**Cinematic timeline takes (`main.js:675-759`, `:1137-1186`):**
- What's not tested: Each Take's boundary conditions, screen-fill math at extreme aspect ratios.
- Files: `src/js/main.js:675-759`, `:1137-1186`
- Risk: Aspect-ratio bugs (e.g. ultrawide) hide stars off-screen during eclipse.
- Priority: Low — visual QA.

## Platform & Build Concerns

**Project is hosted in OneDrive-synced directory:**
- Risk: `C:\Users\fgfer\OneDrive\Documents\GitHub\Projeto Render 3d Sol Webgl2` — files are subject to OneDrive sync. `node_modules/` (typically thousands of small files) can trigger sync conflicts, slow builds, and "file in use" errors during `npm install`.
- Files: Project root.
- Impact: Build instability, slower iteration; OneDrive may upload `node_modules/` unnecessarily.
- Mitigation: Add `node_modules` to OneDrive exclusion list (right-click → "Always keep on this device" off, or use "Files On-Demand" with explicit exclusion). Better, move the working repo outside OneDrive.

**Path with spaces (`"Projeto Render 3d Sol Webgl2"`):**
- Risk: Some CLI tools and scripts mishandle paths with spaces. Vite handles it fine; npm scripts handle it fine; but ad-hoc bash/PowerShell commands need quoting.
- Files: Project root.
- Impact: Friction for CI integrations and CLI tooling.
- Mitigation: Rename to `projeto-render-3d-sol-webgl2` if portability becomes a concern.

**Bundle size — `dist/assets/index-DjpY_CxB.js` is ~645 KB minified:**
- Risk: Three.js (`~600 KB` minified) dominates. The app code itself is small.
- Files: `dist/assets/index-DjpY_CxB.js`
- Impact: First-load cost on slow networks.
- Mitigation: Use Three.js tree-shaking-friendly imports (already in place via `examples/jsm/` direct imports); consider lazy-loading post-processing only when `usePostProcessing` flips on.

---

*Concerns audit: 2026-05-20*
