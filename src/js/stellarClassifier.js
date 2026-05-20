import * as THREE from 'three';

// Kelvin to RGB color grading approximation
export function kelvinToColorGrading(temp) {
  let r, g, b;
  const t = temp / 100.0;
  
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    if (t <= 19) {
      b = 0;
    } else {
      b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    }
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  
  // Create Vector3 and clamp values
  const v = new THREE.Vector3(
    Math.max(0.1, Math.min(255, r)) / 255.0,
    Math.max(0.1, Math.min(255, g)) / 255.0,
    Math.max(0.1, Math.min(255, b)) / 255.0
  );
  
  // For extremely cool stars (M-class / Red Giants / Cool Supergiants)
  if (temp < 4000.0) {
    const factor = Math.max(0.0, (temp - 2000.0) / 2000.0); // 0.0 at 2000K, 1.0 at 4000K
    v.y = Math.min(v.y, 0.38 + 0.35 * factor); // Cap green channel
    v.z = Math.min(v.z, 0.08 + 0.30 * factor); // Cap blue channel
    v.x = 1.35 - 0.10 * factor; // Boost red channel
  }
  
  // Normalize and boost brightness slightly
  const maxVal = Math.max(v.x, Math.max(v.y, v.z));
  v.multiplyScalar(1.25 / maxVal);
  return v;
}

/**
 * Parses Morgan-Keenan spectral classification string (e.g. "G2V", "O5I", "M5III", "DA2")
 * and returns full procedural star parameter configurations.
 */
