import { HexGrid, HexCell } from '../hex/HexGrid';
import { Noise } from '../math/Noise';

export interface MapGenConfig {
  width: number;
  height: number;
  seed: number;
}

// Simple hash function for deterministic variations
function hash(q: number, r: number, seed: number): number {
  let h = (q * 31 + r * 17 + seed) ^ 0x5a5a5a5a;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return Math.abs(h);
}

export class MapGenerator {
  static generate(config: MapGenConfig): HexGrid {
    const grid = new HexGrid();
    const { width, height, seed } = config;

    // 1. Generate environmental maps with multiple scales
    for (let r = 0; r < height; r++) {
      for (let q = 0; q < width; q++) {
        // Adjust q for axial coordinates to make a rectangular map
        const axialQ = q - Math.floor(r / 2);
        const axialR = r;

        // Continent scale (large landmasses)
        const continentNoise = Noise.fbm(q * 0.03, r * 0.03, 4, seed);
        // Detail scale (local bumps)
        const detailNoise = Noise.fbm(q * 0.15, r * 0.15, 2, seed + 10);
        
        // Combine for final height
        const h = continentNoise * 0.8 + detailNoise * 0.2;
        
        // Temperature map (depends on latitude and noise)
        const lat = Math.abs((r / height) - 0.5) * 2; // 0 at equator, 1 at poles
        const tNoise = Noise.fbm(q * 0.05, r * 0.05, 3, seed + 100);
        const t = (1 - lat) * 0.6 + tNoise * 0.4;

        // Moisture map
        const m = Noise.fbm(q * 0.08, r * 0.08, 3, seed + 200);

        const cell: HexCell = {
          q: axialQ,
          r: axialR,
          terrainCode: "Gg",
          overlay: null,
          decoration: null,
          neighbors: [],
          transitionMasks: new Map(),
          variation: 0,
          height: h,
          moisture: m,
          temperature: t
        };
        grid.set(axialQ, axialR, cell);
      }
    }

    // 2. Biome classification
    for (const cell of grid.values()) {
      const { height: h, temperature: t, moisture: m } = cell;

      if (h! < 0.35) {
        cell.terrainCode = "Ww"; // Ocean/Water
      } else if (h! < 0.4) {
        cell.terrainCode = "Ds"; // Coast/Sand
      } else if (h! > 0.8) {
        cell.terrainCode = "Mm"; // Mountains
      } else if (h! > 0.65) {
        cell.terrainCode = "Hh"; // Hills
      } else {
        // Plains
        if (t! > 0.7 && m! < 0.3) {
          cell.terrainCode = "Dd"; // Desert
        } else if (t! > 0.6 && m! > 0.6) {
          cell.terrainCode = "Gg"; // Jungle base
          cell.overlay = "Jg"; // Jungle overlay
        } else if (t! < 0.3) {
          cell.terrainCode = "Aa"; // Snow
        } else {
          cell.terrainCode = "Gg"; // Grassland
        }
      }

      // Forest clustering
      if (cell.terrainCode === "Gg" || cell.terrainCode === "Hh") {
        if (m! > 0.6 && cell.overlay === null) {
          cell.overlay = "Ff"; // Forest
        }
      }
    }

    // Populate neighbors before smoothing
    for (const cell of grid.values()) {
      cell.neighbors = grid.getNeighbors(cell);
    }

    // 3. Terrain Variation Clustering (Smoothing)
    for (let i = 0; i < 3; i++) {
      MapGenerator.smoothTerrain(grid);
    }

    // 4. Flow Map & River Generation
    
    // Initialize water and flow
    for (const cell of grid.values()) {
      cell.water = cell.moisture! * 10; // Base rainfall
      cell.flow = null;
    }

    // Calculate flow direction (steepest descent)
    for (const cell of grid.values()) {
      let lowestHeight = cell.height!;
      let target = null;
      
      for (const n of cell.neighbors) {
        if (n && n.height! < lowestHeight) {
          lowestHeight = n.height!;
          target = n;
        }
      }
      cell.flow = target;
    }

    // Accumulate water (process from highest to lowest)
    const sortedCells = Array.from(grid.values()).sort((a, b) => b.height! - a.height!);

    for (const cell of sortedCells) {
      if (cell.flow) {
        cell.flow.water! += cell.water!;
      }
    }

    // Determine rivers
    const RIVER_THRESHOLD = 50; // Adjust based on map size and rainfall
    for (const cell of grid.values()) {
      if (cell.water! > RIVER_THRESHOLD && cell.terrainCode !== 'Ww' && cell.terrainCode !== 'Mm') {
        cell.terrainCode = 'Rr';
        cell.overlay = null; // wash away forests
      }
    }

    // Calculate river masks
    for (const cell of grid.values()) {
      if (cell.terrainCode === 'Rr') {
        let mask = 0;
        for (let dir = 0; dir < 6; dir++) {
          const nCoord = HexGrid.getNeighbor(cell.q, cell.r, dir);
          const n = grid.get(nCoord.q, nCoord.r);
          if (n) {
            // Connect if neighbor is also a river or water, and there is a flow relationship
            if (n.terrainCode === 'Rr' || n.terrainCode === 'Ww') {
              if (cell.flow === n || n.flow === cell || n.terrainCode === 'Ww') {
                mask |= (1 << dir);
              }
            }
          }
        }
        cell.riverMask = mask;
      }
    }

    // 5. Visual Variants & Decorations
    for (const cell of grid.values()) {
      // Set variant
      cell.variation = hash(cell.q, cell.r, seed);

      // Procedural Decorations
      const rand = hash(cell.q, cell.r, seed + 1000) / 0xffffffff;
      
      if (cell.terrainCode === "Gg" && !cell.overlay && rand < 0.1) {
        cell.decoration = "flowers";
      } else if (cell.terrainCode === "Mm" && rand < 0.2) {
        cell.decoration = "rocks";
      } else if (cell.terrainCode === "Ww" && rand < 0.05) {
        cell.decoration = "water-lilies";
      } else if (cell.terrainCode === "Ff" || cell.overlay === "Ff") {
        if (rand < 0.15) {
          cell.decoration = "mushrooms";
        }
      }
    }

    return grid;
  }

