import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GUI } from 'lil-gui';

import '../style.css'; // Vite imports stylesheet
import { Sun } from './sun.js';
import { createStarfield } from './starfield.js';
import { parseMKClassification, lookupHYGStar, kelvinToColorGrading } from './stellarClassifier.js';

// Application State Variables
// Physical / scene-scale constants. These tie the abstract scene-unit space
// (where 1 sun radius = 100 units) to physical units for the HUD readouts.
// SCENE_UNITS_PER_AU is independent of the sun-radius convention and was
// chosen visually; it's the calibration knob between camera distance and
// the "X.XXX AU" telemetry display.
const SCENE_UNITS_PER_AU = 800.0;
// Earth's circular orbital velocity at 1 AU around 1 M☉. Used as the reference
// for the Kepler-Newton orbital speed formula v = 29.78 * sqrt(M / r).
const EARTH_ORBITAL_VELOCITY_KMS = 29.78;
// Equilibrium temperature constant: planet/probe temperature at 1 AU from a
// 1 L☉ star, assuming Earth-like albedo ~0.3. Used for the sensor temperature
// readout: T = K * L^0.25 / sqrt(d_AU).
const EARTH_EQUILIBRIUM_TEMP_K = 278.0;

// Bloom envelope — interpolates between "near star" (camera close, dNorm=0)
// and "far star" (camera at the auto-exposure outer bound, dNorm=1). In single
// star mode the far ceiling is intentionally dramatic (AAA glare). In Comparison
// Mode it would amplify additive corona/surface overlap when multiple stars
// stack in screen space, so the far ceiling is reduced and the threshold raised
// — bloom is throttled but not removed, preserving glow without blowing out the
// composite. Single-star rendering is unaffected.
const BLOOM_NEAR_STRENGTH = 0.15;
const BLOOM_SINGLE_FAR_STRENGTH = 0.75;
const BLOOM_COMPARISON_FAR_STRENGTH = 0.35;
const BLOOM_NEAR_THRESHOLD = 0.90;
const BLOOM_SINGLE_FAR_THRESHOLD = 0.78;
const BLOOM_COMPARISON_FAR_THRESHOLD = 0.95;

let scene, camera, renderer, controls, gui;
let sun, starfield;
let composer, bloomPass;
let scaleController = null; // lil-gui controller for the Stellar Visual Scale slider
let clock, timeSpeed = 1.0;
// Accumulator for simulated shader time. Decouples shader animation from
// timeSpeed changes (slider drags) — using clock.getElapsedTime() * timeSpeed
// caused a visible jump whenever the user changed speed (e.g. timeSpeed 1->2
// at t_real=10s made the multiplied value jump from 10 to 20). Advance per
// frame instead so changes apply forward in time only.
let simTime = 0;
let lastTelemetryUpdateTime = 0;
let usePostProcessing = false; // Default to direct WebGL rendering for 60 FPS

// Color proxies for lil-gui color pickers
const guiColorProxies = {
  starColor: '#ffffff',
  plageColor: '#ffffff'
};

// Autopilot flight control states
let isFlying = false;
let flightTargetPos = new THREE.Vector3();
let flightTargetLookAt = new THREE.Vector3(0, 0, 0);
let flightSpeed = 0.035; // Easing factor

// Comparison Mode States
let isComparisonMode = false;
let comparisonGroup = null;
let comparisonStars = [];
let activeFocusedStar = null;
let comparisonScaleMode = 'visual'; // 'visual' (logarithmic) or 'real' (linear)
let mainSunParamsBackup = null; // Backup for main sun's parameters
let mainSunPresetBackup = null; // Backup for sun.currentPresetName so exit restores the user's prior preset
let mainSunHUDBackup = null;    // Backup for HUD class label { textContent, className }

// Cinematic Flyby States
let isCinematicMode = false;
let cinematicTime = 0;
let comparisonBasePositions = [];

// DOM Telemetry elements
const valDistance = document.getElementById('val-distance');
const valVelocity = document.getElementById('val-velocity');
const valTemperature = document.getElementById('val-temperature');
const valMass = document.getElementById('val-mass');
const valRadius = document.getElementById('val-radius');
const valLuminosity = document.getElementById('val-luminosity');
const valRotationVelocity = document.getElementById('val-rotation-velocity');
const hudStarClass = document.getElementById('hud-star-class').querySelector('.reading-value');
const loadProgressBar = document.getElementById('load-progress');
const loaderScreen = document.getElementById('loader');

// Initialize WebGL Application
function init() {
  clock = new THREE.Clock();

  // 1. Scene & Camera Setup
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x020205, 0.00003); // Softer far fog

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1.0, 500000);
  camera.position.set(0, 300, 1000); // Standard starting view

  // 2. WebGL Renderer configuration (HDR & Tone mapping)
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2 for performance
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  
  document.getElementById('canvas-container').appendChild(renderer.domElement);

  // 3. Orbit Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 140.0; // Avoid clipping inside surface prominences
  controls.maxDistance = 150000.0; // Zoom past the starfield shell (25k-35k units)
  controls.addEventListener('start', () => {
    isFlying = false; // Intercept autopilot flight on manual interaction
  });

  // Update progress
  updateLoadProgress(30);

  // 4. Create Scene Objects
  sun = new Sun(scene);

  // Initialize color proxies for GUI
  const maxVal = Math.max(sun.params.colorGrading.x, sun.params.colorGrading.y, sun.params.colorGrading.z);
  const scale = maxVal > 0.0 ? maxVal : 1.0;
  guiColorProxies.starColor = '#' + new THREE.Color(
    sun.params.colorGrading.x / scale,
    sun.params.colorGrading.y / scale,
    sun.params.colorGrading.z / scale
  ).getHexString();
  guiColorProxies.plageColor = '#' + new THREE.Color(
    sun.params.plageColorGrading.x,
    sun.params.plageColorGrading.y,
    sun.params.plageColorGrading.z
  ).getHexString();

  updateLoadProgress(60);

  // Initialize physical stats in telemetry panel
  updatePhysicalHUD();

  starfield = createStarfield(6000);
  scene.add(starfield);
  updateLoadProgress(80);

  // 5. Post-Processing Pipeline Setup (High Quality Bloom)
  const renderPass = new RenderPass(scene, camera);
  
  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), // Half-resolution for 75% GPU fill-rate savings
    1.8, // Strength
    0.48, // Radius
    0.88 // Threshold
  );

  const outputPass = new OutputPass();

  composer = new EffectComposer(renderer);
  composer.addPass(renderPass);
  composer.addPass(bloomPass);
  composer.addPass(outputPass);

  // 6. Cockpit HUD Events Binding
  setupHUDBindings();

  // 7. Parameter Control Panel GUI Mounting
  setupGUI();

  updateLoadProgress(100);

  // Fade out loader screen
  setTimeout(() => {
    loaderScreen.classList.add('fade-out');
  }, 600);

  // 8. Event Listeners
  window.addEventListener('resize', onWindowResize);

  // Start loop
  animate();
}

