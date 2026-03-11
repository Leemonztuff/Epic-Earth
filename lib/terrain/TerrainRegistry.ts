export const USE_WESNOTH_CDN_ASSETS = true;
export const WESNOTH_ASSET_BASE = "https://cdn.jsdelivr.net/gh/wesnoth/wesnoth@1.18.0/data/core/images/terrain/";
export const LOCAL_ASSET_BASE = "/assets/terrain/";

export const getAssetBase = () => USE_WESNOTH_CDN_ASSETS ? WESNOTH_ASSET_BASE : LOCAL_ASSET_BASE;

export interface TerrainDef {
  id: string;
  name: string;
  color: string;
  zIndex: number;
  layer?: number;
  offsetY?: number;
  isOverlay?: boolean;
  variations: number;
  transitions: boolean;
  base: string[];
  movementCost?: number;
}

export function getTransitionUrl(fromCode: string, toCode: string, variation: number = 0): string | null {
  const fromDef = TERRAIN_REGISTRY[fromCode];
  const toDef = TERRAIN_REGISTRY[toCode];
  if (!fromDef || !toDef || !fromDef.base || fromDef.base.length === 0) return null;

  const baseUrl = fromDef.base[variation % fromDef.base.length];
  const assetBase = getAssetBase();
  
  if (!baseUrl.startsWith(assetBase)) return null;
  
  const relativePath = baseUrl.substring(assetBase.length);
  const parts = relativePath.split('/');
  const fileName = parts.pop()?.replace('.png', '') || '';
  const folderName = parts.length > 0 ? parts.join('/') + '/' : '';
  
  return `${assetBase}${folderName}${fileName}-to-${toDef.id}-n.png`;
}

export const DECORATION_REGISTRY: Record<string, { base: string[], offsetY?: number }> = {
  "flowers": {
    base: [
      `${getAssetBase()}embellishments/flower1.png`,
      `${getAssetBase()}embellishments/flower2.png`,
      `${getAssetBase()}embellishments/flower3.png`
    ]
  },
  "rocks": {
    base: [
      `${getAssetBase()}embellishments/pebbles1.png`,
      `${getAssetBase()}embellishments/pebbles2.png`
    ]
  },
  "water-lilies": {
    base: [
      `${getAssetBase()}embellishments/water-lilies.png`
    ]
  },
  "mushrooms": {
    base: [
      `${getAssetBase()}embellishments/mushroom1.png`,
      `${getAssetBase()}embellishments/mushroom2.png`
    ]
  }
};

export const TERRAIN_REGISTRY: Record<string, TerrainDef> = {
  Gg: {
    id: "grass",
    name: "Grass",
    color: "#22c55e",
    base: [
      `${getAssetBase()}grass/green.png`
    ],
    variations: 1,
    transitions: true,
    zIndex: 1,
    movementCost: 1
  },
  Ww: {
    id: "water",
    name: "Water",
    color: "#3b82f6",
    base: [
      `${getAssetBase()}water/ocean01.png`,
      `${getAssetBase()}water/ocean02.png`,
      `${getAssetBase()}water/ocean03.png`
    ],
    variations: 3,
    transitions: true,
    zIndex: 0,
    movementCost: 99
  },
  Ds: {
    id: "sand",
    name: "Sand",
    color: "#fde047",
    base: [
      `${getAssetBase()}sand/beach.png`
    ],
    variations: 1,
    transitions: true,
    zIndex: 1,
    movementCost: 2
  },
  Dd: {
    id: "desert",
    name: "Desert",
    color: "#fcd34d",
    base: [
      `${getAssetBase()}sand/desert.png`
    ],
    variations: 1,
    transitions: true,
    zIndex: 1,
    movementCost: 2
  },
  Aa: {
    id: "snow",
    name: "Snow",
    color: "#f8fafc",
    base: [
      `${getAssetBase()}frozen/snow.png`
    ],
    variations: 1,
    transitions: true,
    zIndex: 1,
    movementCost: 2
  },
  Hh: {
    id: "hills",
    name: "Hills",
    color: "#a1a1aa",
    base: [
      `${getAssetBase()}hills/regular.png`
    ],
    variations: 1,
    transitions: true,
    zIndex: 2,
    layer: 3,
    offsetY: -5,
    movementCost: 2
  },
  Jg: {
    id: "jungle",
    name: "Jungle",
    color: "#064e3b",
    base: [
      `${getAssetBase()}forest/tropical.png`
    ],
    variations: 1,
    transitions: true,
    isOverlay: true,
    zIndex: 2,
    layer: 3,
    offsetY: -10,
    movementCost: 2
  },
  Re: {
    id: "dirt",
    name: "Dirt",
    color: "#a16207",
    base: [
      `${getAssetBase()}flat/dirt.png`
    ],
    variations: 1,
    transitions: true,
    zIndex: 1,
    movementCost: 1
  },
  Rd: {
    id: "road",
    name: "Road",
    color: "#d97706",
    base: [
      `${getAssetBase()}flat/road.png`
    ],
    variations: 1,
    transitions: true,
    zIndex: 2,
    movementCost: 1
  },
  Rr: {
    id: "river",
    name: "River",
    color: "#0ea5e9",
    base: [
      `${getAssetBase()}water/ford.png`
    ],
    variations: 1,
    transitions: true,
    zIndex: 1,
    movementCost: 2
  },
  Mm: {
    id: "mountain",
    name: "Mountain",
    color: "#71717a",
    base: [
      `${getAssetBase()}mountains/basic.png`
    ],
    variations: 1,
    transitions: true,
    zIndex: 3,
    layer: 3,
    offsetY: -15,
    movementCost: 3
  },
  Ff: {
    id: "forest",
    name: "Forest",
    color: "#166534",
    base: [
      `${getAssetBase()}forest/pine.png`
    ],
    variations: 1,
    transitions: true,
    zIndex: 2,
    layer: 3,
    offsetY: -10,
    movementCost: 2
  },
  Vi: {
    id: "village",
    name: "Village",
    color: "#ef4444",
    base: [
      `${getAssetBase()}village/human.png`
    ],
    variations: 1,
    transitions: false,
    isOverlay: true,
    zIndex: 10,
    layer: 4,
    offsetY: -15,
    movementCost: 1
  },
  Ca: {
    id: "castle",
    name: "Castle",
    color: "#52525b",
    base: [
      `${getAssetBase()}castle/encampment/regular-keep.png`
    ],
    variations: 1,
    transitions: false,
    isOverlay: true,
    zIndex: 10,
    layer: 4,
    offsetY: -15,
    movementCost: 1
  }
};
