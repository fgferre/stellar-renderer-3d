import * as THREE from 'three';
import { Lensflare, LensflareElement } from 'three/examples/jsm/objects/Lensflare.js';
import {
  surfaceVertexShader,
  surfaceFragmentShader,
  prominenceVertexShader,
  prominenceFragmentShader,
  coronaVertexShader,
  coronaFragmentShader
} from './shaders.js';

// Procedural Canvas Texture Generators for Lens Flares
function createGlowTexture(colorHex, size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const color = new THREE.Color(colorHex);
  const r = Math.floor(color.r * 255);
  const g = Math.floor(color.g * 255);
  const b = Math.floor(color.b * 255);

  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.12, `rgba(${r}, ${g}, ${b}, 0.8)`);
  grad.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, 0.15)`);
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  return new THREE.CanvasTexture(canvas);
}

function createRingTexture(colorHex, size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const color = new THREE.Color(colorHex);
  const r = Math.floor(color.r * 255);
  const g = Math.floor(color.g * 255);
  const b = Math.floor(color.b * 255);

  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.25)`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.38, 0, Math.PI * 2);
  ctx.stroke();

  // Outer blurry ring
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.08)`;
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.38, 0, Math.PI * 2);
  ctx.stroke();

  return new THREE.CanvasTexture(canvas);
}

function createHexagonTexture(colorHex, size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const color = new THREE.Color(colorHex);
  const rgb = `${Math.floor(color.r * 255)}, ${Math.floor(color.g * 255)}, ${Math.floor(color.b * 255)}`;

  // Draw hexagon
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.4;
  
  ctx.fillStyle = `rgba(${rgb}, 0.18)`;
  ctx.strokeStyle = `rgba(${rgb}, 0.45)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  return new THREE.CanvasTexture(canvas);
}

export class Sun {
  getDefaultParams() {
    return {
      scale: 1.0,
      highTemp: 5800.0,
      lowTemp: 4200.0,
      convectionSpeed: 0.15,
      sunspotThreshold: 0.65,
      plageIntensity: 0.65,
      noiseScale: 0.35,
      colorGrading: new THREE.Vector3(1.15, 0.92, 0.72), // Warm orange-yellow tint for Sol
      
      prominenceHeight: 14.0,
      prominenceSpeed: 0.08,
      prominenceBaseTemp: 4400.0,
      prominenceEdgeFade: 4.5,
      
      coronaDensity: 0.95,
      coronaSpeed: 0.1,
      
      rotationSpeed: 0.015,
      oblateness: 1.0,
      
      limbExponent: 0.6,
      limbBase: 0.2,
      plageColorGrading: new THREE.Vector3(1.0, 1.0, 1.0),
      polarJetIntensity: 0.0,
      pulseAmplitude: 0.0,
      pulseFrequency: 0.0,
      
      lensFlaresEnabled: true
    };
  }

  copyParams(source, target) {
    for (const key in source) {
      if (source[key] instanceof THREE.Vector3) {
        if (target[key] instanceof THREE.Vector3) {
          target[key].copy(source[key]);
        } else {
          target[key] = source[key].clone();
        }
      } else {
        target[key] = source[key];
      }
    }
  }

  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    // Initialize individual preset state slots
    this.presetStates = {
      sol: this.getPresetDefaultSettings('sol'),
      redgiant: this.getPresetDefaultSettings('redgiant'),
      bluesuper: this.getPresetDefaultSettings('bluesuper'),
      whitedwarf: this.getPresetDefaultSettings('whitedwarf'),
      custom: this.getPresetDefaultSettings('sol') // Cache slot for custom classification/catalog stars
    };

    this.currentPresetName = 'sol';

    // Snapshot of the most recently loaded catalog/MK seed (set by setPreset(object)).
    // resetCurrentPresetToDefault uses this when currentPresetName === 'custom' so
    // that Reset restores the user's chosen catalog star, not generic Sol defaults.
    this.customSeed = null;