// Update Loader bar width
function updateLoadProgress(pct) {
  if (loadProgressBar) {
    loadProgressBar.style.width = `${pct}%`;
  }
}

// Mirror the visual .active state onto aria-pressed for every button that
// declared aria-pressed in HTML (or had it added at creation time). Called
// after any block that mutates .active so screen readers stay in sync.
function syncAriaPressed() {
  document.querySelectorAll('button[aria-pressed]').forEach(btn => {
    btn.setAttribute('aria-pressed', btn.classList.contains('active') ? 'true' : 'false');
  });
}

// Handle updates to star parameters from the GUI control panel
function onGUIParameterChange() {
  const star = (isComparisonMode && activeFocusedStar) ? activeFocusedStar : sun;
  sun.copyParams(sun.params, star.params);
  star.applyCurrentParams();

  if (isComparisonMode) {
    updateComparisonLayout();
  }
}

// Setup GUI control options inside the glass panel container
function setupGUI() {
  gui = new GUI({
    container: document.getElementById('gui-container'),
    title: 'STATION PARAMETERS'
  });

  // Global Reset button at the top of the controls panel
  gui.add({
    reset: () => {
      const star = (isComparisonMode && activeFocusedStar) ? activeFocusedStar : sun;
      star.resetCurrentPresetToDefault();
      controls.minDistance = 140.0 * star.params.scale;
      updateGUIDisplay();
      updatePhysicalHUD();
      if (isComparisonMode) {
        updateComparisonLayout();
        updateComparisonLensFlares();
      }
    }
  }, 'reset').name('↺ Reset Star to Default');

  // Core Surface Controls Folder
  const fSurface = gui.addFolder('1. Solar Surface Core');
  fSurface.add(sun.params, 'highTemp', 1000, 25000, 100).name('Max Temp (K)').onChange(() => {
    const newColorGrading = kelvinToColorGrading(sun.params.highTemp);
    sun.params.colorGrading.copy(newColorGrading);
    onGUIParameterChange();
    updateGUIDisplay();
  });
  fSurface.add(sun.params, 'convectionSpeed', 0.0, 1.0, 0.01).name('Convection Speed').onChange(onGUIParameterChange);
  fSurface.add(sun.params, 'sunspotThreshold', 0.1, 0.9, 0.01).name('Sunspot Coverage').onChange(onGUIParameterChange);
  fSurface.add(sun.params, 'plageIntensity', 0.0, 2.0, 0.05).name('Plage Intensity').onChange(onGUIParameterChange);
  fSurface.add(sun.params, 'noiseScale', 0.1, 1.2, 0.02).name('Surface Granulation').onChange(onGUIParameterChange);
  fSurface.add(sun.params, 'limbExponent', 0.0, 2.0, 0.05).name('Limb Darkening Exp').onChange(onGUIParameterChange);
  fSurface.add(sun.params, 'limbBase', 0.0, 1.0, 0.05).name('Limb Darkening Base').onChange(onGUIParameterChange);
  fSurface.addColor(guiColorProxies, 'starColor').name('Star Tint Color').onChange((val) => {
    const c = new THREE.Color(val);
    sun.params.colorGrading.set(c.r * 1.25, c.g * 1.25, c.b * 1.25);
    onGUIParameterChange();
  });
  fSurface.addColor(guiColorProxies, 'plageColor').name('Plage Tint Color').onChange((val) => {
    const c = new THREE.Color(val);
    sun.params.plageColorGrading.set(c.r, c.g, c.b);
    onGUIParameterChange();
  });
  fSurface.close();

  // Prominences & Loop Controls Folder
  const fProm = gui.addFolder('2. Magnetic Prominences');
  fProm.add(sun.params, 'prominenceHeight', 0.0, 50.0, 0.5).name('Max Height').onChange(onGUIParameterChange);
  fProm.add(sun.params, 'prominenceSpeed', 0.0, 0.5, 0.01).name('Boiling Velocity').onChange(onGUIParameterChange);
  fProm.add(sun.params, 'prominenceBaseTemp', 1000.0, 20000.0, 100.0).name('Plasma Temp (K)').onChange(onGUIParameterChange);
  fProm.add(sun.params, 'prominenceEdgeFade', 1.0, 10.0, 0.2).name('Edge Falloff (Limb)').onChange(onGUIParameterChange);
  fProm.add(sun.params, 'polarJetIntensity', 0.0, 2.0, 0.05).name('Polar Jets Intensity').onChange(onGUIParameterChange);
  fProm.close();

  // Volumetric Corona Folder
  const fCorona = gui.addFolder('3. Coronal streamers');
  fCorona.add(sun.params, 'coronaDensity', 0.0, 3.0, 0.05).name('Streamers Density').onChange(onGUIParameterChange);
  fCorona.add(sun.params, 'coronaSpeed', 0.0, 1.0, 0.01).name('Solar Wind Velocity').onChange(onGUIParameterChange);
  fCorona.close();

  // Lens Flare & Post-Processing Controls
  const fPost = gui.addFolder('4. Atmosphere & Exposure');
  fPost.add(sun.params, 'lensFlaresEnabled').name('Camera Lens Flares').onChange(() => {
    onGUIParameterChange();
    if (isComparisonMode) {
      updateComparisonLensFlares();
    }
  });
  
  // Toggle for render mode (Bloom vs. Direct)
  const renderModeConfig = { useBloom: usePostProcessing };
  fPost.add(renderModeConfig, 'useBloom').name('Render Post-bloom').onChange((val) => {
    usePostProcessing = val;
    if (!val && bloomPass) {
      bloomPass.strength = 0.0;
    }
  });

  fPost.add(bloomPass, 'strength', 0.0, 5.0, 0.1).name('Bloom Intensity').listen();
  fPost.add(bloomPass, 'threshold', 0.0, 1.0, 0.01).name('Bloom Threshold').listen();
  fPost.add(renderer, 'toneMappingExposure', 0.1, 4.0, 0.05).name('Camera Exposure').listen();
  
  // Custom control for animation speed
  const timeControl = { speed: 1.0 };
  fPost.add(timeControl, 'speed', 0.0, 3.0, 0.1).name('Simulated Time Speed').onChange((val) => timeSpeed = val);
  fPost.close();

  // Dynamics & Pulsation Folder
  const fDynamics = gui.addFolder('5. Dynamics & Pulsation');
  scaleController = fDynamics.add(sun.params, 'scale', 0.1, 3.0, 0.05).name('Stellar Visual Scale').onChange(() => {
    onGUIParameterChange();
    const star = (isComparisonMode && activeFocusedStar) ? activeFocusedStar : sun;
    controls.minDistance = 140.0 * star.params.scale;
  });
  fDynamics.add(sun.params, 'rotationSpeed', 0.0, 0.1, 0.001).name('Rotational Speed').onChange(onGUIParameterChange);
  fDynamics.add(sun.params, 'oblateness', 0.5, 1.0, 0.01).name('Polar Oblateness').onChange(onGUIParameterChange);
  fDynamics.add(sun.params, 'pulseAmplitude', 0.0, 0.2, 0.005).name('Pulsation Amplitude').onChange(onGUIParameterChange);
  fDynamics.add(sun.params, 'pulseFrequency', 0.0, 2.0, 0.05).name('Pulsation Frequency').onChange(onGUIParameterChange);
  fDynamics.close();

  // Minimizing Control Panel toggle
  const controlPanel = document.getElementById('control-panel');
  const toggleBtn = document.getElementById('toggle-panel');
  toggleBtn.addEventListener('click', () => {
    const collapsed = controlPanel.classList.toggle('collapsed');
    toggleBtn.textContent = collapsed ? '+' : '—';
    toggleBtn.setAttribute('aria-expanded', String(!collapsed));
  });
}

