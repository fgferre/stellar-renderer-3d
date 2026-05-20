# Testing Patterns

**Analysis Date:** 2026-05-20

> **Verdict: There is no test infrastructure of any kind in this project.**
>
> - No `*.test.*` or `*.spec.*` files exist anywhere in the repository (confirmed via glob across `src/`, `public/`, `dist/`, root).
> - `package.json` defines only three scripts — `dev`, `build`, `preview` — none for testing.
> - **No test runner is installed.** Neither `devDependencies` nor `dependencies` in `package.json` include Vitest, Jest, Mocha, Tape, Playwright, Cypress, Puppeteer, or any other testing framework. The only dev dependency is `vite ^8.0.12`.
> - No test configuration files (`vitest.config.*`, `jest.config.*`, `playwright.config.*`, `cypress.config.*`) exist.
> - No CI workflow files (`.github/workflows/`, `.gitlab-ci.yml`, etc.) exist.
> - No coverage thresholds or coverage tooling are configured.
> - No assertion helpers, fixtures, or mocks have been written.
> - No manual smoke-test checklist or QA documentation has been written.
>
> Verification & maintenance of behaviour today is **purely visual / manual** by running `npm run dev` and inspecting the WebGL canvas, the HUD telemetry, and the lil-gui parameter panel.

## Test Framework

**Runner:** None installed.

**Assertion Library:** None.

**Run Commands:** None defined.

The full `scripts` section of `package.json` is:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview"
}
```

## Test File Organization

Not applicable — no tests exist.

## Test Structure

Not applicable.

## Mocking

Not applicable.

## Fixtures and Factories

Not applicable. The closest thing to "test fixtures" in the code are:
- The four canned star presets defined in `Sun#getPresetDefaultSettings(presetName)` (`src/js/sun.js:351-456`) — `sol`, `redgiant`, `bluesuper`, `whitedwarf`.
- The 17-entry `HYG_DATABASE` of real catalog stars in `src/js/stellarClassifier.js:329-348` (Sirius A/B, Betelgeuse, Vega, Polaris, Antares, Deneb, Altair, UY Scuti, etc.).
- The `lineupData` array used to populate Comparison Mode in `src/js/main.js:318-331` (12 stars).

These are usable as known-good inputs / expected baselines if and when tests are introduced.

## Coverage

**Requirements:** None enforced.

**View Coverage:** Not available.

## Test Types

**Unit Tests:** None.

**Integration Tests:** None.

**E2E Tests:** None.

---

## Recommended Testing Approach

If tests are to be introduced, **the path of least resistance and highest immediate value is unit-testing the pure-logic modules first** — chiefly `src/js/stellarClassifier.js`. The Three.js-bound code in `src/js/sun.js`, `src/js/starfield.js`, and most of `src/js/main.js` requires a WebGL context or DOM and is much harder to test.

### Tier 1 — Pure logic (highest leverage, easiest to test)

**Target file:** `src/js/stellarClassifier.js` (404 lines, **the most testable file in the project**).

**Why this is the right starting point:**
- Three pure exported functions (`kelvinToColorGrading`, `parseMKClassification`, `lookupHYGStar`) — no DOM, no WebGL, no global state.
- One pure data export (`HYG_DATABASE`).
- The only Three.js dependency is `THREE.Vector3` as a value container — easy to import in a node-side test runner.
- All three functions have well-defined input domains and deterministic outputs.
- The functions encode real domain knowledge (Morgan-Keenan spectral classification, Stefan-Boltzmann luminosity, blackbody color) — regressions would be silent and visually subtle, so tests pay back fast.

**Concrete unit-test ideas:**

For `parseMKClassification(spectralString)` (`stellarClassifier.js:47-327`):
- **Happy-path cases per spectral class:** `'G2V'` → `specClass === 'G'`, `lumClass === 'V'`, `baseTemp ≈ 5840`, `scale ≈ 1.0`, `mass ≈ 0.99`.
- **Each preset string:** `'G2V'`, `'M5III'`, `'O5I'`, `'DA2'` should each yield distinct, plausible parameters (these match the four preset buttons in the HUD).
- **Subclass defaulting:** Inputs without a digit (e.g. `'G'`) should default subclass to `5` — assert that.
- **Luminosity-class defaulting:** Inputs without a luminosity suffix (e.g. `'G2'`) should default to `'V'` — assert that.
- **White-dwarf override:** `'DA2'`, `'DB5'` should force `lumClass === 'VII'`, `scale === 0.35`, `prominenceHeight === 0.0`, `coronaDensity === 0.0`, `sunspotThreshold === -0.5`.
- **Supergiant detection:** `'O5Ia'`, `'M2I'`, `'F7Ib'` should set `isSupergiant`-derived params (mass floor of 20, pulse > 0 only for non-OB).
- **Invalid input:** `'Z9X'`, `''`, `'INVALID'` should return `null`.
- **Whitespace / case tolerance:** `'  g2v  '`, `'g2V'`, `'G 2 V'` should all parse to the same result as `'G2V'` (`stellarClassifier.js:49`).
- **Bounds clamping:** Verify `baseTemp` never exceeds `[2000, 50000]` regardless of input.

