// Custom GLSL 3.0 / WebGL 2 Shaders for Stellar Renderer

// Ashima Arts Simplex 3D Noise (Textureless)
export const simplexNoiseGLSL = `
vec4 permute(vec4 x) {
  return mod(((x*34.0)+1.0)*x, 289.0);
}
vec4 taylorInvSqrt(vec4 r) {
  return 1.79284291400159 - 0.85373472095314 * r;
}
float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  // First corner
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  // Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

  // Permutations
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
       i.z + vec4(0.0, i1.z, i2.z, 1.0))
     + i.y + vec4(0.0, i1.y, i2.y, 1.0))
     + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  // Gradients
  float n_ = 1.0/7.0; // N=7
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  // mod(p,N*N)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);    // mod(j,N)

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  // Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  // Mix final noise value
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

// Blackbody Radiation Color Mapping GLSL Helper
// Maps index i to RGB based on stellar temperature
export const blackbodyGLSL = `
vec3 getBlackbodyColor(float temp) {
  float i = (temp - 800.0) * 0.035068;

  // Red
  float r = 0.0;
  if (i < 60.0) {
    r = i * 4.25;
  } else if (i < 236.0) {
    r = 255.0;
  } else if (i < 288.0) {
    r = 255.0 + (i - 236.0) * -2.442;
  } else if (i < 377.0) {
    r = 128.0 + (i - 288.0) * -0.764;
  } else if (i < 511.0) {
    r = 60.0 + (i - 377.0) * -0.4477;
  }

  // Green
  float g = 0.0;
  if (i >= 60.0 && i < 103.0) {
    g = (i - 60.0) * 2.3255;
  } else if (i >= 103.0 && i < 133.0) {
    g = 100.0 + (i - 103.0) * 4.433;
  } else if (i >= 133.0 && i < 174.0) {
    g = 233.0 + (i - 133.0) * 0.53658;
  } else if (i >= 174.0 && i < 236.0) {
    g = 255.0;
  } else if (i >= 236.0 && i < 286.0) {
    g = 255.0 + (i - 236.0) * -1.24;
  } else if (i >= 286.0 && i < 367.0) {
    g = 193.0 + (i - 286.0) * -0.7901;
  } else if (i >= 367.0 && i < 511.0) {
    g = 129.0 + (i - 367.0) * -0.45138;
  } else if (i >= 511.0) {
    g = 64.0 + (i - 511.0) * -0.06237;
  }

  // Blue
  float b = 0.0;
  if (i >= 103.0 && i < 133.0) {
    b = (i - 103.0) * 7.0333;
  } else if (i >= 133.0 && i < 173.0) {
    b = 211.0 + (i - 133.0) * 0.9;
  } else if (i >= 173.0 && i < 231.0) {
    b = 247.0 + (i - 173.0) * 0.1379;
  } else if (i >= 231.0) {
    b = 255.0;
  }

  return vec3(clamp(r / 255.0, 0.0, 1.0), clamp(g / 255.0, 0.0, 1.0), clamp(b / 255.0, 0.0, 1.0));
}
`;

// Value Noise 3D & Warped FBM (Optimized to 3-octaves for 60+ FPS)
export const valueNoiseGLSL = `
float hash(vec2 uv) {
  return fract(sin(dot(uv, vec2(127.5, 315.10))) * 45148.43);
}

float noise3D(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f*f*(3.0 - 2.0*f);

  float n000 = hash(vec2(hash(i.xy), i.z));
  float n001 = hash(vec2(hash(i.xy + vec2(0.0, 1.0)), i.z));
  float n010 = hash(vec2(hash(i.xy + vec2(1.0, 1.0)), i.z));
  float n011 = hash(vec2(hash(i.xy + vec2(1.0, 0.0)), i.z));
  float n100 = hash(vec2(hash(i.xy), i.z + 1.0));
  float n101 = hash(vec2(hash(i.xy + vec2(0.0, 1.0)), i.z + 1.0));
  float n110 = hash(vec2(hash(i.xy + vec2(1.0, 1.0)), i.z + 1.0));
  float n111 = hash(vec2(hash(i.xy + vec2(1.0, 0.0)), i.z + 1.0));

  float x1 = mix(n000, n011, u.x);
  float x2 = mix(n001, n010, u.x);
  float y1 = mix(x1, x2, u.y);

  float x3 = mix(n100, n111, u.x);
  float x4 = mix(n101, n110, u.x);
  float y2 = mix(x3, x4, u.y);

  return mix(y1, y2, u.z);
}