// Comparison Mode Functions
function enterComparisonMode() {
  isComparisonMode = true;
  sun.group.visible = false;
  
  // Backup main sun's parameters to prevent mutation leaks
  mainSunParamsBackup = {};
  sun.copyParams(sun.params, mainSunParamsBackup);
  mainSunPresetBackup = sun.currentPresetName;
  mainSunHUDBackup = {
    textContent: hudStarClass.textContent,
    className: hudStarClass.className
  };

  // Disable scale slider — updateComparisonLayout enforces a fixed scale per star
  // (visualScaleDefault for log mode, params.radius for linear), so dragging the
  // scale would be immediately overwritten. Lock the control to communicate that.
  if (scaleController) scaleController.disable();
  
  // Set camera limits and far plane for huge Universe Sandbox scales
  controls.maxDistance = 20000000.0;
  camera.far = 30000000.0;
  camera.updateProjectionMatrix();
  
  // Hide preset select active states
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  syncAriaPressed();

  // Show comparison panels and cinematic flyby button
  document.getElementById('comparison-focus-panel').style.display = 'flex';
  document.getElementById('comparison-scale-toggle-container').style.display = 'flex';
  document.getElementById('btn-cinematic-flyby').style.display = 'block';
  
  const compBtn = document.getElementById('btn-comparison-mode');
  compBtn.textContent = 'EXIT COMPARISON MODE';
  compBtn.style.background = 'rgba(255, 56, 56, 0.15)';
  compBtn.style.borderColor = 'rgba(255, 56, 56, 0.4)';
  compBtn.style.color = '#ff3838';
  // Use .active so syncAriaPressed() picks it up. Without this, any later
  // syncAriaPressed() call would read .active=false and overwrite the manual
  // aria-pressed back to false.
  compBtn.classList.add('active');
  syncAriaPressed();

  if (!comparisonGroup) {
    comparisonGroup = new THREE.Group();
    scene.add(comparisonGroup);

    const lineupData = [
      { name: "Sirius B", query: "SIRIUSB" },
      { name: "Proxima Centauri", query: "PROXIMA" },
      { name: "Sun (Sol)", query: "SUN" },
      { name: "Sirius A", query: "SIRIUS" },
      { name: "Vega", query: "VEGA" },
      { name: "Arcturus", query: "ARCTURUS" },
      { name: "Aldebaran", query: "ALDEBARAN" },
      { name: "Rigel", query: "RIGEL" },
      { name: "Deneb", query: "DENEB" },
      { name: "Antares", query: "ANTARES" },
      { name: "Betelgeuse", query: "BETELGEUSE" },
      { name: "UY Scuti", query: "UYSCUTI" }
    ];

    lineupData.forEach(data => {
      const star = new Sun(comparisonGroup);
      const starSettings = lookupHYGStar(data.query);
      if (starSettings) {
        star.setPreset(starSettings);
      }
      star.displayName = data.name;
      star.visualScaleDefault = star.params.scale;
      comparisonStars.push(star);
    });
  }
  comparisonGroup.visible = true;

  // Populate focus target buttons dynamically
  const focusGrid = document.getElementById('comparison-focus-grid');
  if (focusGrid) {
    focusGrid.innerHTML = '';
    comparisonStars.forEach((star, index) => {
      const btn = document.createElement('button');
      btn.className = 'nav-btn focus-star-btn';
      btn.setAttribute('data-index', index);
      btn.setAttribute('aria-pressed', 'false');

      // Clean up display names for HUD grid buttons
      let nameText = star.displayName.replace('(Sol)', '').replace('Centauri', '').trim().toUpperCase();
      btn.textContent = nameText;
      
      btn.addEventListener('click', () => {
        focusOnComparisonStar(index);
      });
      focusGrid.appendChild(btn);
    });
  }
  
  // Create and show comparison labels
  const labelsContainer = document.getElementById('comparison-labels-container');
  if (labelsContainer) {
    labelsContainer.innerHTML = '';
    comparisonStars.forEach((star, index) => {
      const labelDiv = document.createElement('div');
      labelDiv.className = 'star-label-3d';
      labelDiv.id = `star-label-${index}`;
      
      // Card elements styled with a line pointing down
      labelDiv.innerHTML = `
        <div class="label-card">
          <div class="label-name">${star.displayName}</div>
          <div class="label-details">${star.params.radius} R☉</div>
        </div>
        <div class="label-glow-line"></div>
      `;
      labelDiv.addEventListener('click', () => {
        focusOnComparisonStar(index);
      });
      labelsContainer.appendChild(labelDiv);
    });
    labelsContainer.style.display = 'block';
  }

  // Default focus on Sol (index 2 in lineup)
  focusOnComparisonStar(2);
  updateComparisonLayout();
}

function exitComparisonMode() {
  // Stop cinematic flyby if running
  if (isCinematicMode) {
    stopCinematicFlyby();
  }

  isComparisonMode = false;
  
  // Restore main sun's parameters and re-apply them to clear visual leaks
  if (mainSunParamsBackup) {
    sun.copyParams(mainSunParamsBackup, sun.params);
    if (mainSunPresetBackup) {
      sun.currentPresetName = mainSunPresetBackup;
    }
    sun.applyCurrentParams();
  }

  // Restore camera defaults
  controls.maxDistance = 150000.0;
  camera.far = 500000.0;
  camera.updateProjectionMatrix();

  if (comparisonGroup) {
    comparisonGroup.visible = false;
  }

  sun.group.visible = true;

  // Restore the preset button matching whatever was active before entering comparison.
  // Custom/catalog stars (currentPresetName === 'custom') have no preset button — leave
  // all unhighlighted in that case, matching the state from the custom-class flow.
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  const restoredBtn = document.querySelector(`.preset-btn[data-preset="${sun.currentPresetName}"]`);
  if (restoredBtn) restoredBtn.classList.add('active');
  syncAriaPressed();
  
  // Hide comparison panels
  document.getElementById('comparison-focus-panel').style.display = 'none';
  document.getElementById('comparison-scale-toggle-container').style.display = 'none';
  document.getElementById('btn-cinematic-flyby').style.display = 'none';
  
  // Hide and empty labels container
  const labelsContainer = document.getElementById('comparison-labels-container');
  if (labelsContainer) {
    labelsContainer.innerHTML = '';
    labelsContainer.style.display = 'none';
  }
  
  const compBtn = document.getElementById('btn-comparison-mode');
  compBtn.textContent = 'ENTER COMPARISON MODE';
  compBtn.style.background = 'rgba(0, 255, 128, 0.1)';
  compBtn.style.borderColor = 'rgba(0, 255, 128, 0.4)';
  compBtn.style.color = '#00ff80';
  compBtn.classList.remove('active');
  syncAriaPressed();

  // Fly camera back to center
  isFlying = true;
  flightTargetLookAt.set(0, 0, 0);
  flightTargetPos.set(0, 180 * sun.params.scale, 550 * sun.params.scale);

  // Restore HUD label snapshot taken on enter (matches whatever the user had active —
  // standard preset text, custom MK input, or HYG catalog name)
  if (mainSunHUDBackup) {
    hudStarClass.textContent = mainSunHUDBackup.textContent;
    hudStarClass.className = mainSunHUDBackup.className;
  }

  // Re-enable the scale slider — it was disabled on enter because the comparison
  // layout overrides per-star scale.
  if (scaleController) scaleController.enable();

  // Reset focus button active states
  document.querySelectorAll('.focus-star-btn').forEach(b => b.classList.remove('active'));
  syncAriaPressed();

  updateGUIDisplay();
  updatePhysicalHUD();
}

