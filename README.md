# Stellar Renderer 3D

An interactive, physically-grounded WebGL 2 simulation of the Sun and other stellar classes. Procedural surface granulation, magnetic prominences, volumetric coronal streamers, lens flares, auto-exposure bloom, and a side-by-side Comparison Mode covering 12 famous stars from Sirius B to UY Scuti.

🔭 **Live demo:** https://fgferre.github.io/stellar-renderer-3d/

## Features

- **Procedural shader stack** — surface FBM, magnetic plages, prominence vertex displacement, billboarded volumetric corona, polar jets for high-energy stars.
- **Stellar classification engine** — paste any Morgan-Keenan code (`O5I`, `K5III`, `DA2`, `B1Ia`...) and the renderer derives temperature, mass, radius, luminosity, rotation, oblateness, jet intensity, and pulsation from the spectral class.
- **HYG catalog presets** — Sirius A/B, Proxima Centauri, Sun, Vega, Arcturus, Aldebaran, Rigel, Deneb, Antares, Betelgeuse, UY Scuti, etc. with real catalog values overriding MK estimates.
- **Comparison Mode** — line up 12 stars at once. Toggle between *Visual (log)* and *Real (linear)* scale. Cinematic flyby choreography.
- **Cockpit HUD** — live telemetry: Kepler-Newton orbital velocity, equilibrium temperature, distance in AU, mass, radius, luminosity, rotational velocity.
- **Auto-exposure** — dynamic bloom envelope and tone-mapping exposure based on camera distance to the active star; gentler envelope in Comparison Mode to avoid additive overlap blowouts.

## Tech stack

- **three.js 0.184** (WebGL 2, custom raw `ShaderMaterial`, postprocessing `UnrealBloomPass`, `Lensflare`)
- **Vite 8** (dev server + production bundler)
- **lil-gui 0.21** (parameter panel)
- **Vitest 4** (unit tests for the stellar classifier)
- Pure ES modules, no framework, no transpiler beyond Vite's defaults

## Dev setup

Requires **Node ≥ 20.19** (Vite 8 minimum; pinned via `package.json#engines`).

```bash
npm install
npm run dev        # local dev server with HMR on :5173
npm run build      # production bundle into dist/
npm run preview    # preview the production bundle
npm test           # run vitest unit suite (single run)
npm run test:watch # vitest watch mode
```

## Project structure

```
src/
├── js/
│   ├── main.js                 # scene setup, animation loop, HUD wiring, GUI, Comparison Mode
│   ├── sun.js                  # Sun class: core mesh, prominence shell, corona billboard, lens flares
│   ├── starfield.js            # 6k twinkling background stars
│   ├── shaders.js              # GLSL strings: surface, prominence, corona, starfield
│   ├── stellarClassifier.js    # MK parser, kelvin→RGB, HYG catalog, derived params
│   └── __tests__/              # vitest suite
└── style.css                   # HUD, glass panels, responsive breakpoints
index.html                      # entry point, HUD scaffold
```

## Comparison Mode physics notes

In **Visual (log)** mode, each star uses a `visualScaleDefault` so the line-up is didactic — Sirius B is visibly tiny, UY Scuti is visibly huge, but neither breaks the layout. In **Real (linear)** mode, each star uses its actual `radius` in solar radii: UY Scuti (≈1700 R☉) renders ~200,000× larger than Sirius B (≈0.0084 R☉), so the camera far-plane stretches to 30 million scene units. Depth precision is not a practical issue here because every renderable surface uses `depthWrite: false` for transparent layers (corona, prominences) and the only opaque object per star is the core sphere — different stars sit on the X axis far apart so their cores never overlap in projected depth.

## Acknowledgements

- HYG database star parameters
- Ashima Arts simplex noise (used in the prominence and corona shaders)
- Blackbody radiation color mapping based on Tanner Helland's approximation
- Shadertoy-style 7-color stellar surface palette as a reference for the surface FBM

---

Built with [Claude Code](https://claude.com/claude-code).
