import { describe, it, expect } from 'vitest';
import {
  parseMKClassification,
  kelvinToColorGrading,
  lookupHYGStar,
  HYG_DATABASE
} from '../stellarClassifier.js';

describe('parseMKClassification', () => {
  it('parses a typical main-sequence G-type (Sun)', () => {
    const p = parseMKClassification('G2V');
    expect(p).not.toBeNull();
    expect(p.specClass).toBe('G');
    expect(p.lumClass).toBe('V');
    expect(p.spect).toBe('G2V');
    // Base temp formula: 6000 - subclass*80 = 5840 → highTemp = 5840 * 1.1
    expect(p.highTemp).toBeCloseTo(5840 * 1.1, 1);
    expect(p.scale).toBe(1.0);
  });

  it('parses each main spectral class with sane temperature ordering', () => {
    const classes = ['O', 'B', 'A', 'F', 'G', 'K', 'M'];
    const temps = classes.map(c => parseMKClassification(`${c}5V`).highTemp);
    // Temperature should monotonically decrease from O down to M
    for (let i = 1; i < temps.length; i++) {
      expect(temps[i]).toBeLessThan(temps[i - 1]);
    }
  });

  it('treats supergiants as more massive and luminous than dwarfs of same class', () => {
    const dwarf = parseMKClassification('B5V');
    const sup = parseMKClassification('B5I');
    expect(sup.mass).toBeGreaterThan(dwarf.mass);
    expect(sup.lum).toBeGreaterThan(dwarf.lum);
    expect(sup.scale).toBeGreaterThan(dwarf.scale);
  });

  it('parses white dwarfs (D prefix) with luminosity class VII', () => {
    const wd = parseMKClassification('DA2');
    expect(wd.specClass).toBe('DA');
    expect(wd.lumClass).toBe('VII');
    expect(wd.scale).toBeLessThan(1.0); // White dwarfs are tiny
    expect(wd.coronaDensity).toBe(0.0);
    expect(wd.prominenceHeight).toBe(0.0);
  });

  it('defaults missing subclass to 5 and missing luminosity to V', () => {
    const a = parseMKClassification('G');
    const b = parseMKClassification('G5V');
    expect(a.highTemp).toBeCloseTo(b.highTemp, 1);
    expect(a.lumClass).toBe('V');
  });

  it('normalizes whitespace and case', () => {
    const a = parseMKClassification(' g2v ');
    const b = parseMKClassification('G2V');
    expect(a.highTemp).toBe(b.highTemp);
    expect(a.specClass).toBe(b.specClass);
  });

  it('parses bright giants (II) as between III and I in mass and scale', () => {
    const dwarf = parseMKClassification('A9V');
    const brightGiant = parseMKClassification('A9II');
    const giant = parseMKClassification('A9III');
    const supergiant = parseMKClassification('A9I');
    expect(brightGiant.lumClass).toBe('II');
    expect(brightGiant.mass).toBeGreaterThan(dwarf.mass);
    expect(brightGiant.mass).toBeGreaterThan(giant.mass);
    expect(brightGiant.mass).toBeLessThan(supergiant.mass);
    expect(brightGiant.scale).toBeGreaterThan(giant.scale);
    expect(brightGiant.scale).toBeLessThan(supergiant.scale);
  });

  it('parses Ia and Ib supergiant variants as supergiants', () => {
    const ia = parseMKClassification('M2Ia');
    const ib = parseMKClassification('M2Ib');
    expect(ia.lumClass).toBe('IA');
    expect(ib.lumClass).toBe('IB');
    // Both treated as supergiants for mass scaling
    const dwarf = parseMKClassification('M2V');
    expect(ia.mass).toBeGreaterThan(dwarf.mass);
    expect(ib.mass).toBeGreaterThan(dwarf.mass);
  });

  it('accepts decimal subclass like O9.5V', () => {
    const o9 = parseMKClassification('O9V');
    const o95 = parseMKClassification('O9.5V');
    const o10 = parseMKClassification('O10V'); // not valid, regex floors to single digit
    expect(o95).not.toBeNull();
    expect(o95.specClass).toBe('O');
    expect(o95.spect).toBe('O9.5V');
    // O temperature formula: 50000 - subclass * 2000
    // O9V → 50000 - 18000 = 32000 → highTemp = 32000 * 1.1
    // O9.5V → 50000 - 19000 = 31000 → highTemp = 31000 * 1.1
    expect(o95.highTemp).toBeLessThan(o9.highTemp);
    expect(o95.highTemp).toBeCloseTo(31000 * 1.1, 1);
    expect(o10).toBeNull(); // '10' is two chars — regex expects single digit
  });

  it('returns null for unparseable input', () => {
    expect(parseMKClassification('')).toBeNull();
    expect(parseMKClassification('xyz')).toBeNull();
    expect(parseMKClassification('123')).toBeNull();
    expect(parseMKClassification('Z5V')).toBeNull(); // Z is not a real class
  });

  it('clamps base temperature to sane bounds', () => {
    const o0 = parseMKClassification('O0V'); // formula yields 50000
    expect(o0.highTemp).toBeLessThanOrEqual(50000 * 1.1 + 1);
    const m9 = parseMKClassification('M9V'); // formula yields 3700 - 1170 = 2530 (above 2000 floor)
    expect(m9.highTemp / 1.1).toBeGreaterThanOrEqual(2000);
  });

  it('produces oblate Vega-style A0V with positive rotation', () => {
    const p = parseMKClassification('A0V');
    expect(p.specClass).toBe('A');
    expect(p.rotationSpeed).toBeGreaterThan(0);
  });
});

