import { describe, it, expect } from 'vitest';
import { TransitionResolver } from '../lib/terrain/TransitionResolver';
import { MapParser } from '../lib/terrain/MapParser';

describe('Autotiling Transitions', () => {
  it('should calculate transitions based on z-index', () => {
    // Ww (Water, z=0) next to Gg (Grass, z=1)
    const map = `
Ww Gg
`;
    const grid = MapParser.parse(map);
    TransitionResolver.resolve(grid);
    
    // Water hex at (0,0) should have a grass transition from direction 0 (where grass is)
    // Grass is at (1,0) which is direction 0 from (0,0)
    const waterCell = grid.get(0, 0);
    expect(waterCell).toBeDefined();
    
    // Grass has higher z-index, so water cell should have transition mask bit 0 set for Gg
    expect(waterCell!.transitionMasks.get('Gg')! & (1 << 0)).toBeGreaterThan(0);
    
    // Grass cell should not have transition mask for water (lower z-index)
    const grassCell = grid.get(1, 0);
    expect(grassCell!.transitionMasks.has('Ww')).toBe(false);
  });
});
