// lib/autotile/selectSprite.ts

// popcount helper
function popcount(n: number) {
  return n.toString(2).replace(/0/g, '').length;
}

/**
 * findBestMaskCandidate(availableMasks[], targetMask)
 * - heurístico: prioriza igualdad, luego máxima intersección (más bits en común),
 *   penaliza bits extra en candidate (evita draws que añadan bordes no deseados)
 */
export function findBestMaskCandidate(availableMasks: number[], targetMask: number): number | null {
  if (availableMasks.length === 0) return null;
  // exact match
  if (availableMasks.includes(targetMask)) return targetMask;

  let best: number | null = null;
  let bestScore = -Infinity;

  for (const cand of availableMasks) {
    const common = popcount(cand & targetMask);
    const extras = popcount(cand & ~targetMask);
    const misses = popcount(targetMask & ~cand);
    // score: reward common, penalize extras and misses (weights tunables)
    const score = common * 2 - extras * 1 - misses * 1.5;
    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  }
  return best;
}

/**
 * selectTransitionSprite
 * - atlasMeta: como en el esquema anterior
 * - from, to: terrain codes (ex: "Gg","Ww")
 * - mask: número 0..63
 */
export function selectTransitionSprite(atlasMeta: any, from: string, to: string, mask: number) {
  const entry = atlasMeta.entries?.[from];
  if (!entry) return null;

  const transitions = entry.transitions?.[to];
  if (!transitions) return null;

  // available masks as numbers
  const availableMasks = Object.keys(transitions).map(k => parseInt(k, 10)).filter(n => !isNaN(n));

  // exact
  if (transitions[mask]) return transitions[mask];

  const best = findBestMaskCandidate(availableMasks, mask);
  return best !== null ? transitions[best] : null;
}
