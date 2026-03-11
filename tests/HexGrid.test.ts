import { describe, it, expect } from 'vitest';
import { HexGrid } from '../lib/hex/HexGrid';

describe('HexGrid', () => {
  it('should store and retrieve cells', () => {
    const grid = new HexGrid();
    grid.set(0, 0, { terrainCode: 'Gg', q: 0, r: 0, neighbors: [], overlay: null, transitionMasks: new Map(), variation: 0 });
    grid.set(1, -1, { terrainCode: 'Ww', q: 1, r: -1, neighbors: [], overlay: null, transitionMasks: new Map(), variation: 0 });

    expect(grid.get(0, 0)?.terrainCode).toBe('Gg');
    expect(grid.get(1, -1)?.terrainCode).toBe('Ww');
    expect(grid.get(2, 2)).toBeUndefined();
  });

  it('should check if cell exists', () => {
    const grid = new HexGrid();
    grid.set(0, 0, { terrainCode: 'Gg', q: 0, r: 0, neighbors: [], overlay: null, transitionMasks: new Map(), variation: 0 });
    expect(grid.has(0, 0)).toBe(true);
    expect(grid.has(1, 1)).toBe(false);
  });

  it('should delete cells', () => {
    const grid = new HexGrid();
    grid.set(0, 0, { terrainCode: 'Gg', q: 0, r: 0, neighbors: [], overlay: null, transitionMasks: new Map(), variation: 0 });
    expect(grid.delete(0, 0)).toBe(true);
    expect(grid.has(0, 0)).toBe(false);
  });
});
