import { HexGrid, HexCell } from '../hex/HexGrid';

export class MapParser {
  static parse(mapText: string): HexGrid {
    const grid = new HexGrid();
    const lines = mapText.trim().split('\n').map(line => line.trim()).filter(line => line.length > 0);

    for (let row = 0; row < lines.length; row++) {
      const codes = lines[row].split(/\s+/);
      for (let col = 0; col < codes.length; col++) {
        const terrainCode = codes[col];
        
        // Convert odd-q offset coordinates to axial coordinates
        const q = col;
        const r = row - Math.floor(col / 2);

        const cell: HexCell = {
          terrainCode,
          q,
          r,
          neighbors: [],
          overlay: null,
          transitionMasks: new Map<string, number>(),
          variation: 0
        };

        grid.set(q, r, cell);
      }
    }

    // Populate neighbors
    for (const cell of grid.values()) {
      cell.neighbors = grid.getNeighbors(cell);
    }

    return grid;
  }
}
