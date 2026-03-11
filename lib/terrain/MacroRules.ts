import { MacroTerrainRule } from './MacroRuleEngine';

export const MACRO_RULES: MacroTerrainRule[] = [
  // River cross intersection
  {
    id: 'river-cross',
    pattern: [
      ['*', 'Rr', '*'],
      ['Rr', 'Rr', 'Rr'],
      ['*', 'Rr', '*']
    ],
    center: [1, 1],
    sprite: 'water/ford.png', // Placeholder
    layer: 2,
    rotatable: true
  },
  // River straight (W to E)
  {
    id: 'river-straight',
    pattern: [
      ['*', '*', '*'],
      ['Rr', 'Rr', 'Rr'],
      ['*', '*', '*']
    ],
    center: [1, 1],
    sprite: 'water/ford.png', // Placeholder
    layer: 2,
    rotatable: true
  },
  // River corner (NW to W)
  {
    id: 'river-corner',
    pattern: [
      ['Rr', '*', '*'],
      ['Rr', 'Rr', '*'],
      ['*', '*', '*']
    ],
    center: [1, 1],
    sprite: 'water/ford.png', // Placeholder
    layer: 2,
    rotatable: true
  },
  // Road cross intersection
  {
    id: 'road-cross',
    pattern: [
      ['*', 'Rd', '*'],
      ['Rd', 'Rd', 'Rd'],
      ['*', 'Rd', '*']
    ],
    center: [1, 1],
    sprite: 'flat/road.png', // Placeholder
    layer: 2,
    rotatable: true
  },
  // Road straight (W to E)
  {
    id: 'road-straight',
    pattern: [
      ['*', '*', '*'],
      ['Rd', 'Rd', 'Rd'],
      ['*', '*', '*']
    ],
    center: [1, 1],
    sprite: 'flat/road.png', // Placeholder
    layer: 2,
    rotatable: true
  },
  // Road corner (NW to W)
  {
    id: 'road-corner',
    pattern: [
      ['Rd', '*', '*'],
      ['Rd', 'Rd', '*'],
      ['*', '*', '*']
    ],
    center: [1, 1],
    sprite: 'flat/road.png', // Placeholder
    layer: 2,
    rotatable: true
  }
];