float fbm3D(vec3 p) {
  float value = 0.0, amp = 0.5, freq = 2.0;
  for (int i = 0; i < 3; i++) {
    value += amp * noise3D(p * freq);
    freq *= 2.0; amp *= 0.5;
  }
  return value;
}

float warpedFbm3D(vec3 p) {
  vec3 q = vec3(fbm3D(p),
                fbm3D(p + vec3(5.2, 1.3, 2.1)),
                fbm3D(p + vec3(2.8, 4.1, 1.7)));
  return fbm3D(p + 3.0 * q);
}
`;

// 1. Solar Surface (Core) Shaders
export const surfaceVertexShader = `
varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  vPosition = position;
  vNormal = normalize(normalMatrix * normal);

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewDir = normalize(-mvPosition.xyz);

  gl_Position = projectionMatrix * mvPosition;
}
`;

export const surfaceFragmentShader = `
uniform float uTime;
uniform float uNoiseScale;
uniform float uConvectionSpeed;
uniform float uSunspotThreshold;
uniform float uPlageIntensity;
uniform vec3 uColorGrading;
uniform float uLimbExponent;
uniform float uLimbBase;
uniform vec3 uPlageGrading;

varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vViewDir;

${valueNoiseGLSL}

void main() {
  float tOffset = uTime * uConvectionSpeed;
  vec3 sphereCoord = normalize(vPosition) * uNoiseScale;
  // 3-pass warped FBM layers to simulate convective flows
  float top_noiseLayer    = warpedFbm3D(sphereCoord * 5.0  + tOffset * 0.08);
  float middle_noiseLayer = warpedFbm3D(sphereCoord * 10.0 + tOffset * 0.1);
  float lower_noiseLayer  = warpedFbm3D(sphereCoord * 20.0 + tOffset * 0.12);

  float pattern = top_noiseLayer * 0.8
                + middle_noiseLayer * 0.5
                + lower_noiseLayer * 0.1;

  // 7-color interpolation palette matching the user's Shadertoy reference
  vec3 color1 = vec3(1.000, 0.400, 0.000);
  vec3 color2 = vec3(0.2, 0.02, 0.0);
  vec3 color3 = vec3(0.5, 0.08, 0.0);
  vec3 color4 = vec3(0.8, 0.2, 0.0);
  vec3 color5 = vec3(1.0, 0.5, 0.05);
  vec3 color6 = vec3(1.0, 0.8, 0.3);
  vec3 color7 = vec3(1.0, 0.95, 0.7);

  vec3 spotColor = vec3(0.12, 0.02, 0.01);
  vec3 plageColor = vec3(0.55, 0.35, 0.15);

  // Swizzle colors if uColorGrading is blue-dominant (e.g. for Blue Supergiant or White Dwarf)
  if (uColorGrading.z > uColorGrading.x * 1.05) {
      color1 = color1.bgr;
      color2 = color2.bgr;
      color3 = color3.bgr;
      color4 = color4.bgr;
      color5 = color5.bgr;
      color6 = color6.bgr;
      color7 = color7.bgr;
      spotColor = spotColor.bgr;
      plageColor = plageColor.bgr;
  }

  vec3 sunBaseColor = vec3(0.0);
  float t = clamp(pattern, 0.0, 1.0);
  
  if (t < 0.15) {
      sunBaseColor = mix(color1, color2, t / 0.15);
  } else if (t < 0.3) {
      sunBaseColor = mix(color2, color3, (t - 0.15) / 0.15);
  } else if (t < 0.45) {
      sunBaseColor = mix(color3, color4, (t - 0.3) / 0.15);
  } else if (t < 0.6) {
      sunBaseColor = mix(color4, color5, (t - 0.45) / 0.15);
  } else if (t < 0.75) {
      sunBaseColor = mix(color5, color6, (t - 0.6) / 0.15);
  } else if (t < 0.9) {
      sunBaseColor = mix(color6, color7, (t - 0.75) / 0.15);
  } else {
      sunBaseColor = mix(color7, color6, (t - 0.9) / 0.1);
  }

  // Active magnetic solar features using fast value-noise FBM
  vec3 spotPos = sphereCoord * 3.5 + vec3(0.0, 0.0, tOffset * 0.3);
  float spotNoiseVal = fbm3D(spotPos) * 2.8 - (2.4 - uSunspotThreshold);
  float sunspots = clamp(spotNoiseVal, 0.0, 1.0);

  vec3 plagePos = sphereCoord * 5.0 + vec3(tOffset * 0.35, tOffset * 0.35, 0.0);
  float plageNoiseVal = fbm3D(plagePos) * 1.5 - (1.1 - uPlageIntensity);
  float plages = clamp(plageNoiseVal, 0.0, 1.0);

  // Apply sunspots
  if (sunspots > 0.6) {
      sunBaseColor *= mix(1.0, 0.08, (sunspots - 0.6) / 0.4);
  } else if (sunspots > 0.0) {
      sunBaseColor = mix(sunBaseColor, spotColor, sunspots / 0.6);
  }

  // Apply plages (magnetic hot spots) with stellar-class color offsets
  if (plages > 0.0) {
      sunBaseColor += plageColor * plages * uPlageGrading;
  }

  // Apply stellar class color grading vector
  vec3 finalColor = sunBaseColor * uColorGrading;

  // Physics-based limb darkening model (keeps edge luminous and volumetric)
  float mu = clamp(dot(vNormal, vViewDir), 0.0, 1.0);
  float limbDarkening = uLimbBase + (1.0 - uLimbBase) * pow(mu, uLimbExponent);
  finalColor *= limbDarkening;

  gl_FragColor = vec4(finalColor, 1.0);
}
`;

// 2. Prominences & Flares (3D Vertex Displacement Shell)
export const prominenceVertexShader = `
uniform float uTime;
uniform float uProminenceSpeed;
uniform float uProminenceHeight;
uniform float uNoiseScale;
uniform float uPolarJetIntensity;

