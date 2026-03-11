'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { TERRAIN_REGISTRY, getTransitionUrl, DECORATION_REGISTRY } from '../lib/terrain/TerrainRegistry';
import { HexGrid, HexCell } from '../lib/hex/HexGrid';
import { findBestMaskCandidate } from '../lib/autotile/selectSprite';
import { MacroRuleEngine } from '../lib/terrain/MacroRuleEngine';
import { MACRO_RULES } from '../lib/terrain/MacroRules';
import { WMLRuleConverter } from '../lib/wml/WMLRuleConverter';
import { FlowField, FlowFieldResult } from '../lib/terrain/FlowField';
import { TextureAtlas } from '../lib/terrain/TextureAtlas';
import { UnitInstance, UNIT_REGISTRY } from '../lib/units/UnitRegistry';

export async function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => resolve(img);
    img.onerror = () => reject(url);

    img.src = url;
  });
}

const MOCK_AVAILABLE_MASKS = [
  0, 1, 2, 4, 8, 16, 32,
  3, 6, 12, 24, 48, 33,
  7, 14, 28, 56, 49, 35,
  63
];

interface HexGridRendererProps {
  grid: HexGrid;
  size: number;
  debug?: boolean;
  units?: UnitInstance[];
  onUnitMove?: (unitId: string, path: HexCell[], cost: number) => void;
  onUnitSelect?: (unit: UnitInstance | null) => void;
  onUnitAttack?: (attackerId: string, defenderId: string) => void;
}

const CHUNK_SIZE = 16;

export interface Chunk {
  key: string;
  qStart: number;
  rStart: number;
  hexes: HexCell[];
  canvas: HTMLCanvasElement | null;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  dirty: boolean;
}

