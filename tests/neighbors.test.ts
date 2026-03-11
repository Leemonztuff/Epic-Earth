import { describe, it, expect } from 'vitest';
import { HexGrid } from '../lib/hex/HexGrid';

describe('Hex Neighbors', () => {
  it('should return 6 neighbors for a hex', () => {
    const neighbors = HexGrid.getNeighborCoords(0, 0);
    expect(neighbors.length).toBe(6);
    expect(neighbors).toContainEqual({ q: 1, r: 0 });
    expect(neighbors).toContainEqual({ q: 1, r: -1 });
    expect(neighbors).toContainEqual({ q: 0, r: -1 });
    expect(neighbors).toContainEqual({ q: -1, r: 0 });
    expect(neighbors).toContainEqual({ q: -1, r: 1 });
    expect(neighbors).toContainEqual({ q: 0, r: 1 });
  });

  it('should return correct neighbor for a specific direction', () => {
    expect(HexGrid.getNeighbor(0, 0, 0)).toEqual({ q: 1, r: 0 });
    expect(HexGrid.getNeighbor(0, 0, 3)).toEqual({ q: -1, r: 0 });
  });
});