varying vec3 vLocalPosition;
varying float vDisplacement;
varying vec3 vNormal;
varying float vPolarFactor;

${simplexNoiseGLSL}

void main() {
  vNormal = normalize(normalMatrix * normal);
  vLocalPosition = position;

  // Calculate 3D vertex offset along normals
  float tOffset = uTime * uProminenceSpeed;
  vec3 noisePos = position * (uNoiseScale * 0.85) + vec3(0.0, tOffset, 0.0);
  
  // Multi-layered noise for prominences
  float n1 = snoise(noisePos * 0.6);
  float n2 = snoise(noisePos * 1.5) * 0.4;
  float totalNoise = max(0.0, (n1 + n2));
  
  // Square noise to make arches narrower and spikes more defined
  float disp = pow(totalNoise, 2.0) * uProminenceHeight;

  // Polar jets: ionized columns of gas shooting from the poles
  vec3 normalDir = normalize(position);
  float polarFactor = smoothstep(0.70, 0.95, abs(normalDir.y)); // Start at latitude 70
  
  // Animate the jet vertically
  float jetNoise = snoise(vec3(position.x * 3.0, position.y * 0.5 - tOffset * 2.5, position.z * 3.0));
  float jetHeight = (12.0 + 8.0 * jetNoise) * uPolarJetIntensity * uProminenceHeight * 0.08;
  vec3 jetOffset = vec3(0.0, sign(position.y), 0.0) * polarFactor * jetHeight;

  vDisplacement = disp + length(jetOffset);
  vPolarFactor = polarFactor;

  vec3 displacedPosition = position + normal * disp + jetOffset;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
}
`;

export const prominenceFragmentShader = `
uniform float uTime;
uniform float uProminenceSpeed;
uniform float uProminenceHeight;
uniform float uBaseTemp;
uniform float uEdgeFade;
uniform vec3 uColorGrading;
uniform float uPolarJetIntensity;