export function HexGridRenderer({ grid, size, debug = true, units = [], onUnitMove, onUnitSelect, onUnitAttack }: HexGridRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const imageCache = useRef<Record<string, HTMLImageElement>>({});
  const atlasRef = useRef<TextureAtlas | null>(null);

  const [wmlRulesLoaded, setWmlRulesLoaded] = useState(false);

  // Camera state
  const cameraRef = useRef({ x: 0, y: 0, zoom: 1 });
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  // Pathfinding state
  const startHexRef = useRef<HexCell | null>(null);
  const hoverHexRef = useRef<HexCell | null>(null);
  const pathRef = useRef<HexCell[]>([]);
  const flowFieldRef = useRef<FlowFieldResult | null>(null);
  const selectedUnitRef = useRef<UnitInstance | null>(null);

  // Chunking
  const chunksRef = useRef<Map<string, Chunk>>(new Map());

  const macroEngine = useMemo(() => {
    const engine = new MacroRuleEngine();
    MACRO_RULES.forEach(rule => engine.addRule(rule));
    return engine;
  }, []);

  useEffect(() => {
    async function loadWML() {
      try {
        const rules = await WMLRuleConverter.loadWesnothRules();
        rules.forEach(rule => macroEngine.addRule(rule));
        setWmlRulesLoaded(true);
      } catch (e) {
        console.error("Failed to load WML rules", e);
        setWmlRulesLoaded(true);
      }
    }
    loadWML();
  }, [macroEngine]);

  const macroMatches = useMemo(() => {
    if (!wmlRulesLoaded) return new Map<string, any[]>();
    return macroEngine.evaluate(grid);
  }, [grid, macroEngine, wmlRulesLoaded]);

  useEffect(() => {
    if (!wmlRulesLoaded) return;

    async function loadAllImages() {
      const urls = new Set<string>();
      Object.values(TERRAIN_REGISTRY).forEach(def => {
        def.base.forEach(url => urls.add(url));
      });

      grid.values().forEach(hex => {
        hex.transitionMasks.forEach((mask, targetTerrain) => {
          const url = getTransitionUrl(hex.terrainCode, targetTerrain, hex.variation);
          if (url) urls.add(url);
        });
      });

      macroMatches.forEach(matches => {
        matches.forEach((match: any) => {
          urls.add(match.sprite);
        });
      });

      // Add unit sprites
      units.forEach(unit => {
        const def = UNIT_REGISTRY[unit.typeId];
        if (def && def.sprite) {
          urls.add(def.sprite);
        }
      });

      // Add decorations
      grid.values().forEach(hex => {
        if (hex.decoration) {
          const decDef = DECORATION_REGISTRY[hex.decoration];
          if (decDef) {
            const url = decDef.base[hex.variation % decDef.base.length];
            if (url) urls.add(url);
          }
        }
      });

      const loadPromises = Array.from(urls).map(async url => {
        try {
          const img = await loadImage(url);
          imageCache.current[url] = img;
        } catch {
          try {
            const fallback = await loadImage("/fallback-tile.png");
            imageCache.current[url] = fallback;
          } catch (e) {
            console.error("Fallback also failed for", url);
          }
        }
      });

      await Promise.all(loadPromises);
      
      // Create texture atlas
      try {
        atlasRef.current = new TextureAtlas(imageCache.current);
      } catch (e) {
        console.error("Failed to create texture atlas", e);
      }

      setImagesLoaded(true);
    }
    loadAllImages();
  }, [grid, macroMatches, wmlRulesLoaded]);

  // Rebuild chunks when grid changes
  useEffect(() => {
    if (!imagesLoaded) return;
    
    const chunks = new Map<string, Chunk>();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    grid.values().forEach(hex => {
      const cq = Math.floor(hex.q / CHUNK_SIZE);
      const cr = Math.floor(hex.r / CHUNK_SIZE);
      const key = `${cq},${cr}`;
      
      if (!chunks.has(key)) {
        chunks.set(key, {
          key,
          qStart: cq * CHUNK_SIZE,
          rStart: cr * CHUNK_SIZE,
          hexes: [],
          canvas: null,
          bounds: { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
          dirty: true
        });
      }
      
      const chunk = chunks.get(key)!;
      chunk.hexes.push(hex);
      
      const { x, y } = HexGrid.hexToPixel(hex.q, hex.r, size);
      const padding = size * 2;
      
      chunk.bounds.minX = Math.min(chunk.bounds.minX, x - padding);
      chunk.bounds.minY = Math.min(chunk.bounds.minY, y - padding);
      chunk.bounds.maxX = Math.max(chunk.bounds.maxX, x + padding);
      chunk.bounds.maxY = Math.max(chunk.bounds.maxY, y + padding);
      
      minX = Math.min(minX, chunk.bounds.minX);
      minY = Math.min(minY, chunk.bounds.minY);
      maxX = Math.max(maxX, chunk.bounds.maxX);
      maxY = Math.max(maxY, chunk.bounds.maxY);
    });
    
    chunksRef.current = chunks;

    // Center camera on first load or grid change
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mapWidth = maxX - minX;
      const mapHeight = maxY - minY;
      
      cameraRef.current.x = (rect.width - mapWidth) / 2 - minX;
      cameraRef.current.y = (rect.height - mapHeight) / 2 - minY;
      cameraRef.current.zoom = 1;
    }
  }, [grid, imagesLoaded, size, debug, macroMatches]);

  // Render a single chunk to its offscreen canvas
  const renderChunk = useCallback((chunk: Chunk) => {
    if (!chunk.canvas) {
      chunk.canvas = document.createElement('canvas');
    }
    
    const width = chunk.bounds.maxX - chunk.bounds.minX;
    const height = chunk.bounds.maxY - chunk.bounds.minY;
    
    chunk.canvas.width = width;
    chunk.canvas.height = height;
    
    const ctx = chunk.canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(-chunk.bounds.minX, -chunk.bounds.minY);
    
    const WESNOTH_HEX_WIDTH = 72;
    const scale = (size * 2) / WESNOTH_HEX_WIDTH;

    const sortedHexes = chunk.hexes.map((hex: HexCell) => {
      const { x, y } = HexGrid.hexToPixel(hex.q, hex.r, size);
      return { hex, x, y };
    });
    sortedHexes.sort((a, b) => {
      if (Math.abs(a.y - b.y) > 1) return a.y - b.y;
      return a.x - b.x;
    });

    // Layer 0: Base Terrain
    sortedHexes.forEach(({ hex, x, y }) => {
      // Skip drawing base terrain for rivers if we are drawing them procedurally
      if (hex.terrainCode === 'Rr') {
        // Draw grass underneath the river
        const grassDef = TERRAIN_REGISTRY['Gg'];
        if (grassDef && grassDef.base.length > 0) {
          const url = grassDef.base[hex.variation % grassDef.base.length];
          const uv = atlasRef.current?.getUV(url);
          if (uv && atlasRef.current) {
            const drawWidth = uv.w * scale;
            const drawHeight = uv.h * scale;
            const offsetY = (grassDef.offsetY || 0) * scale;
            ctx.drawImage(
              atlasRef.current.canvas, 
              uv.x, uv.y, uv.w, uv.h,
              x - drawWidth / 2, y - drawHeight / 2 + offsetY, drawWidth, drawHeight
            );
          } else {
            drawHexPolygon(ctx, x, y, size, grassDef.color);
          }
        } else {
          drawHexPolygon(ctx, x, y, size, '#22c55e');
        }
        return;
      }

      const def = TERRAIN_REGISTRY[hex.terrainCode];
      
      if (def && def.base.length > 0) {
        const url = def.base[hex.variation % def.base.length];
        const uv = atlasRef.current?.getUV(url);
        
        if (uv && atlasRef.current) {
          const drawWidth = uv.w * scale;
          const drawHeight = uv.h * scale;
          const offsetY = (def.offsetY || 0) * scale;
          ctx.drawImage(
            atlasRef.current.canvas, 
            uv.x, uv.y, uv.w, uv.h,
            x - drawWidth / 2, y - drawHeight / 2 + offsetY, drawWidth, drawHeight
          );
        } else {
          drawHexPolygon(ctx, x, y, size, def.color);
        }
      } else if (def) {
        drawHexPolygon(ctx, x, y, size, def.color);
      }
    });

    // Layer 1: Transitions
    sortedHexes.forEach(({ hex, x, y }) => {
      const masks: Map<string, number> = hex.transitionMasks;
      if (masks.size === 0) return;

      Array.from(masks.entries()).forEach(([targetTerrain, mask]) => {
        const tDef = TERRAIN_REGISTRY[targetTerrain];
        if (!tDef) return;

        const url = getTransitionUrl(hex.terrainCode, targetTerrain, hex.variation);
        const uv = url ? atlasRef.current?.getUV(url) : null;

        for (let dir = 0; dir < 6; dir++) {
          if ((mask & (1 << dir)) === 0) continue;
          const angle = dir * 60 * (Math.PI / 180);
          
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(angle);
          
          if (uv && atlasRef.current) {
            const drawWidth = uv.w * scale;
            const drawHeight = uv.h * scale;
            ctx.drawImage(
              atlasRef.current.canvas,
              uv.x, uv.y, uv.w, uv.h,
              -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight
            );
          } else {
            ctx.beginPath();
            ctx.moveTo(size/2, size*Math.sqrt(3)/2);
            ctx.lineTo(size, 0);
            ctx.lineTo(size/2, -size*Math.sqrt(3)/2);
            ctx.lineTo(0, 0);
            ctx.closePath();
            
            ctx.fillStyle = tDef.color;
            ctx.globalAlpha = 0.5;
            ctx.fill();
          }
          
          ctx.restore();
        }
      });
    });

    // Layer 2: Macro Terrain
    sortedHexes.forEach(({ hex, x, y }) => {
      const matches = macroMatches.get(`${hex.q},${hex.r}`);
      if (!matches) return;

      matches.forEach((match: any) => {
        const uv = atlasRef.current?.getUV(match.sprite);
        if (!uv || !atlasRef.current) return;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(match.rotation * 60 * (Math.PI / 180));
        
        const drawWidth = uv.w * scale;
        const drawHeight = uv.h * scale;
        ctx.drawImage(
          atlasRef.current.canvas,
          uv.x, uv.y, uv.w, uv.h,
          -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight
        );
        
        ctx.restore();
      });
    });

    // Layer 2.5: Procedural Rivers
    sortedHexes.forEach(({ hex, x, y }) => {
      if (hex.terrainCode === 'Rr' && hex.riverMask !== undefined) {
        drawRiver(ctx, x, y, size, hex.riverMask);
      }
    });

    // Layer 3 & 4: Overlays
    sortedHexes.forEach(({ hex, x, y }) => {
      if (!hex.overlay) return;
      const overlayDef = TERRAIN_REGISTRY[hex.overlay];
      if (!overlayDef) return;

      if (overlayDef.base && overlayDef.base.length > 0) {
        const url = overlayDef.base[hex.variation % overlayDef.base.length];
        const uv = atlasRef.current?.getUV(url);
        
        if (uv && atlasRef.current) {
          const drawWidth = uv.w * scale;
          const drawHeight = uv.h * scale;
          const offsetY = (overlayDef.offsetY || 0) * scale;
          ctx.drawImage(
            atlasRef.current.canvas,
            uv.x, uv.y, uv.w, uv.h,
            x - drawWidth / 2, y - drawHeight / 2 + offsetY, drawWidth, drawHeight
          );
        }
      } else {
        ctx.beginPath();
        ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = overlayDef.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    // Layer 5: Decorations
    sortedHexes.forEach(({ hex, x, y }) => {
      if (hex.decoration) {
        const decDef = DECORATION_REGISTRY[hex.decoration];
        if (decDef) {
          const url = decDef.base[hex.variation % decDef.base.length];
          const uv = atlasRef.current?.getUV(url);
          if (uv && atlasRef.current) {
            const drawWidth = uv.w * scale;
            const drawHeight = uv.h * scale;
            const offsetY = (decDef.offsetY || 0) * scale;
            ctx.drawImage(
              atlasRef.current.canvas,
              uv.x, uv.y, uv.w, uv.h,
              x - drawWidth / 2, y - drawHeight / 2 + offsetY, drawWidth, drawHeight
            );
          }
        }
      }
    });

    // Layer 6: Debug
    if (debug) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      sortedHexes.forEach(({ hex, x, y }) => {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = `${size * 0.25}px sans-serif`;
        ctx.fillText(`${hex.q},${hex.r}`, x, y - 8);
        ctx.fillText(`${hex.terrainCode} (v${hex.variation})`, x, y + 8);
        
        const matches = macroMatches.get(`${hex.q},${hex.r}`);
        if (matches && matches.length > 0) {
          ctx.fillStyle = '#fde047';
          ctx.fillText(`M: ${matches.map((m: any) => m.ruleId).join(',')}`, x, y - 24);
        }

        const masks: Map<string, number> = hex.transitionMasks;
        if (masks.size > 0) {
          ctx.font = `${size * 0.2}px sans-serif`;
          Array.from(masks.entries()).forEach(([t, m], idx) => {
            const bestMatch = findBestMaskCandidate(MOCK_AVAILABLE_MASKS, m);
            const isFallback = bestMatch !== m;
            const maskStr = m.toString(2).padStart(6, '0');
            const bestStr = bestMatch !== null ? bestMatch.toString(2).padStart(6, '0') : 'NONE';
            
            ctx.fillStyle = isFallback ? "#fca5a5" : "#86efac";
            ctx.fillText(`${t}: ${maskStr} ${isFallback ? `→ ${bestStr}` : '✓'}`, x, y + 20 + (idx * size * 0.3));
          });
        }
      });
    }

    ctx.restore();
    chunk.dirty = false;
  }, [size, debug, macroMatches]);

  // Main render loop
  const renderFrame = useCallback(() => {
    if (!canvasRef.current || !containerRef.current || !imagesLoaded) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const rect = containerRef.current.getBoundingClientRect();
    
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    }
    
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);
    
    const camera = cameraRef.current;
    
    // Viewport bounds in world space
    const viewLeft = -camera.x / camera.zoom;
    const viewRight = (rect.width - camera.x) / camera.zoom;
    const viewTop = -camera.y / camera.zoom;
    const viewBottom = (rect.height - camera.y) / camera.zoom;
    
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);
    
    let drawCalls = 0;
    
    chunksRef.current.forEach(chunk => {
      // Viewport culling
      if (
        chunk.bounds.maxX < viewLeft ||
        chunk.bounds.minX > viewRight ||
        chunk.bounds.maxY < viewTop ||
        chunk.bounds.minY > viewBottom
      ) {
        return; // Skip chunk
      }
      
      if (chunk.dirty) {
        renderChunk(chunk);
      }
      
      if (chunk.canvas) {
        ctx.drawImage(chunk.canvas, chunk.bounds.minX, chunk.bounds.minY);
        drawCalls++;
      }
    });
    
    ctx.restore();
    
    // Layer 5: UI / Pathfinding
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);

    // Draw Units
    units.forEach(unit => {
      const { x, y } = HexGrid.hexToPixel(unit.q, unit.r, size);
      const def = UNIT_REGISTRY[unit.typeId];
      if (def) {
        const uv = atlasRef.current?.getUV(def.sprite);
        const img = imageCache.current[def.sprite];
        
        // Draw selection ring if selected
        if (selectedUnitRef.current?.id === unit.id) {
          ctx.beginPath();
          ctx.ellipse(x, y + size * 0.3, size * 0.6, size * 0.3, 0, 0, Math.PI * 2);
          ctx.fillStyle = unit.faction === 0 ? 'rgba(59, 130, 246, 0.4)' : 'rgba(239, 68, 68, 0.4)';
          ctx.fill();
          ctx.strokeStyle = unit.faction === 0 ? '#3b82f6' : '#ef4444';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          // Draw faction ring
          ctx.beginPath();
          ctx.ellipse(x, y + size * 0.3, size * 0.5, size * 0.25, 0, 0, Math.PI * 2);
          ctx.strokeStyle = unit.faction === 0 ? 'rgba(59, 130, 246, 0.8)' : 'rgba(239, 68, 68, 0.8)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Draw sprite
        if (uv && atlasRef.current) {
          const drawWidth = uv.w * (size * 2 / 72);
          const drawHeight = uv.h * (size * 2 / 72);
          ctx.drawImage(
            atlasRef.current.canvas,
            uv.x, uv.y, uv.w, uv.h,
            x - drawWidth / 2, y - drawHeight / 2 - size * 0.2, drawWidth, drawHeight
          );
        } else if (img) {
          const drawWidth = img.width * (size * 2 / 72);
          const drawHeight = img.height * (size * 2 / 72);
          ctx.drawImage(img, x - drawWidth / 2, y - drawHeight / 2 - size * 0.2, drawWidth, drawHeight);
        }

        // Draw HP Bar
        const hpPercent = unit.hp / def.maxHp;
        const barWidth = size;
        const barHeight = 4;
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(x - barWidth / 2, y - size * 0.8, barWidth, barHeight);
        ctx.fillStyle = hpPercent > 0.5 ? '#22c55e' : hpPercent > 0.2 ? '#eab308' : '#ef4444';
        ctx.fillRect(x - barWidth / 2, y - size * 0.8, barWidth * hpPercent, barHeight);
      }
    });

    if (startHexRef.current && !selectedUnitRef.current) {
      const { x, y } = HexGrid.hexToPixel(startHexRef.current.q, startHexRef.current.r, size);
      ctx.beginPath();
      ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(59, 130, 246, 0.5)'; // Blue highlight
      ctx.fill();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    if (pathRef.current.length > 0) {
      ctx.beginPath();
      const start = HexGrid.hexToPixel(pathRef.current[0].q, pathRef.current[0].r, size);
      ctx.moveTo(start.x, start.y);
      
      for (let i = 1; i < pathRef.current.length; i++) {
        const p = HexGrid.hexToPixel(pathRef.current[i].q, pathRef.current[i].r, size);
        ctx.lineTo(p.x, p.y);
      }
      
      ctx.strokeStyle = '#facc15'; // Yellow path
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      
      // Draw dots on each step
      pathRef.current.forEach(cell => {
        const p = HexGrid.hexToPixel(cell.q, cell.r, size);
        ctx.beginPath();
        ctx.arc(p.x, p.y, size * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = '#facc15';
        ctx.fill();
      });
      
      // Highlight target
      const target = pathRef.current[pathRef.current.length - 1];
      const tp = HexGrid.hexToPixel(target.q, target.r, size);
      ctx.beginPath();
      ctx.arc(tp.x, tp.y, size * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(250, 204, 21, 0.3)';
      ctx.fill();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (hoverHexRef.current && hoverHexRef.current !== startHexRef.current) {
      // Just highlight hover
      const { x, y } = HexGrid.hexToPixel(hoverHexRef.current.q, hoverHexRef.current.r, size);
      drawHexPolygon(ctx, x, y, size, 'transparent');
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    ctx.restore();

    if (debug) {
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(5, 5, 250, 60);
      ctx.fillStyle = 'white';
      ctx.font = '12px monospace';
      ctx.fillText(`Draw Calls (Chunks): ${drawCalls} / ${chunksRef.current.size}`, 15, 25);
      ctx.fillText(`Camera: x=${Math.round(camera.x)}, y=${Math.round(camera.y)}, z=${camera.zoom.toFixed(2)}`, 15, 45);
      ctx.restore();
    }
  }, [imagesLoaded, renderChunk, debug]);

  // Animation loop
  useEffect(() => {
    let animationFrameId: number;
    
    const loop = () => {
      renderFrame();
      animationFrameId = requestAnimationFrame(loop);
    };
    
    loop();
    
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [renderFrame]);

  // Event handlers for panning and zooming
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    containerRef.current?.setAttribute('data-click-x', e.clientX.toString());
    containerRef.current?.setAttribute('data-click-y', e.clientY.toString());
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingRef.current) {
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      
      cameraRef.current.x += dx;
      cameraRef.current.y += dy;
      
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    }

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const worldX = (mouseX - cameraRef.current.x) / cameraRef.current.zoom;
      const worldY = (mouseY - cameraRef.current.y) / cameraRef.current.zoom;
      
      const { q, r } = HexGrid.pixelToHex(worldX, worldY, size);
      const hovered = grid.get(q, r) || null;
      
      if (hovered !== hoverHexRef.current) {
        hoverHexRef.current = hovered;
        if (startHexRef.current && hovered && startHexRef.current !== hovered && flowFieldRef.current) {
          const path = FlowField.getPath(flowFieldRef.current, hovered);
          
          // Filter path by unit movement points if a unit is selected
          if (selectedUnitRef.current) {
            const cost = flowFieldRef.current.costSoFar.get(hovered);
            if (cost !== undefined && cost <= selectedUnitRef.current.movementLeft) {
              pathRef.current = path;
            } else {
              pathRef.current = []; // Unreachable within movement points
            }
          } else {
            pathRef.current = path;
          }
        } else {
          pathRef.current = [];
        }
      }
    }
  };
  
  const handleMouseUp = (e: React.MouseEvent) => {
    isDraggingRef.current = false;
    
    const clickX = parseFloat(containerRef.current?.getAttribute('data-click-x') || '0');
    const clickY = parseFloat(containerRef.current?.getAttribute('data-click-y') || '0');
    
    if (Math.abs(e.clientX - clickX) < 5 && Math.abs(e.clientY - clickY) < 5) {
      if (hoverHexRef.current) {
        const clickedHex = hoverHexRef.current;
        const clickedUnit = units.find(u => u.q === clickedHex.q && u.r === clickedHex.r);

        if (clickedUnit) {
          if (selectedUnitRef.current && selectedUnitRef.current.faction !== clickedUnit.faction) {
            // Check if adjacent for attack
            const isAdjacent = HexGrid.hexDistance(selectedUnitRef.current.q, selectedUnitRef.current.r, clickedUnit.q, clickedUnit.r) === 1;
            if (isAdjacent && onUnitAttack) {
              onUnitAttack(selectedUnitRef.current.id, clickedUnit.id);
              pathRef.current = [];
            } else {
              // Select the clicked unit instead
              selectedUnitRef.current = clickedUnit;
              startHexRef.current = clickedHex;
              flowFieldRef.current = FlowField.calculate(grid, startHexRef.current);
              pathRef.current = [];
              if (onUnitSelect) onUnitSelect(clickedUnit);
            }
          } else {
            // Select unit
            selectedUnitRef.current = clickedUnit;
            startHexRef.current = clickedHex;
            flowFieldRef.current = FlowField.calculate(grid, startHexRef.current);
            pathRef.current = [];
            if (onUnitSelect) onUnitSelect(clickedUnit);
          }
        } else if (selectedUnitRef.current && pathRef.current.length > 0) {
          // Move unit
          if (onUnitMove) {
            const target = pathRef.current[pathRef.current.length - 1];
            const cost = flowFieldRef.current?.costSoFar.get(target) || 0;
            onUnitMove(selectedUnitRef.current.id, pathRef.current, cost);
          }
          // Deselect after move
          selectedUnitRef.current = null;
          startHexRef.current = null;
          flowFieldRef.current = null;
          pathRef.current = [];
          if (onUnitSelect) onUnitSelect(null);
        } else {
          // Normal hex click (no unit selected)
          selectedUnitRef.current = null;
          startHexRef.current = clickedHex;
          flowFieldRef.current = FlowField.calculate(grid, startHexRef.current);
          pathRef.current = []; // Reset path until mouse moves
          if (onUnitSelect) onUnitSelect(null);
        }
      } else {
        selectedUnitRef.current = null;
        startHexRef.current = null;
        flowFieldRef.current = null;
        pathRef.current = [];
        if (onUnitSelect) onUnitSelect(null);
      }
    }
  };

  const handleMouseLeave = () => {
    isDraggingRef.current = false;
    hoverHexRef.current = null;
    pathRef.current = [];
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      const zoomSensitivity = 0.001;
      const delta = -e.deltaY * zoomSensitivity;
      
      const newZoom = Math.max(0.1, Math.min(3, cameraRef.current.zoom * Math.exp(delta)));
      
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const zoomRatio = newZoom / cameraRef.current.zoom;
      
      cameraRef.current.x = mouseX - (mouseX - cameraRef.current.x) * zoomRatio;
      cameraRef.current.y = mouseY - (mouseY - cameraRef.current.y) * zoomRatio;
      cameraRef.current.zoom = newZoom;
    };
    
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full bg-slate-900 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {!imagesLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-10">
          <div className="text-white font-medium animate-pulse">Loading Terrain Assets...</div>
        </div>
      )}
      <canvas 
        ref={canvasRef} 
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}

function drawHexPolygon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(size / 2, size * Math.sqrt(3) / 2);
  ctx.lineTo(-size / 2, size * Math.sqrt(3) / 2);
  ctx.lineTo(-size, 0);
  ctx.lineTo(-size / 2, -size * Math.sqrt(3) / 2);
  ctx.lineTo(size / 2, -size * Math.sqrt(3) / 2);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawRiver(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, mask: number) {
  ctx.save();
  ctx.translate(x, y);
  
  // River style
  ctx.strokeStyle = '#0ea5e9'; // Bright blue
  ctx.lineWidth = size * 0.35;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const angles = [
    Math.PI / 6,        // 0: Right (30 deg)
    -Math.PI / 6,       // 1: Top Right (-30 deg)
    -Math.PI / 2,       // 2: Top Left (-90 deg)
    -5 * Math.PI / 6,   // 3: Left (-150 deg)
    5 * Math.PI / 6,    // 4: Bottom Left (150 deg)
    Math.PI / 2         // 5: Bottom Right (90 deg)
  ];

  const edgeDist = size * Math.sqrt(3) / 2;

  let connections = 0;
  for (let i = 0; i < 6; i++) {
    if ((mask & (1 << i)) !== 0) {
      connections++;
    }
  }

  ctx.beginPath();

  if (connections === 0) {
    // Isolated water source (spring or small lake)
    ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = '#0ea5e9';
    ctx.fill();
  } else if (connections === 1) {
    // End of river (spring or delta)
    for (let i = 0; i < 6; i++) {
      if ((mask & (1 << i)) !== 0) {
        ctx.moveTo(0, 0);
        const edgeX = Math.cos(angles[i]) * edgeDist;
        const edgeY = Math.sin(angles[i]) * edgeDist;
        ctx.lineTo(edgeX, edgeY);
      }
    }
    ctx.stroke();
    
    // Add a little pool at the center
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#0ea5e9';
    ctx.fill();
  } else if (connections === 2) {
    // Continuous river (straight or curve)
    let first = -1;
    for (let i = 0; i < 6; i++) {
      if ((mask & (1 << i)) !== 0) {
        if (first === -1) {
          first = i;
          const edgeX = Math.cos(angles[i]) * edgeDist;
          const edgeY = Math.sin(angles[i]) * edgeDist;
          ctx.moveTo(edgeX, edgeY);
          ctx.lineTo(0, 0);
        } else {
          const edgeX = Math.cos(angles[i]) * edgeDist;
          const edgeY = Math.sin(angles[i]) * edgeDist;
          ctx.lineTo(edgeX, edgeY);
        }
      }
    }
    ctx.stroke();
  } else {
    // Junction (3 or more connections)
    for (let i = 0; i < 6; i++) {
      if ((mask & (1 << i)) !== 0) {
        ctx.moveTo(0, 0);
        const edgeX = Math.cos(angles[i]) * edgeDist;
        const edgeY = Math.sin(angles[i]) * edgeDist;
        ctx.lineTo(edgeX, edgeY);
      }
    }
    ctx.stroke();
    
    // Add a small pool at the junction to smooth it out
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = '#0ea5e9';
    ctx.fill();
  }

  // Draw a subtle highlight for depth
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = size * 0.1;
  ctx.stroke();

  ctx.restore();
}
