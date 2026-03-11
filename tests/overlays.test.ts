import { describe, it, expect } from 'vitest';
import { MapParser } from '../lib/terrain/MapParser';
import { OverlayResolver } from '../lib/terrain/OverlayResolver';

describe('Overlays', () => {
  it('should allow setting and getting overlays', () => {
    const map = `
Gg Mm
`;
    const grid = MapParser.parse(map);
    OverlayResolver.resolve(grid);

    const grassHex = grid.get(0, 0);
    const mountainHex = grid.get(1, 0);
    
    expect(grassHex?.terrainCode).toBe('Gg');
    expect(mountainHex?.terrainCode).toBe('Mm');
  });
});