// Map a star's parsed spectral class to a CSS class on the HUD star-class readout.
// Source of truth is star.params.specClass (exposed by parseMKClassification and
// preserved through HYG overrides). Replaces fragile displayName.includes() chains.
//
// Class buckets:
//   O, B           -> 'blue-super'    (hot, blue main-sequence and supergiants)
//   A, F, D*       -> 'white-dwarf'   (A/F main-sequence appear white; D = degenerate WDs)
//   G              -> 'yellow-dwarf'  (Sun-like)
//   K, M           -> 'red-giant'     (cool stars and most named red giants)
//
// NOTE: bucketing A/F into 'white-dwarf' is a CSS naming legacy from the existing
// stylesheet — they are NOT actual white dwarfs. Revisit if the design system grows
// dedicated 'white-main-sequence' or per-class accents.
function applyHUDClassForStar(star) {
  hudStarClass.className = 'reading-value';
  const specClass = star && star.params ? star.params.specClass : null;
  if (!specClass) return;
  if (specClass === 'O' || specClass === 'B') {
    hudStarClass.classList.add('blue-super');
  } else if (specClass === 'A' || specClass === 'F' || specClass.startsWith('D')) {
    hudStarClass.classList.add('white-dwarf');
  } else if (specClass === 'G') {
    hudStarClass.classList.add('yellow-dwarf');
  } else if (specClass === 'K' || specClass === 'M') {
    hudStarClass.classList.add('red-giant');
  }
}

function focusOnComparisonStar(index) {
  if (!isComparisonMode || index < 0 || index >= comparisonStars.length) return;

  const star = comparisonStars[index];
  activeFocusedStar = star;

  // Copy star's parameters to sun.params so GUI matches it.
  // Preserve lensFlaresEnabled across the copy: it represents a global user preference
  // (the GUI checkbox is the master switch in comparison mode), not per-star state.
  // Without this guard, toggling flares OFF while focused on star A and then focusing
  // star B silently re-enables them because B's params still hold the default `true`.
  const preservedFlareEnabled = sun.params.lensFlaresEnabled;
  sun.copyParams(star.params, sun.params);
  sun.params.lensFlaresEnabled = preservedFlareEnabled;

  // Highlight active button in focus panel
  const focusButtons = document.querySelectorAll('.focus-star-btn');
  focusButtons.forEach((btn, i) => {
    if (i === index) btn.classList.add('active');
    else btn.classList.remove('active');
  });
  syncAriaPressed();

  // Trigger camera flight to new target star
  isFlying = true;
  const starX = star.group.position.x;
  const starScale = star.params.scale;
  
  flightTargetLookAt.set(starX, 0, 0);
  flightTargetPos.set(starX, 180 * starScale, 550 * starScale);

  // Update HUD telemetry title class code (from spectral classification, not name)
  applyHUDClassForStar(star);
  hudStarClass.textContent = star.displayName;

  updateGUIDisplay();
  updatePhysicalHUD();
  updateComparisonLensFlares();
}

function updateComparisonLayout() {
  if (!isComparisonMode) return;

  comparisonBasePositions = [];

  if (comparisonScaleMode === 'visual') {
    let accumulatedX = 0;
    comparisonStars.forEach((star, index) => {
      if (star.visualScaleDefault !== undefined) {
        star.params.scale = star.visualScaleDefault;
      } else {
        const defaults = star.getPresetDefaultSettings(star.currentPresetName);
        star.params.scale = defaults.scale;
      }
      star.applyCurrentParams();

      const renderingRadius = 100.0 * star.params.scale;
      if (index > 0) {
        const prevStar = comparisonStars[index - 1];
        const prevRadius = 100.0 * prevStar.params.scale;
        
        // Very tight gaps to replicate the educational poster (approx 8% of combined radii + tiny offset)
        const gap = (prevRadius + renderingRadius) * 0.08 + 20.0;
        accumulatedX += prevRadius + renderingRadius + gap;
      }
      if (!isCinematicMode) {
        star.group.position.set(accumulatedX, 0, 0);
      }
      comparisonBasePositions.push(accumulatedX);
    });
  } else {
    // Linear scale mode based on actual radius to prevent overlap
    let accumulatedX = 0;
    comparisonStars.forEach((star, index) => {
      star.params.scale = star.params.radius;
      star.applyCurrentParams();

      const renderingRadius = 100.0 * star.params.scale;
      if (index > 0) {
        const prevStar = comparisonStars[index - 1];
        const prevRadius = 100.0 * prevStar.params.scale;
        
        // Proportional spacing based on sizes of the two stars
        const gap = (prevRadius + renderingRadius) * 1.5 + 200.0;
        accumulatedX += prevRadius + renderingRadius + gap;
      }
      if (!isCinematicMode) {
        star.group.position.set(accumulatedX, 0, 0);
      }
      comparisonBasePositions.push(accumulatedX);
    });
  }

  // Adjust controls and camera flight target dynamically
  if (activeFocusedStar) {
    const starX = activeFocusedStar.group.position.x;
    const starScale = activeFocusedStar.params.scale;
    controls.minDistance = 140.0 * starScale;
    
    if (isFlying) {
      flightTargetLookAt.set(starX, 0, 0);
      // Retarget flight to correct Y/Z depending on new scale
      const distType = document.querySelector('.nav-btn[data-distance].active')?.getAttribute('data-distance') || 'orbit';
      if (distType === 'far') {
        flightTargetPos.set(starX, 2500 * starScale, 9000 * starScale);
      } else if (distType === 'orbit') {
        flightTargetPos.set(starX, 180 * starScale, 550 * starScale);
      } else if (distType === 'close') {
        flightTargetPos.set(starX, 35 * starScale, 145 * starScale);
      }
    } else {
      // If not flying, shift OrbitControls target to new X coordinate immediately
      controls.target.x = starX;
    }
  }
}

