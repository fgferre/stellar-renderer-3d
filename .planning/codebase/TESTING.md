# Testing Patterns

**Analysis Date:** 2026-05-20

> **Status: NO TESTS EXIST.** This project has no test framework configured, no test files, and no testing infrastructure. The sections below document the current (empty) state honestly, then offer concrete recommendations for adding tests to a Three.js / WebGL2 application of this shape.

## Test Framework

**Runner:** **None.**

- No `jest.config.*`, `vitest.config.*`, `karma.conf.*`, `playwright.config.*`, `cypress.config.*`, or `mocha.opts` in the project
- No `test`, `spec`, `vitest`, `jest`, `mocha`, `playwright`, `cypress`, `puppeteer`, `@testing-library/*`, `chai`, or `sinon` entries in `package.json` `dependencies` or `devDependencies`
- `package.json` (`package.json:6-10`) defines only three scripts and they are all build/run operations, not tests:
  ```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
  ```
- No `npm test` script defined; running `npm test` falls back to the default npm "no test specified" error

**Assertion Library:** **None.**

**Run Commands:** **None applicable.** The closest thing to validation is manual:
```bash
npm run dev      # Start Vite dev server, eyeball the rendering at http://localhost:5173
npm run build    # Produce a production bundle (catches syntax errors, missing imports)
npm run preview  # Serve the built bundle to sanity-check production output
```

## Test File Organization

**Location:** No test files in the repository.

- `Glob **/*.{test,spec}.{js,ts}` → **0 results**
- `Glob {test,tests,__tests__,spec,specs}/**/*` → **0 results**
- No `tests/` directory; no co-located `*.test.js` files

**Naming:** No convention exists yet. If tests are added, the natural choices given the rest of the codebase would be:
- Co-located: `src/js/stellarClassifier.test.js` next to `src/js/stellarClassifier.js`
- Or grouped: `tests/stellarClassifier.test.js`

**Structure:** Not applicable — no tests exist.

## Test Structure

Not applicable. No reference patterns established in this codebase.

## Mocking

Not applicable. No mocking framework, no test doubles, no fixtures.

## Fixtures and Factories

Not applicable. No fixtures exist.

**Note:** The closest thing to a "fixture" in the codebase is the hard-coded `HYG_DATABASE` object in `src/js/stellarClassifier.js:193-210`, which holds reference star data (Sirius, Betelgeuse, Vega, Rigel, etc.). This could serve as expected-value input for future tests of `lookupHYGStar`.

## Coverage

**Requirements:** None enforced. No coverage tool configured, no coverage threshold defined.

**View Coverage:** Not applicable until a runner is added.

## Test Types

**Unit Tests:** **None.**

**Integration Tests:** **None.**

**E2E Tests:** **None.** No Playwright, Cypress, Puppeteer, WebDriverIO, or Selenium configuration.

**Visual Regression Tests:** **None.** No reference images checked in, no screenshot diff tooling (Percy, Chromatic, Loki, BackstopJS, etc.).

**Performance Tests:** **None.** No frame-rate budget tests; the codebase relies on developer-side comments like `// Half-resolution for 75% GPU fill-rate savings` (`src/js/main.js:78`) and `// Optimized to 3-octaves for 60+ FPS` (`src/js/shaders.js`).

## Common Patterns

Not applicable. No tests to reference.

---

## Recommendations for Adding Tests

The codebase is small (5 JS modules, ~1000 lines) and unlikely to need exhaustive coverage. But several modules are highly testable in isolation, and a Three.js WebGL2 app benefits from a layered testing strategy. Below is a pragmatic plan tailored to this project.

### Tier 1 — Pure-JS unit tests (highest ROI, easiest to set up)

The following modules contain pure math/parsing logic with no DOM or WebGL dependency. They can be unit-tested with a JS-only runner.

**Recommended framework: Vitest**
- Reasoning:
  - Vitest is ESM-native (matches `"type": "module"` in `package.json`)
  - Same Vite config it would inherit — zero new build config
  - Jest-compatible API (`describe`, `it`, `expect`) for low learning curve
  - Run command: add `"test": "vitest"` and `"test:run": "vitest run"` to `package.json`

**Install:**
```bash
npm install -D vitest
```

**High-value targets in this codebase:**