    // Maintain a single permanent object reference for GUI bindings
    this.params = this.getDefaultParams();
    this.copyParams(this.presetStates['sol'], this.params);

    this.initCore();
    this.initProminences();
    this.initCorona();
    this.initLensFlares();
  }

  // 1. Core Solar Surface Sphere
  initCore() {
    this.coreGeometry = new THREE.SphereGeometry(100.0, 80, 80);
    this.coreMaterial = new THREE.ShaderMaterial({
      vertexShader: surfaceVertexShader,
      fragmentShader: surfaceFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uNoiseScale: { value: this.params.noiseScale },
        uConvectionSpeed: { value: this.params.convectionSpeed },
        uSunspotThreshold: { value: this.params.sunspotThreshold },
        uPlageIntensity: { value: this.params.plageIntensity },
        uColorGrading: { value: this.params.colorGrading },
        uLimbExponent: { value: this.params.limbExponent !== undefined ? this.params.limbExponent : 0.6 },
        uLimbBase: { value: this.params.limbBase !== undefined ? this.params.limbBase : 0.2 },
        uPlageGrading: { value: this.params.plageColorGrading || new THREE.Vector3(1.0, 1.0, 1.0) }
      }
    });

    this.coreMesh = new THREE.Mesh(this.coreGeometry, this.coreMaterial);
    this.group.add(this.coreMesh);
  }

  // 2. High-polygon Prominences Warp Shell
  initProminences() {
    // Subdivided sphere for smooth displacement
    this.promGeometry = new THREE.SphereGeometry(101.0, 140, 140);
    this.promMaterial = new THREE.ShaderMaterial({
      vertexShader: prominenceVertexShader,
      fragmentShader: prominenceFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uProminenceSpeed: { value: this.params.prominenceSpeed },
        uProminenceHeight: { value: this.params.prominenceHeight },
        uNoiseScale: { value: 0.28 },
        uBaseTemp: { value: this.params.prominenceBaseTemp },
        uEdgeFade: { value: this.params.prominenceEdgeFade },
        uColorGrading: { value: this.params.colorGrading },
        uPolarJetIntensity: { value: this.params.polarJetIntensity !== undefined ? this.params.polarJetIntensity : 0.0 }
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    this.promMesh = new THREE.Mesh(this.promGeometry, this.promMaterial);
    this.group.add(this.promMesh);
  }

  // 3. Volumetric Corona Billboard Glow
  initCorona() {
    const coronaSize = 480.0;
    this.coronaGeometry = new THREE.PlaneGeometry(coronaSize, coronaSize);
    this.coronaMaterial = new THREE.ShaderMaterial({
      vertexShader: coronaVertexShader,
      fragmentShader: coronaFragmentShader,
      uniforms: {
        uTemp: { value: this.params.highTemp },
        uTime: { value: 0 },
        uCoronaSpeed: { value: this.params.coronaSpeed },
        uCoronaDensity: { value: this.params.coronaDensity },
        uColorGrading: { value: this.params.colorGrading }
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.coronaMesh = new THREE.Mesh(this.coronaGeometry, this.coronaMaterial);
    this.group.add(this.coronaMesh);
  }

  // 4. Procedural Lens Flare system
  initLensFlares() {
    this.flareGroup = new THREE.Group();
    this.group.add(this.flareGroup);

    this.updateLensFlares();
  }

  updateLensFlares() {
    // Clear existing flare elements
    while (this.flareGroup.children.length > 0) {
      this.flareGroup.remove(this.flareGroup.children[0]);
    }

    // Dispose of previously generated textures to prevent GPU memory leaks
    if (this.currentGlowTexture) this.currentGlowTexture.dispose();
    if (this.currentRingTexture) this.currentRingTexture.dispose();
    if (this.currentHexTexture) this.currentHexTexture.dispose();

    if (!this.params.lensFlaresEnabled) {
      this.currentGlowTexture = null;
      this.currentRingTexture = null;
      this.currentHexTexture = null;
      return;
    }

    // Create flares based on star temperature color
    const starColor = new THREE.Color();
    if (this.params.highTemp > 12000.0) {
      // Blue supergiant / hot stars (crisp blue-white)
      starColor.setHSL(0.58, 0.85, 0.65);
    } else if (this.params.highTemp > 8000.0) {
      // White dwarfs / A-type stars (bright white with light blue hint)
      starColor.setHSL(0.60, 0.2, 0.85);
    } else if (this.params.highTemp < 4000.0) {
      // Red giant / cool stars (deep warm red-orange)
      starColor.setHSL(0.04, 0.95, 0.55);
    } else {
      // Yellow dwarf / Sol / default (exactly the original HSL)
      starColor.setHSL(0.08, 0.9, 0.6);
    }
    const colorHex = '#' + starColor.getHexString();

    this.currentGlowTexture = createGlowTexture(colorHex, 512);
    this.currentRingTexture = createRingTexture(colorHex, 512);
    this.currentHexTexture = createHexagonTexture(colorHex, 128);

    // Primary source glare
    const lensflare = new Lensflare();
    lensflare.addElement(new LensflareElement(this.currentGlowTexture, 700, 0, new THREE.Color(colorHex)));
    lensflare.addElement(new LensflareElement(this.currentRingTexture, 600, 0, new THREE.Color(0.2, 0.1, 0.05)));

    // secondary ghosts along screen vector
    lensflare.addElement(new LensflareElement(this.currentHexTexture, 80, 0.15, new THREE.Color('#ffaa44')));
    lensflare.addElement(new LensflareElement(this.currentHexTexture, 120, 0.25, new THREE.Color('#ff8822')));
    lensflare.addElement(new LensflareElement(this.currentHexTexture, 60, 0.38, new THREE.Color('#ff66ff')));
    lensflare.addElement(new LensflareElement(this.currentGlowTexture, 180, 0.45, new THREE.Color('#ffa502')));
    lensflare.addElement(new LensflareElement(this.currentHexTexture, 140, 0.6, new THREE.Color('#4cd137')));
    lensflare.addElement(new LensflareElement(this.currentHexTexture, 90, 0.72, new THREE.Color('#00a8ff')));
    lensflare.addElement(new LensflareElement(this.currentRingTexture, 280, 0.85, new THREE.Color('#8c7ae6')));
    lensflare.addElement(new LensflareElement(this.currentGlowTexture, 100, 0.95, new THREE.Color('#353b48')));

    this.flareGroup.add(lensflare);
  }

  // Update uniforms in frame render loop
  update(time) {
    // Core surface time
    this.coreMaterial.uniforms.uTime.value = time;

    // Prominences time
    this.promMaterial.uniforms.uTime.value = time;

    // Corona time
    this.coronaMaterial.uniforms.uTime.value = time;

    // Apply rotation on Y axis based on physical rotationSpeed
    const rotSpeed = this.params.rotationSpeed !== undefined ? this.params.rotationSpeed : 0.015;
    this.group.rotation.y = time * rotSpeed;

    // Calculate variable star pulsation (breath)
    let currentScale = this.params.scale;
    let oblateness = this.params.oblateness !== undefined ? this.params.oblateness : 1.0;
    if (this.params.pulseAmplitude > 0.0 && this.params.pulseFrequency > 0.0) {
      // Modulate scale by a slow sine wave
      const breath = 1.0 + this.params.pulseAmplitude * Math.sin(time * this.params.pulseFrequency);
      currentScale *= breath;
    }
    this.group.scale.set(currentScale, currentScale * oblateness, currentScale);

    // Subtle corona breathing
    const pulseScale = 1.0 + 0.02 * Math.sin(time * 0.8);
    this.coronaMesh.scale.set(pulseScale, pulseScale, pulseScale);
  }

  // Get default parameters for a preset
  getPresetDefaultSettings(presetName) {
    let settings = {};
    switch (presetName) {
      case 'sol':
        settings = {
          scale: 1.0,
          highTemp: 5800.0,
          lowTemp: 4400.0,
          convectionSpeed: 0.15,
          sunspotThreshold: 0.65,
          plageIntensity: 0.65,
          noiseScale: 0.35,
          colorGrading: new THREE.Vector3(1.15, 0.92, 0.72),
          prominenceHeight: 14.0,
          prominenceSpeed: 0.08,
          prominenceBaseTemp: 4400.0,
          prominenceEdgeFade: 4.5,
          coronaDensity: 0.95,
          coronaSpeed: 0.1,
          rotationSpeed: 0.015,
          oblateness: 1.0,
          mass: 1.0,
          radius: 1.0,
          lum: 1.0,
          vRot: 2.0
        };
        break;
      case 'redgiant':
        settings = {
          scale: 1.8,
          highTemp: 3200.0,
          lowTemp: 2400.0,
          convectionSpeed: 0.06,
          sunspotThreshold: 0.45,
          plageIntensity: 0.4,
          noiseScale: 0.45,
          colorGrading: new THREE.Vector3(1.35, 0.48, 0.18),
          prominenceHeight: 15.0,
          prominenceSpeed: 0.04,
          prominenceBaseTemp: 2600.0,
          prominenceEdgeFade: 4.2,
          coronaDensity: 1.5,
          coronaSpeed: 0.05,
          rotationSpeed: 0.003,
          oblateness: 1.0,
          mass: 1.2,
          radius: 45.0,
          lum: 150.0,
          vRot: 5.0
        };
        break;
      case 'bluesuper':
        settings = {
          scale: 2.5,
          highTemp: 18000.0,
          lowTemp: 13000.0,
          convectionSpeed: 0.45,
          sunspotThreshold: 0.1,
          plageIntensity: 1.2,
          noiseScale: 0.22,
          colorGrading: new THREE.Vector3(0.7, 0.85, 1.45),
          prominenceHeight: 4.5,
          prominenceSpeed: 0.25,
          prominenceBaseTemp: 10000.0,
          prominenceEdgeFade: 8.0,
          coronaDensity: 0.75,
          coronaSpeed: 0.3,
          rotationSpeed: 0.035,
          oblateness: 0.94,
          polarJetIntensity: 0.4,
          mass: 25.0,
          radius: 80.0,
          lum: 100000.0,
          vRot: 40.0
        };
        break;
      case 'whitedwarf':
        settings = {
          scale: 0.35,
          highTemp: 9800.0,
          lowTemp: 8200.0,
          convectionSpeed: 0.01,
          sunspotThreshold: -0.5,
          plageIntensity: 0.0,
          noiseScale: 0.05,
          colorGrading: new THREE.Vector3(1.0, 1.0, 1.1),
          prominenceHeight: 0.0,
          prominenceSpeed: 0.0,
          prominenceBaseTemp: 8800.0,
          prominenceEdgeFade: 8.0,
          coronaDensity: 0.0,
          coronaSpeed: 0.0,
          rotationSpeed: 0.025,
          oblateness: 1.0,
          mass: 0.6,
          radius: 0.0084,
          lum: 0.001,
          vRot: 20.0
        };
        break;
    }

    const fullParams = this.getDefaultParams();
    Object.assign(fullParams, settings);
    return fullParams;
  }

  // Apply parameters from this.params to materials, meshes, group scale, and flares
  applyCurrentParams() {
    if (this.promMesh) {
      this.promMesh.visible = (this.params.prominenceHeight > 0.0);
    }
    if (this.coronaMesh) {
      this.coronaMesh.visible = (this.params.coronaDensity > 0.0);
    }

    const oblateness = this.params.oblateness !== undefined ? this.params.oblateness : 1.0;
    this.group.scale.set(this.params.scale, this.params.scale * oblateness, this.params.scale);

    this.coreMaterial.uniforms.uNoiseScale.value = this.params.noiseScale;
    this.coreMaterial.uniforms.uConvectionSpeed.value = this.params.convectionSpeed;
    this.coreMaterial.uniforms.uSunspotThreshold.value = this.params.sunspotThreshold;
    this.coreMaterial.uniforms.uPlageIntensity.value = this.params.plageIntensity;
    this.coreMaterial.uniforms.uColorGrading.value = this.params.colorGrading;
    this.coreMaterial.uniforms.uLimbExponent.value = this.params.limbExponent !== undefined ? this.params.limbExponent : 0.6;
    this.coreMaterial.uniforms.uLimbBase.value = this.params.limbBase !== undefined ? this.params.limbBase : 0.2;
    this.coreMaterial.uniforms.uPlageGrading.value = this.params.plageColorGrading || new THREE.Vector3(1.0, 1.0, 1.0);

    this.promMaterial.uniforms.uProminenceSpeed.value = this.params.prominenceSpeed;
    this.promMaterial.uniforms.uProminenceHeight.value = this.params.prominenceHeight;
    this.promMaterial.uniforms.uBaseTemp.value = this.params.prominenceBaseTemp;
    this.promMaterial.uniforms.uEdgeFade.value = this.params.prominenceEdgeFade;
    this.promMaterial.uniforms.uColorGrading.value = this.params.colorGrading;
    this.promMaterial.uniforms.uPolarJetIntensity.value = this.params.polarJetIntensity !== undefined ? this.params.polarJetIntensity : 0.0;

    this.coronaMaterial.uniforms.uTemp.value = this.params.highTemp;
    this.coronaMaterial.uniforms.uCoronaSpeed.value = this.params.coronaSpeed;
    this.coronaMaterial.uniforms.uCoronaDensity.value = this.params.coronaDensity;
    this.coronaMaterial.uniforms.uColorGrading.value = this.params.colorGrading;

    this.updateLensFlares();
  }

  // Reset parameters in the active preset slot back to their preset defaults
  resetCurrentPresetToDefault() {
    let defaults;
    if (this.currentPresetName === 'custom' && this.customSeed) {
      // Catalog/MK custom presets have no case in getPresetDefaultSettings —
      // restore from the seed cached at setPreset(object) time instead.
      defaults = this.customSeed;
    } else {
      defaults = this.getPresetDefaultSettings(this.currentPresetName);
    }
    this.copyParams(defaults, this.params);
    this.applyCurrentParams();
  }

  // Set the current preset slot and apply it
  setPreset(presetNameOrSettings) {
    // 1. Save current state of active preset slot before switching
    if (this.presetStates[this.currentPresetName]) {
      this.copyParams(this.params, this.presetStates[this.currentPresetName]);
    }

    if (typeof presetNameOrSettings === 'object') {
      // Direct custom settings object (transient custom class input from catalog)
      this.currentPresetName = 'custom';

      // Initialize target with defaults to clean up parameter leaks
      const defaults = this.getDefaultParams();
      this.copyParams(defaults, this.params);

      // Merge custom settings
      this.copyParams(presetNameOrSettings, this.params);
      this.applyCurrentParams();

      // Snapshot the resolved seed (defaults + custom merged) so a subsequent
      // Reset returns to this catalog star instead of falling through to Sol.
      this.customSeed = {};
      this.copyParams(this.params, this.customSeed);
    } else {
      const presetName = presetNameOrSettings;
      if (this.presetStates[presetName]) {
        this.currentPresetName = presetName;
        this.copyParams(this.presetStates[presetName], this.params);
        this.applyCurrentParams();
      }
    }
  }
}