function updateComparisonLensFlares() {
  // Visibility-only update: only the focused star shows flares, and only if the user
  // has flares enabled globally. We do NOT mutate per-star params.lensFlaresEnabled
  // (preserves the toggle as user intent) and do NOT call updateLensFlares (avoids
  // teardown/rebuild of 3 CanvasTextures per star on every focus change — known
  // perf bottleneck flagged in CONCERNS.md). Tradeoff: all 12 stars keep their
  // ~3MB texture set loaded in comparison mode (~36MB total) vs. instant focus changes.
  comparisonStars.forEach(star => {
    if (!star.flareGroup) return;
    const isFocused = (star === activeFocusedStar);
    star.flareGroup.visible = isFocused && sun.params.lensFlaresEnabled;
  });
}

// 3D HTML Labels Overlay Positioning
const tempV = new THREE.Vector3();
function updateHTML3DLabels() {
  const container = document.getElementById('comparison-labels-container');
  if (!container) return;

  if (!isComparisonMode) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';

  comparisonStars.forEach((star, index) => {
    const labelDiv = document.getElementById(`star-label-${index}`);
    if (!labelDiv) return;

    // Get 3D position of the star
    tempV.copy(star.group.position);
    
    // Position label just above the physical surface (plus margin)
    const offsetHeight = 110 * star.params.scale;
    tempV.y += offsetHeight;

    // Check if behind camera in camera space
    tempV.applyMatrix4(camera.matrixWorldInverse);
    if (tempV.z > 0) {
      labelDiv.classList.remove('visible');
      return;
    }

    // Project 3D vector to screen-space coordinates
    tempV.applyMatrix4(camera.projectionMatrix);

    // Map screen-space coords (-1 to +1) to CSS pixels (0 to width/height)
    const x = (tempV.x * 0.5 + 0.5) * window.innerWidth;
    const y = (tempV.y * -0.5 + 0.5) * window.innerHeight;

    labelDiv.style.left = `${x}px`;
    labelDiv.style.top = `${y}px`;
    labelDiv.classList.add('visible');

    // Highlight active focused star's label card
    if (star === activeFocusedStar) {
      labelDiv.classList.add('active-focus');
    } else {
      labelDiv.classList.remove('active-focus');
    }
  });
}

// Cinematic Flyby System
function startCinematicFlyby() {
  if (!isComparisonMode) return;

  isCinematicMode = true;
  cinematicTime = 0;
  isFlying = false;
  controls.enabled = false; // Prevent user input from breaking the cinematic tracks

  // Ensure layout and base positions are calculated correctly for the active mode
  updateComparisonLayout();

  const flyBtn = document.getElementById('btn-cinematic-flyby');
  if (flyBtn) {
    flyBtn.innerHTML = '🛑 STOP CINEMATIC FLYBY';
    flyBtn.style.borderColor = 'rgba(255, 56, 56, 0.4)';
    flyBtn.style.background = 'rgba(255, 56, 56, 0.08)';
    flyBtn.style.color = '#ff3838';
  }
}

function stopCinematicFlyby() {
  isCinematicMode = false;
  isFlying = false;
  controls.enabled = true; // Restore orbit/pan/zoom control to the user

  const flyBtn = document.getElementById('btn-cinematic-flyby');
  if (flyBtn) {
    flyBtn.innerHTML = '🎬 START CINEMATIC FLYBY';
    flyBtn.style.borderColor = 'rgba(0, 191, 255, 0.4)';
    flyBtn.style.background = 'rgba(0, 191, 255, 0.08)';
    flyBtn.style.color = '#00bfff';
  }

  // Restore camera target to Sol
  focusOnComparisonStar(2);
}

function updateCinematicCamera(elapsedTime, delta) {
  if (comparisonBasePositions.length === 0) return;

  const pos0 = comparisonBasePositions[0]; // Sirius B
  const pos2 = comparisonBasePositions[2]; // Sol
  const lastIndex = comparisonBasePositions.length - 1;
  const posLast = comparisonBasePositions[lastIndex]; // Betelgeuse (last star)

  const aspect = window.innerWidth / window.innerHeight;
  const fovRad = (camera.fov * Math.PI) / 180;
  const tanHalfFOV = Math.tan(fovRad / 2);
  const effectiveTan = aspect < 1.0 ? tanHalfFOV * aspect : tanHalfFOV;

  // Take 1: Stellar Assembly Pan (0.0s - 7.0s)
  if (cinematicTime < 7.0) {
    const t = cinematicTime / 7.0;
    const ease = t * t * (3 - 2 * t);
    
    // Starts close to Sirius B's runway, slowly pulls back and pans to Sol
    const startCam = new THREE.Vector3(pos0 - 200, 80, 450);
    const endCam = new THREE.Vector3(pos2 + 1000, 1500, 4000);
    
    camera.position.lerpVectors(startCam, endCam, ease);
    controls.target.set(THREE.MathUtils.lerp(pos0, pos2 + 800, ease), 0, 0);
  }
  // Take 2: David & Goliath Eclipse / Transit (7.0s - 16.0s)
  else if (cinematicTime < 16.0) {
    // Focus camera directly in front of Betelgeuse (last star), looking straight down the X-axis
    const lastStar = comparisonStars[lastIndex];
    const R_giant = 100.0 * lastStar.params.scale;
    const D_giant = R_giant / (0.9 * effectiveTan);
    
    camera.position.set(posLast - D_giant, 0, 0);
    controls.target.set(posLast, 0, 0);
  }
  // Take 3: Supersonic Photosphere Canyon Flight (16.0s - 27.0s)
  else if (cinematicTime < 27.0) {
    const t = (cinematicTime - 16.0) / 11.0;
    const ease = t * t * (3 - 2 * t);

    // Fly camera down the lineup line (X axis) starting from Sirius B to Betelgeuse (last star)
    const currentX = THREE.MathUtils.lerp(pos0, posLast, ease);
    
    // Find the nearest star to scale flyby height dynamically based on photosphere size
    let nearestStar = comparisonStars[0];
    let minDist = Infinity;
    comparisonStars.forEach(s => {
      const dist = Math.abs(s.group.position.x - currentX);
      if (dist < minDist) {
        minDist = dist;
        nearestStar = s;
      }
    });
    
    const scale = nearestStar.params.scale;
    const height = scale * 120.0;
    const depth = scale * 260.0;

    // Ship wobble to convey raw speed
    const wobbleY = Math.sin(cinematicTime * 3.5) * scale * 20.0;
    const wobbleZ = Math.cos(cinematicTime * 3.5) * scale * 20.0;

    camera.position.set(currentX - depth * 0.1, height + wobbleY, depth + wobbleZ);
    controls.target.set(currentX + 500 * scale, 0, 0);
  }
  // Take 4: Cosmic Landscape Pullback (27.0s - 38.0s)
  else if (cinematicTime < 38.0) {
    const t = (cinematicTime - 27.0) / 11.0;
    const ease = t * t * (3 - 2 * t);

    // Dynamic pullback distance to fit the entire alignment (pos0 to posLast) inside the viewport width
    const totalWidth = posLast - pos0;
    const targetZ = (totalWidth / 2) / (0.85 * effectiveTan * aspect);
    const midX = posLast / 2;

    const startCam = new THREE.Vector3(posLast, posLast * 0.15, posLast * 0.5);
    const endCam = new THREE.Vector3(midX, targetZ * 0.03, targetZ);
    
    camera.position.lerpVectors(startCam, endCam, ease);
    controls.target.set(midX, 0, 0);
  }
  else {
    stopCinematicFlyby();
  }
}