1. **`src/js/stellarClassifier.js`** — the single most testable module.
   - `parseMKClassification(spectralString)` — pure regex + branch logic, returns a settings object or `null`
     - Test valid inputs: `"G2V"` → expected `highTemp ≈ 5840 * 1.1`, `scale = 1.0`, `coronaDensity = 0.95`
     - Test edge cases: `"o5i"` (lowercase), `"M5III"` (red giant scale), `"DA2"` (white dwarf — `lumClass = 'VII'`, `prominenceHeight = 0.0`)
     - Test invalid inputs: `""`, `"XYZ"`, `"123"`, `"G99V"` → `null`
     - Test default subclass fallback: `"GV"` → `subclass = 5`
     - Test luminosity-class branches: `'I'`, `'III'`, `'IV'`, `'V'`, `'VI'`, `'VII'`, `'IA'`, `'IB'`
   - `lookupHYGStar(nameQuery)` — hash lookup + scale calculation
     - Test name normalization: `"sun"`, `"Sirius A"`, `"sirius a"`, `"sirius-a"` all resolve correctly
     - Test scale compression bounds: should always be in `[0.35, 2.8]` for every entry in `HYG_DATABASE`
     - Test miss path: `"NotARealStar"` → `null`
   - `kelvinToColorGrading(temp)` — Vector3 conversion
     - Test boundary temperatures: `2000`, `5778` (Sun), `10000`, `25000`, `50000`
     - Assert returned `THREE.Vector3` components are in `[0, 1]` after clamping/normalization
     - Assert warm bias for low temps (`r > b`), blue bias for high temps (`b > r`)

   **Example test sketch** (`src/js/stellarClassifier.test.js`):
   ```js
   import { describe, it, expect } from 'vitest';
   import { parseMKClassification, lookupHYGStar, HYG_DATABASE } from './stellarClassifier.js';

   describe('parseMKClassification', () => {
     it('parses Sol-like G2V correctly', () => {
       const result = parseMKClassification('G2V');
       expect(result).not.toBeNull();
       expect(result.scale).toBe(1.0);
       expect(result.coronaDensity).toBeCloseTo(0.95);
     });

     it('flags white dwarfs as scale 0.35 with no corona', () => {
       const result = parseMKClassification('DA2');
       expect(result.scale).toBe(0.35);
       expect(result.coronaDensity).toBe(0.0);
       expect(result.prominenceHeight).toBe(0.0);
     });

     it('returns null for malformed input', () => {
       expect(parseMKClassification('not-a-class')).toBeNull();
       expect(parseMKClassification('')).toBeNull();
     });

     it('is case-insensitive and trims whitespace', () => {
       expect(parseMKClassification('  g2v  ')).toEqual(parseMKClassification('G2V'));
     });
   });

   describe('lookupHYGStar', () => {
     it('finds Sirius regardless of formatting', () => {
       const a = lookupHYGStar('Sirius A');
       const b = lookupHYGStar('siriusa');
       expect(a).not.toBeNull();
       expect(a.displayName).toContain('Sirius');
       expect(a).toEqual(b);
     });

     it('compresses every catalog entry into visual scale [0.35, 2.8]', () => {
       for (const key of Object.keys(HYG_DATABASE)) {
         const result = lookupHYGStar(key);
         if (result) {
           expect(result.scale).toBeGreaterThanOrEqual(0.35);
           expect(result.scale).toBeLessThanOrEqual(2.8);
         }
       }
     });
   });
   ```

   **Note:** `parseMKClassification` imports `THREE.Vector3`. In a Vitest environment running Node, this requires either:
   - Running Vitest with the default `node` environment (Three.js is generally CommonJS-safe enough for `Vector3` to construct without a WebGL context), or
   - Configuring `environment: 'jsdom'` if any DOM is touched. For `stellarClassifier` only, plain `node` is sufficient.

2. **Math helpers inside `src/js/main.js`** — `updateTelemetry` does Keplerian distance/velocity/temperature math. Currently mutates DOM (`valDistance.textContent = ...`), which couples it to the page.
   - **Refactor first**: extract the math into a pure function in a new file `src/js/telemetry.js`:
     ```js
     export function computeTelemetry(distance, baseTemp) {
       const distanceAU = distance / 800.0;
       const speedKmS = 29.78 / Math.sqrt(distanceAU);
       const sensorTempK = baseTemp / Math.sqrt(distanceAU * 0.8);
       return { distanceAU, speedKmS, sensorTempK };
     }
     ```
   - Then unit-test it: `computeTelemetry(800, 5800)` → `distanceAU = 1.0`, `speedKmS ≈ 29.78`, etc.

### Tier 2 — Smoke / boot tests (catch wiring breakage)

A single "does the app boot without throwing" test is high-value for a small WebGL portfolio piece.

**Approach: jsdom + happy-dom + minimal stubs**

- Run Vitest with `environment: 'jsdom'` (or `happy-dom` for speed)
- Mock or no-op the WebGL canvas: `HTMLCanvasElement.prototype.getContext = () => fakeGL`
- Provide `requestAnimationFrame` stub
- Assert that `init()` runs to completion and that key globals (`scene`, `camera`, `sun`, `starfield`) are non-null after one tick