export function parseMKClassification(spectralString) {
  // Normalize input string (remove whitespace and uppercase)
  const cleanStr = spectralString.trim().toUpperCase().replace(/\s+/g, '');
  
  // Regex to extract:
  // 1. Spectral class: O, B, A, F, G, K, M, or white dwarfs DA, DB, DC, DQ, DX
  // 2. Subclass digit: 0-9 (optional, default to 5 if missing)
  // 3. Luminosity Class: Ia, Ib, I, II, III, IV, V, VI, VII (optional, default to V)
  const regex = /^([OBAFGKM]|D[ABCOQXY])([0-9]?)(I[AB]|I{1,3}|IV|V|VI|VII)?$/;
  const match = cleanStr.match(regex);
  
  if (!match) return null;
  
  const specClass = match[1];
  const subclass = match[2] !== '' ? parseInt(match[2], 10) : 5;
  let lumClass = match[3] || 'V';
  
  // If it is a white dwarf prefix like "DA", set luminosity class to VII (White dwarf)
  if (specClass.startsWith('D')) {
    lumClass = 'VII';
  }
  
  // 1. Calculate base temperature based on spectral class and subclass
  let baseTemp = 5800;
  if (specClass === 'O') {
    // 30,000K to 50,000K
    baseTemp = 50000 - (subclass * 2000);
  } else if (specClass === 'B') {
    // 10,000K to 30,000K
    baseTemp = 30000 - (subclass * 2000);
  } else if (specClass === 'A') {
    // 7,500K to 10,000K
    baseTemp = 10000 - (subclass * 250);
  } else if (specClass === 'F') {
    // 6,000K to 7,500K
    baseTemp = 7500 - (subclass * 150);
  } else if (specClass === 'G') {
    // 5,200K to 6,000K
    baseTemp = 6000 - (subclass * 80);
  } else if (specClass === 'K') {
    // 3,700K to 5,200K
    baseTemp = 5200 - (subclass * 150);
  } else if (specClass === 'M') {
    // 2,400K to 3,700K
    baseTemp = 3700 - (subclass * 130);
  } else if (specClass.startsWith('D')) {
    // White dwarfs: 6,000K to 25,000K
    baseTemp = 25000 - (subclass * 1900);
  }
  
  // Sane bounds
  baseTemp = Math.max(2000.0, Math.min(50000.0, baseTemp));
  
  // 2. Generate Color Grading based on physical blackbody temperature
  const colorGrading = kelvinToColorGrading(baseTemp);

  // 3. Estimate Physical Statistics for catalog stars based on Morgan-Keenan spectral classification
  let mass = 1.0;
  if (specClass === 'O') mass = 80 - subclass * 5;
  else if (specClass === 'B') mass = 16 - subclass * 1.3;
  else if (specClass === 'A') mass = 2.1 - subclass * 0.07;
  else if (specClass === 'F') mass = 1.4 - subclass * 0.036;
  else if (specClass === 'G') mass = 1.04 - subclass * 0.024;
  else if (specClass === 'K') mass = 0.8 - subclass * 0.035;
  else if (specClass === 'M') mass = 0.45 - subclass * 0.037;
  else if (specClass.startsWith('D')) mass = 0.6;
  mass = Math.max(0.08, mass);

  // Apply mass scaling factor for giants and supergiants
  if (lumClass.startsWith('I')) {
    mass = Math.max(20.0, mass * 2.0); // Supergiants are highly massive
  } else if (lumClass === 'III') {
    mass = Math.max(1.5, mass * 1.2); // Giants
  }

  // Calculate Luminosity based on mass-luminosity relation (L = M^3.5)
  let starLum = Math.pow(mass, 3.5);
  if (lumClass.startsWith('I')) {
    starLum = Math.max(15000.0, Math.pow(mass, 3.8) * 15.0);
  } else if (lumClass === 'III') {
    starLum = Math.max(50.0, Math.pow(mass, 3.5) * 5.0);
  } else if (lumClass === 'VII' || specClass.startsWith('D')) {
    starLum = 0.001; // Extremely dim white dwarfs
  }

  // Calculate Radius using Stefan-Boltzmann: R = sqrt(L) / (T / 5778)^2
  let radius = Math.sqrt(starLum) / Math.pow(baseTemp / 5778.0, 2);
  radius = Math.max(0.008, radius);

  // Estimate Rotational Velocity (v sin i) in km/s
  let vRot = 2.0;
  if (lumClass === 'VII' || specClass.startsWith('D')) {
    vRot = 20.0;
  } else if (lumClass.startsWith('I')) {
    vRot = (specClass === 'O' || specClass === 'B') ? 45.0 : 5.0;
  } else if (lumClass === 'III') {
    vRot = 12.0;
  } else {
    // Main sequence
    if (specClass === 'O' || specClass === 'B') vRot = 180.0 - subclass * 10;
    else if (specClass === 'A') vRot = 120.0 - subclass * 8;
    else if (specClass === 'F') vRot = 30.0 - subclass * 2;
    else vRot = 4.0 - subclass * 0.2;
  }
  vRot = Math.max(0.1, vRot);
  
  // 4. Configure shader parameters based on size and classification
  let scale = 1.0;
  let convectionSpeed = 0.15;
  let noiseScale = 0.35;
  let sunspotThreshold = 0.65;
  let plageIntensity = 0.65;
  let prominenceHeight = 14.0;
  let prominenceSpeed = 0.08;
  let prominenceBaseTemp = baseTemp * 0.8;
  let prominenceEdgeFade = 4.5;
  let coronaDensity = 0.95;
  let coronaSpeed = 0.1;
  let rotationSpeed = 0.015;
  let oblateness = 1.0;

  // Custom Limb Darkening Coefficients per temperature class
  let limbExponent = 0.6;
  let limbBase = 0.2;
  if (baseTemp < 4000.0) {
    limbExponent = 0.8;
    limbBase = 0.1; // Cool stars have extremely dark limbs
  } else if (baseTemp >= 8000.0) {
    limbExponent = 0.35;
    limbBase = 0.35; // Hot stars are very bright at the edge
  }

  // Multi-tonal Plage (magnetic active regions) color grading offsets
  let plageColorGrading = new THREE.Vector3(1.0, 1.0, 1.0);
  if (baseTemp > 10000.0) {
    plageColorGrading.set(0.9, 1.15, 1.4); // Shift magnetic plages to violet/UV
  } else if (baseTemp < 4000.0) {
    plageColorGrading.set(1.15, 1.05, 0.85); // Shift plages to bright gold/yellow
  }

  // Polar Jets (ionized beams from rotational axes of high-energy objects)
  let polarJetIntensity = 0.0;
  if (specClass === 'O') polarJetIntensity = 0.5;
  else if (specClass === 'B') polarJetIntensity = 0.3;

  // Pulsation parameters (Variable Stars pulsation breath)
  let pulseAmplitude = 0.0;
  let pulseFrequency = 0.0;
  
  // Adjust based on Luminosity Class (Scale, Gravity, Turbulence, Rotation, Pulsation)
  if (lumClass.startsWith('I')) {
    // Supergiants: Massive size, lower surface gravity (slow convective cells, large loops)
    scale = 2.4;
    convectionSpeed = (specClass === 'O' || specClass === 'B') ? 0.45 : 0.06;
    noiseScale = (specClass === 'O' || specClass === 'B') ? 0.22 : 0.65;
    sunspotThreshold = (specClass === 'O' || specClass === 'B') ? 0.05 : 0.35; // Lower = fewer spots (vaporized)
    plageIntensity = (specClass === 'O' || specClass === 'B') ? 1.2 : 0.4;
    
    prominenceHeight = (specClass === 'O' || specClass === 'B') ? 4.5 : 18.0;
    prominenceSpeed = (specClass === 'O' || specClass === 'B') ? 0.25 : 0.04;
    prominenceEdgeFade = (specClass === 'O' || specClass === 'B') ? 8.0 : 4.0;
    
    coronaDensity = (specClass === 'O' || specClass === 'B') ? 0.75 : 1.5;
    coronaSpeed = (specClass === 'O' || specClass === 'B') ? 0.3 : 0.05;
    
    rotationSpeed = (specClass === 'O' || specClass === 'B') ? 0.025 : 0.002;
    oblateness = (specClass === 'O' || specClass === 'B') ? 0.95 : 1.0;

    pulseAmplitude = 0.04; // Supergiants pulsate (breath animation)
    pulseFrequency = 0.35;
  } else if (lumClass === 'III') {
    // Giants: Medium-large size, slower bubbling
    scale = 1.7;
    convectionSpeed = 0.09;
    noiseScale = 0.40;
    sunspotThreshold = (specClass === 'O' || specClass === 'B') ? 0.05 : 0.40;
    plageIntensity = 0.50;
    
    prominenceHeight = 15.0;
    prominenceSpeed = 0.06;
    prominenceEdgeFade = 4.2;
    
    coronaDensity = 1.2;
    coronaSpeed = 0.07;
    
    rotationSpeed = 0.008;
    oblateness = 1.0;

    if (specClass === 'M') {
      pulseAmplitude = 0.05; // Mira/Long-period variables
      pulseFrequency = 0.25;
    }
  } else if (lumClass === 'IV') {
    // Subgiants: Slightly expanded
    scale = 1.3;
    convectionSpeed = 0.12;
    noiseScale = 0.40;
    sunspotThreshold = 0.55;
    rotationSpeed = 0.02;
  } else if (lumClass === 'V') {
    // Dwarfs / Main Sequence: Normal solar values
    scale = 1.0;
    convectionSpeed = (specClass === 'O' || specClass === 'B') ? 0.35 : 0.15;
    noiseScale = (specClass === 'O' || specClass === 'B') ? 0.25 : 0.35;
    sunspotThreshold = (specClass === 'O' || specClass === 'B') ? 0.10 : 0.65;
    plageIntensity = (specClass === 'O' || specClass === 'B') ? 1.0 : 0.65;
    
    prominenceHeight = (specClass === 'O' || specClass === 'B') ? 7.0 : 14.0;
    prominenceSpeed = (specClass === 'O' || specClass === 'B') ? 0.20 : 0.08;
    prominenceEdgeFade = (specClass === 'O' || specClass === 'B') ? 6.5 : 4.5;
    
    rotationSpeed = (specClass === 'O' || specClass === 'B') ? 0.055 : 0.015;
    oblateness = (specClass === 'O' || specClass === 'B') ? 0.90 : 1.0;
    if (specClass === 'A' || specClass === 'F') {
      rotationSpeed = 0.035;
      oblateness = 0.95;
    }
  } else if (lumClass === 'VI') {
    // Subdwarfs: Slightly smaller
    scale = 0.85;
    convectionSpeed = 0.18;
    noiseScale = 0.38;
    rotationSpeed = 0.018;
  } else if (lumClass === 'VII' || specClass.startsWith('D')) {
    // White Dwarfs: Extremely tiny, massive gravity forces (no prominences, no spots, smooth degenerate surface)
    scale = 0.35;
    convectionSpeed = 0.01; // Pristine, stable degenerate gas
    noiseScale = 0.05;      // Smooth surface texture
    sunspotThreshold = -0.5; // Absolutely no spots (corrected threshold formula)
    plageIntensity = 0.0;    // No active magnetic plages
    
    prominenceHeight = 0.0;
    prominenceSpeed = 0.0;
    prominenceEdgeFade = 8.0;
    
    coronaDensity = 0.0;
    coronaSpeed = 0.0;
    
    rotationSpeed = 0.025;
    oblateness = 1.0;
  }
  
  return {
    highTemp: baseTemp * 1.1,
    lowTemp: baseTemp * 0.8,
    convectionSpeed,
    sunspotThreshold,
    plageIntensity,
    noiseScale,
    colorGrading,
    prominenceHeight,
    prominenceSpeed,
    prominenceBaseTemp,
    prominenceEdgeFade,
    coronaDensity,
    coronaSpeed,
    scale,
    rotationSpeed,
    oblateness,
    // Physical statistics
    mass,
    radius,
    lum: starLum,
    vRot,
    // Shader properties
    limbExponent,
    limbBase,
    plageColorGrading,
    polarJetIntensity,
    // Pulsation parameters
    pulseAmplitude,
    pulseFrequency
  };
}

