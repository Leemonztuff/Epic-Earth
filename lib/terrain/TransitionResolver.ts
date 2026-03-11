import { HexGrid } from '../hex/HexGrid';
import { TERRAIN_REGISTRY } from './TerrainRegistry';

export class TransitionResolver {
  static resolve(grid: HexGrid) {
    for (const cell of grid.values()) {
      const masks = new Map<string, number>();
      const currentDef = TERRAIN_REGISTRY[cell.terrainCode];
      if (!currentDef || !currentDef.transitions) continue;

      for (let dir = 0; dir < 6; dir++) {
        const neighbor = cell.neighbors[dir];
        if (neighbor && neighbor.terrainCode !== cell.terrainCode) {
          const neighborDef = TERRAIN_REGISTRY[neighbor.terrainCode];
          // Only draw transition if we have a higher z-index than the neighbor,
          // or if z-index is equal and our terrain code is alphabetically greater (deterministic tie-breaker)
          if (neighborDef) {
            if (currentDef.zIndex > neighborDef.zIndex || 
               (currentDef.zIndex === neighborDef.zIndex && cell.terrainCode > neighbor.terrainCode)) {
              const t = neighbor.terrainCode;
              const prev = masks.get(t) ?? 0;
              masks.set(t, prev | (1 << dir));
            }
          }
        }
      }
      cell.transitionMasks = masks;
    }
  }
}