**Caveat:** Three.js's `WebGLRenderer` constructor will fail without a real WebGL context. Two options:
- **(a) Stub `WebGLRenderer`** with a fake that has `setSize`, `setPixelRatio`, `domElement`, `render` no-ops
- **(b) Run boot tests inside a headless browser** instead (Playwright / Puppeteer) — see Tier 3

### Tier 3 — End-to-end + visual regression (highest value for a renderer)

A 3D renderer is mostly a *visual* contract: "the Sun should look like a sun at G2V, look red-and-bumpy at M5III, look blue-and-tight at O5I." Unit tests cannot catch shader regressions, but **screenshot-diff tests can**.

**Recommended stack: Playwright + pixelmatch**

**Install:**
```bash
npm install -D @playwright/test pixelmatch pngjs
npx playwright install chromium
```

**Test strategy:**
1. **`playwright.config.js`** — launch Chromium with WebGL enabled (default), fixed viewport (e.g., `1280x720`), and a deterministic render harness
2. **Add a determinism switch to `main.js`** — when a query param like `?test=1` is present, freeze the animation clock at `t = 1.0`, disable the loader fade-out timeout, and skip auto-exposure interpolation. This is what makes screenshot diffs stable.
3. **For each preset**, navigate to `index.html?test=1&preset=sol`, wait for `#load-progress` width to be `100%`, take a screenshot of `#canvas-container`, and compare against a committed baseline PNG in `tests/__screenshots__/sol.png`.

**Example test:**
```js
import { test, expect } from '@playwright/test';

const PRESETS = ['sol', 'redgiant', 'bluesuper', 'whitedwarf'];

for (const preset of PRESETS) {
  test(`renders ${preset} stably`, async ({ page }) => {
    await page.goto(`http://localhost:5173/?test=1&preset=${preset}`);
    await page.waitForFunction(() =>
      document.getElementById('load-progress')?.style.width === '100%'
    );
    // Click the preset button to actually apply it
    await page.click(`[data-preset="${preset}"]`);
    // Allow one frame for the apply + GUI refresh
    await page.waitForTimeout(100);

    await expect(page.locator('#canvas-container canvas'))
      .toHaveScreenshot(`${preset}.png`, { maxDiffPixelRatio: 0.02 });
  });
}
```

**What this catches that unit tests cannot:**
- A typo in `surfaceFragmentShader` that produces a black sphere
- A regression where the corona alpha goes opaque (covering the disk)
- A wrong uniform name causing all stars to render as Sol
- Bloom strength accidentally clamped to 0 on the post-processing path

**Trade-off:** Baselines must be updated whenever the visuals legitimately change (e.g., new color palette, tweaked noise scale). Treat baseline diffs as a code-review checkpoint.

### Tier 4 — Performance / frame-time tests (optional)

If frame rate is a stated goal (comments suggest 60+ FPS), add a Playwright test that:
1. Loads the page with `?test=1&preset=bluesuper` (the most expensive preset due to highest convection speed + corona density)
2. Uses `page.evaluate` to sample `performance.now()` deltas inside the `animate` loop across ~120 frames
3. Asserts the 95th-percentile frame time is below ~20 ms (allowing for CI hardware variance)

This is fragile on CI runners without GPUs (most don't have one) — consider running this only on dedicated machines, or only locally.

### Tier 5 — GLSL syntax tests (optional, low priority)

Shader strings in `src/js/shaders.js` are template literals — typos compile silently in JS but error out at runtime when Three.js compiles them. A lightweight protection is a **boot test** (Tier 2) that constructs a `Sun` and `createStarfield()` against a stubbed WebGL2 context that simulates `compileShader` failure detection. Libraries like `gl` (headless-gl) can run GLSL compilation in Node, but setup is non-trivial. **Skip unless shader regressions become a recurring problem.**

### What NOT to test

- **`THREE.js` internals** — assume Three.js is correct; test only the integration glue
- **`lil-gui` rendering** — same; test only that `setupGUI` runs without throwing
- **The exact numeric uniform values produced after a slider drag** — too brittle, replace with screenshot tests
- **CSS / DOM layout** — single-page demo, no responsive contract; spot-check manually

### Suggested first commit

The minimum sensible test suite for this project — one that catches real regressions without overengineering — is:

1. Add `vitest` as a devDep
2. Add `"test": "vitest run"` to `package.json`
3. Add `src/js/stellarClassifier.test.js` covering the three exported functions (~30–50 assertions, ~150 lines)
4. (Optional follow-up) Refactor `updateTelemetry` math into a pure `src/js/telemetry.js` and test it

That alone covers >50% of the non-rendering logic in the codebase and runs in <1 second.

---

*Testing analysis: 2026-05-20*
