import * as THREE from 'three';
import { starfieldVertexShader, starfieldFragmentShader } from './shaders.js';

/**
 * Creates a twinkling starfield in deep space.
 * @param {number} numStars Number of star particles to generate.
 * @returns {THREE.Points} The starfield points mesh.
 */
export function createStarfield(numStars = 8000) {
  const geometry = new THREE.BufferGeometry();
  
  const positions = new Float32Array(numStars * 3);
  const sizes = new Float32Array(numStars);
  const phases = new Float32Array(numStars);
  const colors = new Float32Array(numStars * 3);

  // Harmonious star colors (Red Dwarfs, Yellow Dwarfs, Blue Giants)
  const stellarTypes = [
    { weight: 0.55, color: new THREE.Color('#ff7f3f') }, // Red/Orange Dwarf (Cool)
    { weight: 0.30, color: new THREE.Color('#ffffff') }, // Yellow/White Dwarf (Medium)
    { weight: 0.15, color: new THREE.Color('#7fbfff') }  // Blue Giant (Hot)
  ];

  for (let i = 0; i < numStars; i++) {
    // Generate position on a massive shell far from the origin
    const radius = 25000 + Math.random() * 10000; // Far distance shell (25000 - 35000 units)
    
    // Uniform spherical distribution
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);

    // Random size (0.8 to 3.0 units)
    sizes[i] = 0.8 + Math.random() * 2.2;

    // Twinkle phase offset (0 to 2*PI)
    phases[i] = Math.random() * Math.PI * 2;

    // Select color based on probability weight
    const rand = Math.random();
    let selectedColor = stellarTypes[0].color;
    
    if (rand > 1.0 - stellarTypes[2].weight) {
      selectedColor = stellarTypes[2].color; // Blue Giant
    } else if (rand > stellarTypes[0].weight) {
      selectedColor = stellarTypes[1].color; // White/Yellow
    }

    // Add color variation (subtle tinting)
    const color = selectedColor.clone();
    const tint = 0.85 + Math.random() * 0.15;
    color.multiplyScalar(tint);

    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.ShaderMaterial({
    vertexShader: starfieldVertexShader,
    fragmentShader: starfieldFragmentShader,
    uniforms: {
      uTime: { value: 0 }
    },
    transparent: true,
    depthWrite: false, // Prevent particle bounding boxes from clipping stars
    blending: THREE.AdditiveBlending
  });

  return new THREE.Points(geometry, material);
}
