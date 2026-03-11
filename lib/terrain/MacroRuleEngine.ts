import { HexGrid, HexCell } from '../hex/HexGrid';
import { getAssetBase } from './TerrainRegistry';

export type MacroTerrainRule = {
  id: string;
  pattern: string[][];
  center: [number, number];
  sprite: string;
  layer: number;
  rotatable?: boolean;
};

// Mapping from 3x3 pattern to hex directions
// n1(NW)  n2(NE)
//    n3(W)  C   n0(E)
//       n4(SW) n5(SE)
//
// Directions:
// 0: E, 1: NE, 2: NW, 3: W, 4: SW, 5: SE
export const PATTERN_DIRS = [
  { row: 1, col: 2, dir: 0 }, // n0 -> E
  { row: 0, col: 1, dir: 1 }, // n2 -> NE
  { row: 0, col: 0, dir: 2 }, // n1 -> NW
  { row: 1, col: 0, dir: 3 }, // n3 -> W
  { row: 2, col: 0, dir: 4 }, // n4 -> SW
  { row: 2, col: 1, dir: 5 }  // n5 -> SE
];

export interface MacroMatch {
  ruleId: string;
  sprite: string;
  layer: number;
  rotation: number; // 0 to 5 (multiply by 60 degrees)
}

export class MacroRuleEngine {
  private rules: MacroTerrainRule[] = [];
  private rulesByCenter = new Map<string, MacroTerrainRule[]>();

  addRule(rule: MacroTerrainRule) {
    this.rules.push(rule);
    const centerTerrain = rule.pattern[rule.center[0]][rule.center[1]];
    if (centerTerrain !== '*') {
      const existing = this.rulesByCenter.get(centerTerrain) || [];
      existing.push(rule);
      this.rulesByCenter.set(centerTerrain, existing);
    } else {
      // If center is wildcard, add to a special wildcard list
      const existing = this.rulesByCenter.get('*') || [];
      existing.push(rule);
      this.rulesByCenter.set('*', existing);
    }
  }

  evaluate(grid: HexGrid): Map<string, MacroMatch[]> {
    const matches = new Map<string, MacroMatch[]>();

    for (const cell of grid.values()) {
      const cellMatches: MacroMatch[] = [];
      const centerCode = cell.terrainCode;
      
      const candidateRules = [
        ...(this.rulesByCenter.get(centerCode) || []),
        ...(this.rulesByCenter.get('*') || [])
      ];

      for (const rule of candidateRules) {
        // Check all 6 rotations if rotatable, otherwise just 0
        const maxRotations = rule.rotatable ? 6 : 1;
        
        for (let rot = 0; rot < maxRotations; rot++) {
          if (this.matchPattern(grid, cell, rule, rot)) {
            cellMatches.push({
              ruleId: rule.id,
              sprite: `${getAssetBase()}${rule.sprite}`,
              layer: rule.layer,
              rotation: rot
            });
            // If we only want one match per rule, we could break here,
            // but a rule might match in multiple rotations? Usually we break.
            break;
          }
        }
      }

      if (cellMatches.length > 0) {
        // Sort by layer
        cellMatches.sort((a, b) => a.layer - b.layer);
        matches.set(`${cell.q},${cell.r}`, cellMatches);
      }
    }

    return matches;
  }

  private matchPattern(grid: HexGrid, cell: HexCell, rule: MacroTerrainRule, rotation: number): boolean {
    // Check center first
    const expectedCenter = rule.pattern[rule.center[0]][rule.center[1]];
    if (expectedCenter !== '*' && expectedCenter !== cell.terrainCode) {
      return false;
    }

    // Check neighbors
    for (const mapping of PATTERN_DIRS) {
      const expectedTerrain = rule.pattern[mapping.row][mapping.col];
      if (expectedTerrain === '*') continue;

      // Clockwise rotation:
      // 0(E) -> 5(SE) -> 4(SW) -> 3(W) -> 2(NW) -> 1(NE)
      const rotatedDir = (mapping.dir - rotation + 6) % 6;
      
      const neighborCoords = HexGrid.getNeighbor(cell.q, cell.r, rotatedDir);
      const neighborCell = grid.get(neighborCoords.q, neighborCoords.r);
      const actualTerrain = neighborCell ? neighborCell.terrainCode : null;

      if (actualTerrain !== expectedTerrain) {
        return false;
      }
    }

    return true;
  }
}