  static smoothTerrain(grid: HexGrid) {
    const changes = new Map<string, { terrainCode: string, overlay: string | null }>();

    for (const cell of grid.values()) {
      const neighbors = cell.neighbors.filter(n => n !== null) as HexCell[];
      
      // Count terrain types
      const counts = new Map<string, number>();
      const overlayCounts = new Map<string, number>();
      
      for (const n of neighbors) {
        counts.set(n.terrainCode, (counts.get(n.terrainCode) || 0) + 1);
        if (n.overlay) {
          overlayCounts.set(n.overlay, (overlayCounts.get(n.overlay) || 0) + 1);
        }
      }

      let dominantTerrain = cell.terrainCode;
      let maxCount = 0;
      for (const [t, c] of counts.entries()) {
        if (c > maxCount) {
          maxCount = c;
          dominantTerrain = t;
        }
      }

      let newTerrain = cell.terrainCode;
      let newOverlay = cell.overlay;

      // Special rule for water expansion
      if ((counts.get('Ww') || 0) >= 3) {
        newTerrain = 'Ww';
        newOverlay = null;
      } 
      // Special rule for mountains
      else if (cell.height! > 0.8 && (counts.get('Mm') || 0) >= 2) {
        newTerrain = 'Mm';
        newOverlay = null;
      }
      // General smoothing
      else if (maxCount >= 4) {
        newTerrain = dominantTerrain;
      }

      // Overlay smoothing (forests)
      if (newTerrain === 'Gg' || newTerrain === 'Hh') {
        if ((overlayCounts.get('Ff') || 0) >= 3) {
          newOverlay = 'Ff';
        } else if ((overlayCounts.get('Ff') || 0) <= 1 && newOverlay === 'Ff') {
          // Remove isolated forests
          newOverlay = null;
        }
      } else {
        newOverlay = null; // Clear overlay if terrain changed to something incompatible
      }

      if (newTerrain !== cell.terrainCode || newOverlay !== cell.overlay) {
        changes.set(`${cell.q},${cell.r}`, { terrainCode: newTerrain, overlay: newOverlay });
      }
    }

    // Apply changes
    for (const [key, change] of changes.entries()) {
      const [qStr, rStr] = key.split(',');
      const cell = grid.get(parseInt(qStr), parseInt(rStr));
      if (cell) {
        cell.terrainCode = change.terrainCode;
        cell.overlay = change.overlay;
      }
    }
  }
}
