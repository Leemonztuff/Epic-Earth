'use client';

import React, { useState, useMemo } from 'react';
import { TERRAIN_REGISTRY } from '../lib/terrain/TerrainRegistry';
import { HexGridRenderer } from '../components/HexGridRenderer';
import { MapGenerator } from '../lib/terrain/MapGenerator';
import { TerrainResolver } from '../lib/terrain/TerrainResolver';
import { TransitionResolver } from '../lib/terrain/TransitionResolver';
import { OverlayResolver } from '../lib/terrain/OverlayResolver';
import { HexGrid, HexCell } from '../lib/hex/HexGrid';
import { UnitInstance, UNIT_REGISTRY } from '../lib/units/UnitRegistry';

export default function Page() {
  const [seed, setSeed] = useState(Math.floor(Math.random() * 10000));
  const [debug, setDebug] = useState(false);
  const [units, setUnits] = useState<UnitInstance[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  const selectedUnit = units.find(u => u.id === selectedUnitId) || null;

  const mapData = useMemo(() => {
    const grid = MapGenerator.generate({ width: 30, height: 20, seed });
    TerrainResolver.resolve(grid);
    TransitionResolver.resolve(grid);
    OverlayResolver.resolve(grid);
    
    // Spawn some initial units
    const initialUnits: UnitInstance[] = [];
    let playerSpawned = false;
    let enemySpawned = false;

    // Simple spawn logic: find valid grass hexes
    for (const cell of grid.values()) {
      if (cell.terrainCode === 'Gg' && !cell.overlay) {
        if (!playerSpawned && cell.q < 10) {
          initialUnits.push({
            id: 'unit-1',
            typeId: 'elvish-fighter',
            q: cell.q,
            r: cell.r,
            hp: UNIT_REGISTRY['elvish-fighter'].maxHp,
            movementLeft: UNIT_REGISTRY['elvish-fighter'].maxMovement,
            faction: 0
          });
          playerSpawned = true;
        } else if (!enemySpawned && cell.q > 20) {
          initialUnits.push({
            id: 'unit-2',
            typeId: 'orcish-grunt',
            q: cell.q,
            r: cell.r,
            hp: UNIT_REGISTRY['orcish-grunt'].maxHp,
            movementLeft: UNIT_REGISTRY['orcish-grunt'].maxMovement,
            faction: 1
          });
          enemySpawned = true;
        }
      }
      if (playerSpawned && enemySpawned) break;
    }

    setUnits(initialUnits);

    return { grid };
  }, [seed]);

  const { grid } = mapData;

  const handleUnitMove = (unitId: string, path: HexCell[], cost: number) => {
    if (path.length === 0) return;
    
    setUnits(prev => prev.map(u => {
      if (u.id === unitId) {
        const target = path[path.length - 1];
        return {
          ...u,
          q: target.q,
          r: target.r,
          movementLeft: Math.max(0, u.movementLeft - cost)
        };
      }
      return u;
    }));
  };

  const handleUnitAttack = (attackerId: string, defenderId: string) => {
    setUnits(prev => {
      const attacker = prev.find(u => u.id === attackerId);
      const defender = prev.find(u => u.id === defenderId);
      if (!attacker || !defender) return prev;

      const attackerDef = UNIT_REGISTRY[attacker.typeId];
      // Simplified combat: just use the first attack and deal its damage
      const attack = attackerDef.attacks[0]; 
      const damage = attack ? attack.damage * attack.strikes : 5; // Simple math for now

      return prev.map(u => {
        if (u.id === defenderId) {
          return { ...u, hp: Math.max(0, u.hp - damage) };
        }
        if (u.id === attackerId) {
          return { ...u, movementLeft: 0 }; // Attacking ends turn
        }
        return u;
      }).filter(u => u.hp > 0); // Remove dead units
    });
  };

  const endTurn = () => {
    setUnits(prev => prev.map(u => ({
      ...u,
      movementLeft: UNIT_REGISTRY[u.typeId].maxMovement
    })));
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-2">Wesnoth-style Terrain Engine</h1>
            <p className="text-slate-400">Procedural Biome Generation with Autotiling.</p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => setDebug(!debug)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
            >
              {debug ? 'Hide Debug' : 'Show Debug'}
            </button>
            <button 
              onClick={endTurn}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition-colors"
            >
              End Turn
            </button>
            <button 
              onClick={() => setSeed(Math.floor(Math.random() * 10000))}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors"
            >
              Generate New Map
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 aspect-square lg:aspect-video bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
            <HexGridRenderer 
              grid={grid} 
              size={30} 
              debug={debug} 
              units={units}
              onUnitMove={handleUnitMove}
              onUnitSelect={(u) => setSelectedUnitId(u?.id || null)}
              onUnitAttack={handleUnitAttack}
            />
          </div>

          <div className="space-y-6">
            {selectedUnit ? (
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-700 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={UNIT_REGISTRY[selectedUnit.typeId].sprite} 
                      alt={UNIT_REGISTRY[selectedUnit.typeId].name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-100">{UNIT_REGISTRY[selectedUnit.typeId].name}</h2>
                    <p className="text-sm text-slate-400 capitalize">{UNIT_REGISTRY[selectedUnit.typeId].alignment} • Faction {selectedUnit.faction + 1}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-400">HP</span>
                      <span className="font-mono text-slate-200">{selectedUnit.hp} / {UNIT_REGISTRY[selectedUnit.typeId].maxHp}</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${selectedUnit.hp / UNIT_REGISTRY[selectedUnit.typeId].maxHp > 0.5 ? 'bg-emerald-500' : 'bg-red-500'}`}
                        style={{ width: `${(selectedUnit.hp / UNIT_REGISTRY[selectedUnit.typeId].maxHp) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-400">Movement</span>
                      <span className="font-mono text-slate-200">{selectedUnit.movementLeft} / {UNIT_REGISTRY[selectedUnit.typeId].maxMovement}</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${(selectedUnit.movementLeft / UNIT_REGISTRY[selectedUnit.typeId].maxMovement) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800">
                    <h3 className="text-sm font-medium text-slate-400 mb-3">Attacks</h3>
                    <div className="space-y-2">
                      {UNIT_REGISTRY[selectedUnit.typeId].attacks.map((attack, i) => (
                        <div key={i} className="flex justify-between items-center bg-slate-800/50 p-2 rounded border border-slate-700/50">
                          <span className="text-sm capitalize text-slate-300">{attack.name}</span>
                          <span className="font-mono text-sm text-slate-400">
                            <span className="text-slate-200">{attack.damage}</span><span className="text-slate-500">x</span><span className="text-slate-200">{attack.strikes}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/50 rounded-2xl border border-slate-800/50 p-6 shadow-xl flex flex-col items-center justify-center text-center h-48">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                </div>
                <p className="text-slate-400 text-sm">Select a unit to view details</p>
              </div>
            )}

            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
              <h2 className="text-xl font-semibold mb-4">Terrain Registry</h2>
              <div className="space-y-3">
                {Object.values(TERRAIN_REGISTRY).map(t => (
                  <div key={t.id} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-md shadow-sm" style={{ backgroundColor: t.color }} />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{t.name}</div>
                      <div className="text-xs text-slate-500">Z-Index: {t.zIndex} {t.isOverlay && '(Overlay)'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
              <h2 className="text-xl font-semibold mb-4">Features</h2>
              <ul className="space-y-2 text-sm text-slate-400 list-disc list-inside">
                <li>Procedural Biomes (Noise)</li>
                <li>Terrain Clustering</li>
                <li>Overlapping Sprites</li>
                <li>Z-Index Autotiling</li>
                <li>Macro Rules (WML)</li>
              </ul>
            </div>

            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
              <h2 className="text-xl font-semibold mb-4">Debug Legend</h2>
              <div className="space-y-3 text-sm text-slate-400">
                <p><strong>0,0</strong>: Axial Coordinates (q, r)</p>
                <p><strong>Gg (v0)</strong>: Terrain Code & Variation</p>
                <div className="mt-2 pt-2 border-t border-slate-800">
                  <p className="mb-1 font-medium text-slate-300">Transition Masks:</p>
                  <p><span className="text-[#86efac]">Ww: 000011 ✓</span><br/>Exact mask found in atlas.</p>
                  <p className="mt-1"><span className="text-[#fca5a5]">Re: 001000 → 000000</span><br/>Fallback mask selected (simulated atlas).</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