// Cockpit HUD interactive button triggers
function setupHUDBindings() {
  const presetButtons = document.querySelectorAll('.preset-btn');
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.getAttribute('data-preset');

      if (isComparisonMode) {
        exitComparisonMode();
      }

      // If we clicked the already active preset, reset it to default!
      if (sun.currentPresetName === preset) {
        sun.resetCurrentPresetToDefault();
      } else {
        sun.setPreset(preset);
      }

      // Toggle active styling states
      presetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      syncAriaPressed();

      // Scale minimum camera zoom distance to match the star's boundaries
      controls.minDistance = 140.0 * sun.params.scale;
      
      // Update GUI sliders immediately to reflect preset values
      updateGUIDisplay();

      // Update HUD telemetry visuals based on stellar class
      hudStarClass.className = 'reading-value'; // Reset
      if (preset === 'sol') {
        hudStarClass.textContent = 'G2V (Sol)';
        hudStarClass.classList.add('yellow-dwarf');
      } else if (preset === 'redgiant') {
        hudStarClass.textContent = 'M5III (Red Giant)';
        hudStarClass.classList.add('red-giant');
      } else if (preset === 'bluesuper') {
        hudStarClass.textContent = 'O5I (Blue Super)';
        hudStarClass.classList.add('blue-super');
      } else if (preset === 'whitedwarf') {
        hudStarClass.textContent = 'DA2 (White Dwarf)';
        hudStarClass.classList.add('white-dwarf');
      }

      // Update the physical parameters HUD panel
      updatePhysicalHUD();
    });
  });

  // Autopilot flight triggers
  const navButtons = document.querySelectorAll('.nav-btn[data-distance]');
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      syncAriaPressed();

      const distType = btn.getAttribute('data-distance');
      isFlying = true;

      // Position target vector based on zoom options (dynamically scaled to current star size)
      const activeStar = (isComparisonMode && activeFocusedStar) ? activeFocusedStar : sun;
      const currentScale = activeStar.params.scale;
      const starX = activeStar.group.position.x;

      flightTargetLookAt.set(starX, 0, 0);

      if (distType === 'far') {
        flightTargetPos.set(starX, 2500 * currentScale, 9000 * currentScale); // Systemic view (Far)
      } else if (distType === 'orbit') {
        flightTargetPos.set(starX, 180 * currentScale, 550 * currentScale); // Stable Orbit
      } else if (distType === 'close') {
        flightTargetPos.set(starX, 35 * currentScale, 145 * currentScale); // Surface probe view
      }
    });
  });

  // Comparison Mode Event Listeners
  const compModeBtn = document.getElementById('btn-comparison-mode');
  if (compModeBtn) {
    compModeBtn.addEventListener('click', () => {
      if (isComparisonMode) {
        exitComparisonMode();
      } else {
        enterComparisonMode();
      }
    });
  }

  const scaleVisualBtn = document.getElementById('btn-scale-visual');
  const scaleRealBtn = document.getElementById('btn-scale-real');
  if (scaleVisualBtn && scaleRealBtn) {
    scaleVisualBtn.addEventListener('click', () => {
      scaleVisualBtn.classList.add('active');
      scaleRealBtn.classList.remove('active');
      syncAriaPressed();
      comparisonScaleMode = 'visual';
      updateComparisonLayout();
      updateComparisonLensFlares();
    });

    scaleRealBtn.addEventListener('click', () => {
      scaleRealBtn.classList.add('active');
      scaleVisualBtn.classList.remove('active');
      syncAriaPressed();
      comparisonScaleMode = 'real';
      updateComparisonLayout();
      updateComparisonLensFlares();
    });
  }

  const flybyBtn = document.getElementById('btn-cinematic-flyby');
  if (flybyBtn) {
    flybyBtn.addEventListener('click', () => {
      if (isCinematicMode) {
        stopCinematicFlyby();
      } else {
        startCinematicFlyby();
      }
    });
  }

  // Custom class generation trigger
  const customInput = document.getElementById('input-custom-class');
  const customBtn = document.getElementById('btn-apply-custom-class');
  
  function applyCustomClass() {
    const rawVal = customInput.value.trim();
    if (!rawVal) return;

    if (isComparisonMode) {
      exitComparisonMode();
    }
    
    // 1. First attempt to search by famous star name in the HYG Database
    let settings = lookupHYGStar(rawVal);
    let isHYG = true;
    
    // 2. If not found in database, fallback to raw Morgan-Keenan spectral parser
    if (!settings) {
      settings = parseMKClassification(rawVal);
      isHYG = false;
    }
    
    if (!settings) {
      // Flash input border red for invalid input feedback
      customInput.style.borderColor = '#ff3838';
      setTimeout(() => {
        customInput.style.borderColor = 'rgba(255, 255, 255, 0.15)';
      }, 1000);
      return;
    }
    
    // Clear preset button active states
    presetButtons.forEach(b => b.classList.remove('active'));
    syncAriaPressed();

    // Apply parsed settings to the Sun procedurally
    sun.setPreset(settings);
    
    // Scale minimum camera zoom distance to match the star's boundaries
    controls.minDistance = 140.0 * sun.params.scale;
    
    // Refresh GUI sliders
    updateGUIDisplay();
    
    // Update HUD telemetry visuals based on parsed spectral class (always present on
    // both HYG lookups and raw MK parses since parseMKClassification exposes it)
    applyHUDClassForStar(sun);
    const cleanStr = rawVal.toUpperCase().replace(/\s+/g, '');
    hudStarClass.textContent = isHYG ? settings.displayName : cleanStr;

    // Update the physical parameters HUD panel
    updatePhysicalHUD();
  }
  
  if (customBtn && customInput) {
    customBtn.addEventListener('click', applyCustomClass);
    customInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        applyCustomClass();
      }
    });
  }

  // Prevent UI interaction events from propagating to the WebGL canvas (prevents camera movement while dragging controls)
  const hud = document.getElementById('space-hud');
  const labels = document.getElementById('comparison-labels-container');
  const guiContainer = document.getElementById('gui-container');

  [hud, labels, guiContainer].forEach(el => {
    if (el) {
      ['pointerdown', 'mousedown', 'touchstart', 'dblclick'].forEach(evt => {
        el.addEventListener(evt, (e) => e.stopPropagation());
      });
    }
  });
}