For `kelvinToColorGrading(temp)` (`stellarClassifier.js:4-41`):
- **Returns a `THREE.Vector3`** with each component in `[0.1, 1.25]` (post-normalization).
- **Hot stars (`temp > 10000`)** have `z >= x` (blue-shifted).
- **Cool stars (`temp < 4000`)** have `x > y > z` (red-shifted) and `z <= 0.38`.
- **Boundary cases:** `temp = 6600` (around the t=66 branch in the algorithm), `temp = 5800` (Sol).

For `lookupHYGStar(nameQuery)` (`stellarClassifier.js:350-404`):
- **Each catalog key resolves:** Loop over `Object.keys(HYG_DATABASE)`, assert non-null return and that returned `mass`, `radius`, `lum`, `vRot` match the database entry.
- **Case / punctuation tolerance:** `'sirius a'`, `'SIRIUS-A'`, `' SIRIUSA '` should all hit the `SIRIUSA` entry.
- **Unknown names return `null`:** `'Tatooine'`, `''`, `'   '`.
- **Vega override applied:** Asserts the `oblateness === 0.83` and `polarJetIntensity === 0.4` branches at `stellarClassifier.js:383-386`.
- **Visual-scale compression:** `radius=1700` (UY Scuti) should be clamped via `Math.min(1.6, ...)` so `scale <= 2.6`.

### Tier 2 — Lightly DOM-coupled logic

If a test runner is already set up, the following also tests reasonably with a JSDOM-style environment:

- `Sun#copyParams(source, target)` (`src/js/sun.js:129-141`) — pure data-cloning helper, properly handles `THREE.Vector3` references. Testable without WebGL: instantiate two plain objects (or vector-shaped objects) and assert deep equality after copy.
- `Sun#getPresetDefaultSettings(presetName)` (`src/js/sun.js:351-456`) — returns a plain object for each of the 4 preset names; pure function aside from the `new THREE.Vector3(...)` instantiation.
- `Sun#getDefaultParams()` (`src/js/sun.js:96-127`) — pure object literal builder.

**Limitation:** The full `Sun` constructor calls `THREE.SphereGeometry`, `THREE.ShaderMaterial`, etc., which require either a real WebGL context (headless-gl, Playwright) or careful mocking. Don't try to unit-test the full class — extract pure helpers into their own module first if you need that coverage.

### Tier 3 — Visual / WebGL-coupled

`src/js/main.js`, `src/js/sun.js` (construction + uniform updates), `src/js/starfield.js`, and `src/js/shaders.js` are all rendering-bound. For these, the realistic options are:

- **Smoke tests via Playwright** that launch the Vite dev server, wait for the loader to fade out, and assert that the canvas pixel-count > 0 and key DOM elements (`#hud-star-class`, `#val-distance`) update when preset buttons are clicked. This catches catastrophic regressions (crashes, blank canvas, broken HUD wiring) without requiring shader output validation.
- **Visual regression** via Playwright + pixel-diffing is possible but expensive for a procedural-noise-heavy renderer because frame output is non-deterministic. If pursued, seed `THREE.MathUtils` / `Math.random` calls and disable the time uniform.
- **Shader compile checks** can be done by spawning a headless WebGL2 context (e.g. via `puppeteer` or `gl` npm package) and asserting `gl.getShaderParameter(shader, gl.COMPILE_STATUS) === true` for each shader exported from `src/js/shaders.js`.

### Suggested first commit

**Lowest-effort, highest-payoff next step:**

1. `npm install --save-dev vitest` (Vitest is the natural pick — same Vite toolchain, ESM-first, zero config).
2. Add `"test": "vitest"` to `package.json` scripts.
3. Create `src/js/stellarClassifier.test.js` (or a top-level `tests/` directory if co-location is undesired) covering the cases listed under Tier 1.

Even ~30 assertions across the three pure functions in `stellarClassifier.js` would meaningfully protect the most domain-rich, least-self-documenting code in the project.

## Common Patterns

Not applicable — no existing tests to reference.

---

*Testing analysis: 2026-05-20*