varying vec3 vLocalPosition;
varying float vDisplacement;
varying vec3 vNormal;
varying float vPolarFactor;

${simplexNoiseGLSL}
${blackbodyGLSL}

void main() {
  float tOffset = uTime * uProminenceSpeed;
  
  // Ridged noise in fragment shader to trace thin plasma loops
  vec3 loopPos = vLocalPosition * 2.8 + vec3(0.0, tOffset * 1.5, 0.0);
  float nVal = snoise(loopPos);
  
  // absolute value noise generates ridges/loops
  float loops = 1.0 - abs(nVal);
  
  // Sharp thresholding for filament structures
  float loopAlpha = smoothstep(0.45, 0.72, loops);

  // Fade out opacity at the peak of the prominence
  // Use ascending edges + invert: GLSL ES spec leaves edge0 >= edge1 undefined
  float heightFade = 1.0 - smoothstep(0.0, max(0.0001, uProminenceHeight * 1.5), vDisplacement);
  
  // Edge opacity falloff (Fades out when looking straight-on, highlighting prominences on solar limb)
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  float edgeGlow = 1.0 - clamp(dot(vNormal, viewDir), 0.0, 1.0);
  float edgeOpacity = pow(edgeGlow, uEdgeFade);

  // Blend prominence loops with polar jet columns
  // Use ascending edges + invert: GLSL ES spec leaves edge0 >= edge1 undefined
  float jetAlpha = (1.0 - smoothstep(0.0, 1.2, heightFade)) * 0.85;
  float alphaBlend = mix(loopAlpha * heightFade, jetAlpha, vPolarFactor * clamp(uPolarJetIntensity, 0.0, 1.0));
  float finalAlpha = alphaBlend * edgeOpacity;
  
  // Discard fragments below a minimum alpha threshold
  if (finalAlpha < 0.02) discard;

  // Temperature based coloring: hotter at core base, cooler at loops peak
  float localTemp = mix(uBaseTemp * 0.7, uBaseTemp * 1.1, heightFade);
  vec3 baseColor = getBlackbodyColor(localTemp) * uColorGrading * 1.8; // Emissive boost

  // Make polar jets glow with higher electric-blue temperature
  vec3 jetColor = getBlackbodyColor(uBaseTemp * 1.5) * vec3(0.85, 0.95, 1.3) * 2.2;
  vec3 finalColor = mix(baseColor, jetColor, vPolarFactor * clamp(uPolarJetIntensity, 0.0, 1.0));

  gl_FragColor = vec4(finalColor, finalAlpha);
}
`;

// 3. Volumetric Corona Glow Shaders
export const coronaVertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;

  // Camera facing billboard matrix transformation with scale preservation
  vec3 cameraSpaceCenter = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float scaleX = length(modelViewMatrix[0].xyz);
  float scaleY = length(modelViewMatrix[1].xyz);
  vec3 cameraSpacePos = cameraSpaceCenter + vec3(position.x * scaleX, position.y * scaleY, 0.0);

  gl_Position = projectionMatrix * vec4(cameraSpacePos, 1.0);
}
`;