function updateGUIDisplay() {
  const star = (isComparisonMode && activeFocusedStar) ? activeFocusedStar : sun;
  if (sun && star && sun !== star) {
    // Mirror the focused star's params into sun.params so the GUI rendering
    // (which binds to sun.params) reflects whichever star is in focus. Preserve
    // lensFlaresEnabled — see focusOnComparisonStar for why this is global, not
    // per-star. Without this guard, refocusing silently re-enables flares the
    // user just turned off.
    const preservedFlareEnabled = sun.params.lensFlaresEnabled;
    sun.copyParams(star.params, sun.params);
    sun.params.lensFlaresEnabled = preservedFlareEnabled;
  }

  if (guiColorProxies && sun && sun.params) {
    const maxVal = Math.max(sun.params.colorGrading.x, sun.params.colorGrading.y, sun.params.colorGrading.z);
    const scale = maxVal > 0.0 ? maxVal : 1.0;
    
    const starCol = new THREE.Color(
      sun.params.colorGrading.x / scale,
      sun.params.colorGrading.y / scale,
      sun.params.colorGrading.z / scale
    );
    guiColorProxies.starColor = '#' + starCol.getHexString();

    if (sun.params.plageColorGrading) {
      const plageCol = new THREE.Color(
        sun.params.plageColorGrading.x,
        sun.params.plageColorGrading.y,
        sun.params.plageColorGrading.z
      );
      guiColorProxies.plageColor = '#' + plageCol.getHexString();
    }
  }

  if (gui) {
    gui.folders.forEach(folder => {
      folder.controllers.forEach(controller => {
        controller.updateDisplay();
      });
    });
  }
}

// Resolve bloom envelope targets for the current frame. Reads isComparisonMode
// from module scope to pick between the dramatic single-star ceiling and the
// throttled comparison-mode ceiling (prevents additive corona overlap from
// blowing out the composite when multiple stars stack in screen space).
function getBloomTargets(dNorm) {
  const farStrength = isComparisonMode ? BLOOM_COMPARISON_FAR_STRENGTH : BLOOM_SINGLE_FAR_STRENGTH;
  const farThreshold = isComparisonMode ? BLOOM_COMPARISON_FAR_THRESHOLD : BLOOM_SINGLE_FAR_THRESHOLD;
  return {
    strength: THREE.MathUtils.lerp(BLOOM_NEAR_STRENGTH, farStrength, dNorm),
    threshold: THREE.MathUtils.lerp(BLOOM_NEAR_THRESHOLD, farThreshold, dNorm)
  };
}

// Dynamic camera auto-exposure system (mimics eyes adapting to sunlight)
function updateAutoExposure(distance) {
  const star = (isComparisonMode && activeFocusedStar) ? activeFocusedStar : sun;
  if (!star || !star.params) return;

  const scale = star.params.scale;
  const minBound = 140.0 * scale;
  const maxBound = 6000.0 * scale;

  // Normalize distance
  const dNorm = THREE.MathUtils.clamp((distance - minBound) / (maxBound - minBound || 1.0), 0.0, 1.0);

  // Sane exposure bounds to prevent washing out solar surface details
  const targetExposure = THREE.MathUtils.lerp(0.6, 1.0, dNorm);
  renderer.toneMappingExposure = THREE.MathUtils.lerp(renderer.toneMappingExposure, targetExposure, 0.08);

  if (bloomPass) {
    if (usePostProcessing) {
      const { strength: targetBloomStrength, threshold: targetBloomThreshold } = getBloomTargets(dNorm);
      bloomPass.strength = THREE.MathUtils.lerp(bloomPass.strength, targetBloomStrength, 0.08);
      bloomPass.threshold = THREE.MathUtils.lerp(bloomPass.threshold, targetBloomThreshold, 0.08);
    } else {
      bloomPass.strength = 0.0;
    }
  }

  // Runtime visibility culling: hide flares when camera is very close (giant sprites would
  // dominate the viewport). User preference (params.lensFlaresEnabled, toggled via GUI) is
  // the ceiling; proximity can only hide, never re-enable against the user's wish.
  // Uses flareGroup.visible (cheap) instead of mutating params + recreating textures
  // (expensive, and would clobber the user's preference on the next zoom-in/zoom-out cycle).
  const flareThreshold = 170.0 * scale;
  if (star.flareGroup) {
    const tooClose = distance < flareThreshold;
    star.flareGroup.visible = star.params.lensFlaresEnabled && !tooClose;
  }
}

// telemetry calculations & updates
function updateTelemetry(distance, delta) {
  const star = (isComparisonMode && activeFocusedStar) ? activeFocusedStar : sun;
  if (!star || !star.params) return;

  // Distance in astronomical units. Note: in visual-scale comparison mode the
  // scene-unit-to-AU mapping is no longer physical (stars are spaced for
  // didactic clarity, not to scale), so the AU readout is a visual analog
  // rather than a real measurement.
  const distanceAU = Math.max(1e-6, distance / SCENE_UNITS_PER_AU);
  valDistance.textContent = `${distanceAU.toFixed(3)} AU`;

  // Kepler-Newton circular orbital velocity: v = sqrt(G*M / r).
  // Normalized to Earth: 29.78 km/s at 1 AU around 1 M☉.
  // Mass matters — a hypothetical probe orbiting a 25 M☉ star at 1 AU would
  // be moving at 29.78 * sqrt(25) ~= 149 km/s, not 29.78 km/s.
  const starMass = star.params.mass !== undefined ? star.params.mass : 1.0;
  const currentSpeed = EARTH_ORBITAL_VELOCITY_KMS * Math.sqrt(starMass / distanceAU);
  valVelocity.textContent = `${currentSpeed.toFixed(2)} km/s`;

  // Sensor equilibrium temperature for a probe at distance d from a star
  // with luminosity L (in L☉). Stefan-Boltzmann + radiative balance:
  // T = T_earth * L^0.25 / sqrt(d_AU), where T_earth = 278 K bakes in
  // Earth-like albedo (~0.3) and unit emissivity. At very small d this
  // approximation breaks down (you'd be inside the star) — clamping AU
  // above prevents division by zero but the number isn't physically
  // meaningful below ~stellar radius.
  const starLum = star.params.lum !== undefined ? star.params.lum : 1.0;
  const sensorTemp = EARTH_EQUILIBRIUM_TEMP_K * Math.pow(starLum, 0.25) / Math.sqrt(distanceAU);
  valTemperature.textContent = `${Math.floor(sensorTemp).toLocaleString()} K`;
}

