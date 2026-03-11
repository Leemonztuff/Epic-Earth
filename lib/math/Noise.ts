import { createNoise2D } from 'simplex-noise';

export class Noise {
  // Cache noise instances by seed to avoid recreating them constantly
  private static noiseInstances = new Map<number, ReturnType<typeof createNoise2D>>();

  private static getNoiseInstance(seed: number) {
    if (!this.noiseInstances.has(seed)) {
      // Simple seeded random function for simplex-noise
      let s = seed;
      const random = () => {
        s = Math.sin(s) * 10000;
        return s - Math.floor(s);
      };
      this.noiseInstances.set(seed, createNoise2D(random));
    }
    return this.noiseInstances.get(seed)!;
  }

  static noise2D(x: number, y: number, seed: number = 0): number {
    const noise2D = this.getNoiseInstance(seed);
    // simplex-noise returns [-1, 1], we want [0, 1]
    return (noise2D(x, y) + 1) / 2;
  }

  static fbm(x: number, y: number, octaves: number, seed: number = 0): number {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1;
    let max = 0;
    
    for (let i = 0; i < octaves; i++) {
      value += amplitude * this.noise2D(x * frequency, y * frequency, seed + i * 100);
      max += amplitude;
      frequency *= 2;
      amplitude *= 0.5;
    }
    
    // Normalize back to [0, 1]
    return value / max;
  }
}