export const HYG_DATABASE = {
  "SUN": { name: "Sun (Sol)", spect: "G2V", temp: 5778, lum: 1.0, mass: 1.0, radius: 1.0, vRot: 2.0 },
  "SOL": { name: "Sun (Sol)", spect: "G2V", temp: 5778, lum: 1.0, mass: 1.0, radius: 1.0, vRot: 2.0 },
  "SIRIUS": { name: "Sirius A", spect: "A1V", temp: 9940, lum: 25.4, mass: 2.06, radius: 1.71, vRot: 16.0 },
  "SIRIUSA": { name: "Sirius A", spect: "A1V", temp: 9940, lum: 25.4, mass: 2.06, radius: 1.71, vRot: 16.0 },
  "SIRIUSB": { name: "Sirius B", spect: "DA2", temp: 25200, lum: 0.026, mass: 1.02, radius: 0.0084, vRot: 10.0 },
  "BETELGEUSE": { name: "Betelgeuse", spect: "M2I", temp: 3500, lum: 126000.0, mass: 17.0, radius: 950.0, vRot: 5.0 },
  "RIGEL": { name: "Rigel", spect: "B8I", temp: 12100, lum: 120000.0, mass: 21.0, radius: 78.0, vRot: 25.0 },
  "VEGA": { name: "Vega", spect: "A0V", temp: 9600, lum: 40.12, mass: 2.135, radius: 2.78, vRot: 274.0 },
  "ALDEBARAN": { name: "Aldebaran", spect: "K5III", temp: 3910, lum: 518.0, mass: 1.16, radius: 44.0, vRot: 5.0 },
  "POLARIS": { name: "Polaris", spect: "F7I", temp: 6000, lum: 1650.0, mass: 5.4, radius: 37.5, vRot: 16.0 },
  "PROXIMA": { name: "Proxima Centauri", spect: "M6V", temp: 3042, lum: 0.0017, mass: 0.122, radius: 0.154, vRot: 2.7 },
  "PROXIMACENTAURI": { name: "Proxima Centauri", spect: "M6V", temp: 3042, lum: 0.0017, mass: 0.122, radius: 0.154, vRot: 2.7 },
  "CANOPUS": { name: "Canopus", spect: "A9II", temp: 7350, lum: 10700.0, mass: 8.0, radius: 71.0, vRot: 8.0 },
  "ARCTURUS": { name: "Arcturus", spect: "K1III", temp: 4290, lum: 170.0, mass: 1.08, radius: 25.4, vRot: 2.4 },
  "ANTARES": { name: "Antares", spect: "M1I", temp: 3660, lum: 75000.0, mass: 12.0, radius: 680.0, vRot: 20.0 },
  "DENEB": { name: "Deneb", spect: "A2I", temp: 8500, lum: 196000.0, mass: 19.0, radius: 200.0, vRot: 20.0 },
  "ALTAIR": { name: "Altair", spect: "A7V", temp: 7700, lum: 10.6, mass: 1.79, radius: 2.03, vRot: 286.0 },
  "UYSCUTI": { name: "UY Scuti", spect: "M4Ia", temp: 3365, lum: 340000.0, mass: 8.0, radius: 1700.0, vRot: 5.0 }
};