// Update static physical properties in telemetry HUD panel
function updatePhysicalHUD() {
  const star = (isComparisonMode && activeFocusedStar) ? activeFocusedStar : sun;
  if (!star || !star.params) return;
  const massVal = star.params.mass !== undefined ? star.params.mass : 1.0;
  const radiusVal = star.params.radius !== undefined ? star.params.radius : 1.0;
  const lumVal = star.params.lum !== undefined ? star.params.lum : 1.0;
  const vRotVal = star.params.vRot !== undefined ? star.params.vRot : 2.0;

  valMass.textContent = `${massVal.toFixed(2)} M☉`;
  valRadius.textContent = `${radiusVal.toFixed(2)} R☉`;
  valLuminosity.textContent = `${lumVal.toLocaleString()} L☉`;
  valRotationVelocity.textContent = `${vRotVal.toFixed(1)} km/s`;
}

// Core Loop
function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  // Clamp to absorb tab-unsuspend gaps so a 5-second backgrounded gap doesn't
  // fast-forward shader animation by 5 seconds.
  const simDelta = Math.min(delta, 0.1) * timeSpeed;
  simTime += simDelta;
  const elapsed = simTime;

  // 1. Process flight autopilot or cinematic camera
  if (isCinematicMode) {
    cinematicTime += delta;
    updateCinematicCamera(elapsed, delta);
  } else if (isFlying) {
    // Frame-rate independent exponential decay: at delta = 1/60s, lerpFactor == flightSpeed
    // exactly (same feel as the old 60-FPS-tuned constant). Clamp delta to avoid huge
    // catch-up jumps when the tab was backgrounded.
    const clampedDelta = Math.min(delta, 0.1);
    const lerpFactor = 1.0 - Math.pow(1.0 - flightSpeed, clampedDelta * 60.0);
    camera.position.lerp(flightTargetPos, lerpFactor);
    controls.target.lerp(flightTargetLookAt, lerpFactor);
    
    // Stop flight when camera is close to target, dynamically scaled to avoid floating point precision lockups
    const activeStar = (isComparisonMode && activeFocusedStar) ? activeFocusedStar : sun;
    const currentScale = activeStar ? activeStar.params.scale : 1.0;
    const stopThreshold = Math.max(1.0, 0.5 * currentScale);
    if (camera.position.distanceTo(flightTargetPos) < stopThreshold) {
      isFlying = false;
    }
  }

  controls.update();

  // Move starfield centered on camera to prevent clipping/leaving background shell
  if (starfield) {
    starfield.position.copy(camera.position);
  }

  // 2. Perform camera distance analysis relative to the active focused star
  const activeStar = (isComparisonMode && activeFocusedStar) ? activeFocusedStar : sun;
  const cameraDistance = activeStar ? camera.position.distanceTo(activeStar.group.position) : camera.position.length();
  
  // 3. Dynamic Auto-Exposure & Telemetry Updates
  updateAutoExposure(cameraDistance);
  
  const elapsedUnscaled = clock.getElapsedTime();
  if (elapsedUnscaled - lastTelemetryUpdateTime > 0.1) {
    updateTelemetry(cameraDistance, delta);
    lastTelemetryUpdateTime = elapsedUnscaled;
  }

  // 4. Update Custom Shaders time inputs and interpolate positions
  if (isComparisonMode) {
    if (comparisonBasePositions.length === comparisonStars.length) {
      const aspect = window.innerWidth / window.innerHeight;
      const fovRad = (camera.fov * Math.PI) / 180;
      const tanHalfFOV = Math.tan(fovRad / 2);
      const effectiveTan = aspect < 1.0 ? tanHalfFOV * aspect : tanHalfFOV;

      comparisonStars.forEach((star, index) => {
        let targetX = comparisonBasePositions[index];
        let targetY = 0;
        let targetZ = 0;

        if (isCinematicMode) {
          // Dynamic star choreography based on cinematic timeline
          if (cinematicTime < 6.0) {
            // Assembly stage: fly in from the dark Z depths
            const delay = index * 0.7;
            const t = Math.max(0, Math.min(1, (cinematicTime - delay) / 2.0));
            const ease = t * t * (3 - 2 * t);
            const startZ = -120000 * (star.params.radius || 1.0);
            targetZ = THREE.MathUtils.lerp(startZ, 0, ease);
          } else if (cinematicTime >= 7.0 && cinematicTime < 16.0) {
            // Take 2: David & Goliath Eclipse / Transit (7.0s - 16.0s)
            const tTake2 = cinematicTime - 7.0; // range 0 to 9
            const lastIndex = comparisonBasePositions.length - 1;
            const posLast = comparisonBasePositions[lastIndex]; // Betelgeuse X
            const R_giant = 100.0 * comparisonStars[lastIndex].params.scale;
            const D_giant = R_giant / (0.9 * effectiveTan);
            const X_cam = posLast - D_giant;

            // 1. Sirius B (index 0) - fills ~4% vertical screen height
            if (index === 0) {
              const p = Math.max(0, Math.min(1, (tTake2 - 0.0) / 4.0));
              const easeP = p * p * (3 - 2 * p);
              const d = (100.0 * star.params.scale) / (0.04 * effectiveTan);
              targetX = X_cam + d;
              const zLim = d * effectiveTan * aspect * 1.35;
              targetZ = THREE.MathUtils.lerp(-zLim, zLim, easeP);
              targetY = Math.sin(easeP * Math.PI) * d * 0.15;
            }
            // 2. Sol (index 2) - fills ~16% vertical screen height
            else if (index === 2) {
              const p = Math.max(0, Math.min(1, (tTake2 - 2.5) / 4.0));
              const easeP = p * p * (3 - 2 * p);
              const d = (100.0 * star.params.scale) / (0.16 * effectiveTan);
              targetX = X_cam + d;
              const zLim = d * effectiveTan * aspect * 1.35;
              targetZ = THREE.MathUtils.lerp(-zLim, zLim, easeP);
              targetY = -Math.sin(easeP * Math.PI) * d * 0.15;
            }
            // 3. Rigel (index 7) - fills ~42% vertical screen height
            else if (index === 7) {
              const p = Math.max(0, Math.min(1, (tTake2 - 5.0) / 4.0));
              const easeP = p * p * (3 - 2 * p);
              const d = (100.0 * star.params.scale) / (0.42 * effectiveTan);
              targetX = X_cam + d;
              const zLim = d * effectiveTan * aspect * 1.35;
              targetZ = THREE.MathUtils.lerp(-zLim, zLim, easeP);
              targetY = 0;
            }
          }
        }

        // Interpolate position smoothly
        star.group.position.x = THREE.MathUtils.lerp(star.group.position.x, targetX, 0.15);
        star.group.position.y = THREE.MathUtils.lerp(star.group.position.y, targetY, 0.15);
        star.group.position.z = THREE.MathUtils.lerp(star.group.position.z, targetZ, 0.15);
      });
    }

    comparisonStars.forEach(star => {
      star.update(elapsed);
    });
  } else {
    sun.update(elapsed);
  }
  if (starfield) {
    starfield.material.uniforms.uTime.value = elapsed;
  }

  // 5. Update HTML 3D labels positioning
  updateHTML3DLabels();

  // 6. Render
  if (usePostProcessing) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  if (bloomPass) {
    bloomPass.setSize(window.innerWidth / 2, window.innerHeight / 2);
  }
}

// Run app
window.onload = init;