export const coronaFragmentShader = `
uniform float uTemp;
uniform float uTime;
uniform float uCoronaSpeed;
uniform float uCoronaDensity;
uniform vec3 uColorGrading;

varying vec2 vUv;

${simplexNoiseGLSL}
${blackbodyGLSL}

void main() {
  // Use UV coordinates for high-precision circular discard
  float uvDist = length(vUv - vec2(0.5));
  
  // Cut off strictly at circular boundary to prevent square edges
  if (uvDist > 0.5) {
    discard;
  }

  // Scale distance from 0.0 (center) to 1.0 (outer boundary)
  float scaleDist = uvDist / 0.5;
  
  // Opaque core sphere is at radius = 100.0, billboard radius is 240.0.
  // Core surface is at 100.0 / 240.0 = 0.416.
  float coreScaleDist = 0.416;

  if (scaleDist < coreScaleDist) {
    discard; // Discard inside the solar core
  }

  // Fade smoothly from 1.0 at the core surface to 0.0 at the outer billboard edge
  float fade = clamp((1.0 - scaleDist) / (1.0 - coreScaleDist), 0.0, 1.0);
  fade = pow(fade, 3.0); // Volumetric decay curve

  // Direction vector (offset from center of the UV plane)
  vec2 diff = vUv - vec2(0.5);
  float diffLen = length(diff);
  vec2 dirVec = diffLen > 0.0001 ? diff / diffLen : vec2(1.0, 0.0);

  // Wispy solar wind streamers (magnetic lines along equator/poles)
  float polarAlignment = abs(dirVec.y) + 0.2 * abs(dirVec.x);
  float streamerMask = abs(0.015 / (polarAlignment + 0.04)) * 2.2;

  // Animated noise scrolling outwards
  float tOffset = uTime * uCoronaSpeed;
  vec3 noisePos = vec3(dirVec * 3.2 - vec2(tOffset), tOffset * 0.5);
  float coronaTurbulence = snoise(noisePos) * 0.4 + snoise(noisePos * 2.5) * 0.15;
  
  float totalStrength = fade * (1.0 + streamerMask * (0.8 + coronaTurbulence)) * uCoronaDensity;
  
  if (totalStrength < 0.01) discard;

  // Star spectrum color graded
  vec3 starColor = getBlackbodyColor(uTemp) * uColorGrading;
  
  // Volumetric glow
  vec3 finalColor = starColor * totalStrength * 1.5;

  gl_FragColor = vec4(finalColor, totalStrength);
}
`;

// 4. Twinkling Starfield Shaders
export const starfieldVertexShader = `
attribute float aSize;
attribute vec3 aColor;
attribute float aPhase;

uniform float uTime;

varying vec3 vColor;
varying float vPhase;

void main() {
  vColor = aColor;
  vPhase = aPhase;
  
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Size attenuation with true camera distance, not just forward depth.
  // The starfield is recentered on the camera each frame, so all stars sit
  // on a ~25-35k shell and should appear roughly the same size. Using
  // -mvPosition.z made side-horizon stars (where z approaches 0) blow up to
  // ~500000x their attribute size. length(mvPosition.xyz) keeps the size
  // angular and the explicit clamp caps any remaining edge case.
  float dist = length(mvPosition.xyz);
  gl_PointSize = clamp(aSize * (50000.0 / max(dist, 100.0)), 1.0, 100.0);
}
`;

export const starfieldFragmentShader = `
uniform float uTime;

varying vec3 vColor;
varying float vPhase;

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);

  // Exponential glow decay (gives a bright core and soft atmospheric halo)
  float glow = exp(-8.0 * dist);

  // Twinkle with varied frequency per star for a more natural night sky.
  // Clamp to [0, 1]: the raw expression 0.35 + 0.65*sin dips to -0.30 on
  // half the cycle, which used to produce negative RGB/alpha (silently
  // clamped by WebGL). Explicit max(0) preserves the same "fully dark
  // trough" visual as before but without relying on undefined behavior.
  float freq = 1.0 + 1.2 * fract(vPhase * 13.27);
  float twinkle = max(0.0, 0.35 + 0.65 * sin(uTime * freq + vPhase));
  
  // Cutoff at particle borders to prevent square edge artifacts
  // Use ascending edges + invert: GLSL ES spec leaves edge0 >= edge1 undefined
  glow *= 1.0 - smoothstep(0.2, 0.5, dist);
  
  if (glow < 0.01) discard;

  gl_FragColor = vec4(vColor * twinkle * 1.5, glow * twinkle);
}
`;
