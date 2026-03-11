import { describe, it, expect } from 'vitest';
import { TERRAIN_REGISTRY } from '../lib/terrain/TerrainRegistry';

describe('TerrainRegistry', () => {
  it('should have predefined terrains', () => {
    const grass = TERRAIN_REGISTRY['Gg'];
    expect(grass).toBeDefined();
    expect(grass.id).toBe('grass');
    expect(grass.variations).toBe(4);
    expect(grass.transitions).toBe(true);
  });

  it('should have water terrain', () => {
    const water = TERRAIN_REGISTRY['Ww'];
    expect(water).toBeDefined();
    expect(water.id).toBe('water');
  });
});
