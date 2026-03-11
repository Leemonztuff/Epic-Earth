import { HexGrid } from '../hex/HexGrid';
import { TERRAIN_REGISTRY } from './TerrainRegistry';

export class TerrainResolver {
  static resolve(grid: HexGrid) {
    // First pass: assign base variation using noise
    for (const cell of grid.values()) {
      const terrain = TERRAIN_REGISTRY[cell.terrainCode];
      if (terrain && terrain.variations > 0) {
        // Use value noise for organic clustering
        const noiseVal = this.noise2D(cell.q * 0.15, cell.r * 0.15);
        cell.variation = Math.floor(noiseVal * terrain.variations);
      }
    }

    // Second pass: neighbor smoothing
    const newVariations = new Map<string, number>();
    for (const cell of grid.values()) {
      const terrain = TERRAIN_REGISTRY[cell.terrainCode];
      if (terrain && terrain.variations > 0) {
        let sameTerrainCount = 0;
        const variationCounts = new Map<number, number>();

        for (const neighbor of cell.neighbors) {
          if (neighbor && neighbor.terrainCode === cell.terrainCode) {
            sameTerrainCount++;
            variationCounts.set(neighbor.variation, (variationCounts.get(neighbor.variation) || 0) + 1);
          }
        }

        // If many neighbors match, adopt the most common variation among them
        // to smooth out the clusters
        if (sameTerrainCount >= 3) {
          let mostCommonVar = cell.variation;
          let maxCount = 0;
          for (const [v, count] of variationCounts.entries()) {
            if (count > maxCount) {
              maxCount = count;
              mostCommonVar = v;
            }
          }
          newVariations.set(`${cell.q},${cell.r}`, mostCommonVar);
        } else {
          newVariations.set(`${cell.q},${cell.r}`, cell.variation);
        }
      }
    }

    // Apply smoothed variations
    for (const cell of grid.values()) {
      const smoothed = newVariations.get(`${cell.q},${cell.r}`);
      if (smoothed !== undefined) {
        cell.variation = smoothed;
      }
    }
  }

  private static hash(q: number, r: number): number {
    let h = (q * 31) ^ (r * 17);
    h = Math.imul(h ^ (h >>> 15), h | 1);
    h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
    return (h ^ (h >>> 14)) >>> 0;
  }

  private static noise2D(x: number, y: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;

    // smoothstep
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);

    const n00 = this.hash(ix, iy) / 0xffffffff;
    const n10 = this.hash(ix + 1, iy) / 0xffffffff;
    const n01 = this.hash(ix, iy + 1) / 0xffffffff;
    const n11 = this.hash(ix + 1, iy + 1) / 0xffffffff;

    const nx0 = n00 * (1 - sx) + n10 * sx;
    const nx1 = n01 * (1 - sx) + n11 * sx;

    return nx0 * (1 - sy) + nx1 * sy;
  }
}
