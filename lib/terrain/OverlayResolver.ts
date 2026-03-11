import { HexGrid } from '../hex/HexGrid';

export class OverlayResolver {
  static resolve(grid: HexGrid) {
    for (const cell of grid.values()) {
      // Deterministically add overlays based on coordinates and terrain
      const hash = this.hash(cell.q, cell.r);
      
      if (cell.terrainCode === 'Gg' && hash % 10 === 0) {
        cell.overlay = 'Vi'; // Village
      } else if (cell.terrainCode === 'Mm' && hash % 15 === 0) {
        cell.overlay = 'Ca'; // Castle
      }
    }
  }

  private static hash(q: number, r: number): number {
    let h = (q * 13) ^ (r * 37);
    h = Math.imul(h ^ (h >>> 15), h | 1);
    h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
    return (h ^ (h >>> 14)) >>> 0;
  }
}