describe('kelvinToColorGrading', () => {
  it('returns a Vector3-like object with rgb in [0,1] after normalization', () => {
    const v = kelvinToColorGrading(5778); // Sun
    expect(v.x).toBeGreaterThan(0);
    expect(v.y).toBeGreaterThan(0);
    expect(v.z).toBeGreaterThan(0);
    // Brightness boost normalizes max channel to 1.25, so values ≤ 1.25
    const max = Math.max(v.x, v.y, v.z);
    expect(max).toBeCloseTo(1.25, 2);
  });

  it('cool stars (M class) are red-dominant', () => {
    const v = kelvinToColorGrading(3000);
    expect(v.x).toBeGreaterThan(v.y);
    expect(v.x).toBeGreaterThan(v.z);
  });

  it('hot stars (O/B class) are blue-dominant', () => {
    const v = kelvinToColorGrading(25000);
    expect(v.z).toBeGreaterThan(v.x);
  });

  it('applies the cool-star clamp below 4000K', () => {
    const cool = kelvinToColorGrading(2500);
    // Cool clamp caps blue channel to 0.08 + 0.30 * factor (factor = 0.25)
    // Pre-normalization. After multiplyScalar(1.25/maxVal), absolute values shift,
    // but the channel ordering and red-dominance should hold.
    expect(cool.x).toBeGreaterThan(cool.z);
    expect(cool.x).toBeGreaterThan(cool.y);
  });
});

describe('lookupHYGStar', () => {
  it('finds Sun by multiple aliases (case-insensitive)', () => {
    expect(lookupHYGStar('SUN')).not.toBeNull();
    expect(lookupHYGStar('sun')).not.toBeNull();
    expect(lookupHYGStar('Sol')).not.toBeNull();
  });

  it('strips non-alphanumeric characters in queries', () => {
    const a = lookupHYGStar('Proxima Centauri');
    const b = lookupHYGStar('PROXIMACENTAURI');
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a.displayName).toBe(b.displayName);
  });

  it('returns catalog physical values (overrides MK estimates)', () => {
    const vega = lookupHYGStar('VEGA');
    expect(vega.mass).toBe(HYG_DATABASE.VEGA.mass);
    expect(vega.radius).toBe(HYG_DATABASE.VEGA.radius);
    expect(vega.lum).toBe(HYG_DATABASE.VEGA.lum);
    expect(vega.vRot).toBe(HYG_DATABASE.VEGA.vRot);
    expect(vega.displayName).toContain('Vega');
  });

  it('compresses extreme radius to a bounded visual scale [0.35, 2.6]', () => {
    const betelgeuse = lookupHYGStar('BETELGEUSE'); // radius 950
    const proxima = lookupHYGStar('PROXIMA');       // radius 0.154
    expect(betelgeuse.scale).toBeLessThanOrEqual(2.6);
    expect(betelgeuse.scale).toBeGreaterThan(1.0);
    expect(proxima.scale).toBeGreaterThanOrEqual(0.35);
    expect(proxima.scale).toBeLessThan(1.0);
  });

  it('resolves Canopus (A9II bright giant) with catalog values', () => {
    const canopus = lookupHYGStar('CANOPUS');
    expect(canopus).not.toBeNull();
    expect(canopus.lumClass).toBe('II');
    // Catalog overrides ensure the bright-giant procedural defaults don't
    // produce nonsense — final values must match the HYG entry.
    expect(canopus.mass).toBe(HYG_DATABASE.CANOPUS.mass);
    expect(canopus.radius).toBe(HYG_DATABASE.CANOPUS.radius);
    expect(canopus.lum).toBe(HYG_DATABASE.CANOPUS.lum);
  });

  it('applies per-star overrides for Vega oblateness', () => {
    const vega = lookupHYGStar('VEGA');
    expect(vega.oblateness).toBeLessThan(1.0); // Vega is famously oblate
    expect(vega.rotationSpeed).toBeGreaterThan(0.05);
  });

  it('returns null for unknown stars', () => {
    expect(lookupHYGStar('NOTASTAR')).toBeNull();
    expect(lookupHYGStar('')).toBeNull();
  });

  it('synchronizes catalog temp to highTemp / lowTemp / colorGrading', () => {
    const sirius = lookupHYGStar('SIRIUS');
    // highTemp = temp * 1.1, lowTemp = temp * 0.8
    expect(sirius.highTemp).toBeCloseTo(9940 * 1.1, 1);
    expect(sirius.lowTemp).toBeCloseTo(9940 * 0.8, 1);
  });
});
