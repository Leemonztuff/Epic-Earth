import { WMLNode, WMLParser } from './WMLParser';
import { MacroTerrainRule } from '../terrain/MacroRuleEngine';

export class WMLRuleConverter {
  static convertTerrainGraphics(node: WMLNode): MacroTerrainRule | null {
    if (node.tag !== 'terrain_graphics') return null;

    const mapAttr = node.attributes['map'];
    if (!mapAttr) return null;

    // Parse map pattern
    const pattern = this.parseMapPattern(mapAttr);
    if (!pattern) return null;

    // Find tile type (center terrain)
    let centerTerrain = '*';
    const tileNode = node.children.find(c => c.tag === 'tile' && c.attributes['pos'] === '1');
    if (tileNode && tileNode.attributes['type']) {
      centerTerrain = tileNode.attributes['type'];
    }

    // Find image
    let sprite = '';
    const imageNode = node.children.find(c => c.tag === 'image');
    if (imageNode && imageNode.attributes['name']) {
      sprite = imageNode.attributes['name'];
    }

    if (!sprite) return null;

    // Determine center coordinates (usually 1,1 for 3x3)
    const center: [number, number] = [1, 1];

    return {
      id: `wml-${Math.random().toString(36).substr(2, 9)}`,
      pattern,
      center,
      sprite,
      layer: 2, // Default layer for now
      rotatable: false // WML handles rotations via specific rules or flags
    };
  }

  private static parseMapPattern(mapStr: string): string[][] {
    const lines = mapStr.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return [];

    const pattern: string[][] = [];
    for (const line of lines) {
      const row = line.split(',').map(cell => {
        const t = cell.trim();
        return t === '' ? '*' : t;
      });
      pattern.push(row);
    }
    return pattern;
  }

  static async loadWesnothRules(): Promise<MacroTerrainRule[]> {
    const CACHE_KEY = 'wesnoth_terrain_rules';
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error('Failed to parse cached rules', e);
      }
    }

    try {
      // Fetch terrain-graphics.cfg from CDN
      const url = 'https://cdn.jsdelivr.net/gh/wesnoth/wesnoth@1.18.0/data/core/terrain-graphics.cfg';
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch WML: ${response.statusText}`);
      
      const text = await response.text();
      const rootNode = WMLParser.parse(text);
      
      const rules: MacroTerrainRule[] = [];
      
      // Find all [terrain_graphics] nodes
      const findGraphicsNodes = (node: WMLNode) => {
        if (node.tag === 'terrain_graphics') {
          const rule = WMLRuleConverter.convertTerrainGraphics(node);
          if (rule) rules.push(rule);
        }
        node.children.forEach(findGraphicsNodes);
      };
      
      findGraphicsNodes(rootNode);
      
      // Cache the result
      localStorage.setItem(CACHE_KEY, JSON.stringify(rules));
      
      return rules;
    } catch (error) {
      console.error('Error loading Wesnoth rules:', error);
      return [];
    }
  }
}