export function lookupHYGStar(nameQuery) {
  const query = nameQuery.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const entry = HYG_DATABASE[query];
  if (entry) {
    // Use actual catalog radius relative to the Sun for consistent proportions
    const realRadius = entry.radius;
    
    // Parse the spectral class of this star to get the base parameters
    const params = parseMKClassification(entry.spect);
    if (params) {
      // Compress extreme physical radius to visual scale bounds [0.35, 2.8]
      let visualScale = 1.0;
      if (realRadius > 1.0) {
        visualScale = 1.0 + Math.min(1.6, Math.log10(realRadius) * 0.55);
      } else {
        visualScale = Math.max(0.35, 1.0 - Math.log10(1.0 / realRadius) * 0.3);
      }
      params.scale = visualScale;
      params.displayName = `${entry.name} (${entry.spect})`;
      params.realTemp = entry.temp;
      
      // Override estimated temperatures and color grading with actual catalog values
      params.highTemp = entry.temp * 1.1;
      params.lowTemp = entry.temp * 0.8;
      params.colorGrading = kelvinToColorGrading(entry.temp);
      
      // Load actual catalog values from HYG entry instead of estimations
      params.mass = entry.mass;
      params.radius = entry.radius;
      params.lum = entry.lum;
      params.vRot = entry.vRot;
      
      // Override specific physical characteristics for well-known stars
      if (query === "VEGA") {
        params.oblateness = 0.83; // Vega is extremely oblate due to centrifugal force
        params.rotationSpeed = 0.09;
        params.polarJetIntensity = 0.4;
      } else if (query === "ALTAIR") {
        params.oblateness = 0.84; // Altair rotates in 9 hours and is heavily oblate
        params.rotationSpeed = 0.09;
        params.polarJetIntensity = 0.3;
      } else if (query === "BETELGEUSE" || query === "ANTARES") {
        params.oblateness = 1.0;
        params.rotationSpeed = 0.002; // Very slow rotation for giant stars
      } else if (query === "RIGEL" || query === "DENEB") {
        params.oblateness = 0.95;
        params.rotationSpeed = 0.025;
        params.polarJetIntensity = 0.8;
      }
      
      return params;
    }
  }
  return null;
}
