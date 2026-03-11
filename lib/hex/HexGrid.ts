export interface HexCoord {
  q: number;
  r: number;
}

export interface HexCell {
  terrainCode: string;
  q: number;
  r: number;
  neighbors: (HexCell | null)[];
  overlay: string | null;
  decoration?: string | null;
  transitionMasks: Map<string, number>;
  variation: number;
  height?: number;
  moisture?: number;
  temperature?: number;
  water?: number;
  flow?: HexCell | null;
  riverMask?: number;
}

export class HexGrid {
  private cells = new Map<string, HexCell>();

  private getKey(q: number, r: number): string {
    return `${q},${r}`;
  }

  set(q: number, r: number, cell: HexCell): void {
    this.cells.set(this.getKey(q, r), cell);
  }

  get(q: number, r: number): HexCell | undefined {
    return this.cells.get(this.getKey(q, r));
  }

  has(q: number, r: number): boolean {
    return this.cells.has(this.getKey(q, r));
  }

  delete(q: number, r: number): boolean {
    return this.cells.delete(this.getKey(q, r));
  }

  clear(): void {
    this.cells.clear();
  }

  values(): HexCell[] {
    return Array.from(this.cells.values());
  }

  getNeighbors(cell: HexCell): (HexCell | null)[] {
    const coords = HexGrid.getNeighborCoords(cell.q, cell.r);
    return coords.map(coord => this.get(coord.q, coord.r) || null);
  }
  
  // Flat-top hex math
  static hexToPixel(q: number, r: number, size: number): { x: number, y: number } {
    const x = size * (3/2 * q);
    const y = size * (Math.sqrt(3) * (r + q/2));
    return { x, y };
  }

  static pixelToHex(x: number, y: number, size: number): HexCoord {
    const q = (2/3 * x) / size;
    const r = (-1/3 * x + Math.sqrt(3)/3 * y) / size;
    return this.hexRound(q, r);
  }

  static hexRound(q: number, r: number): HexCoord {
    let s = -q - r;
    let rq = Math.round(q);
    let rr = Math.round(r);
    let rs = Math.round(s);

    const qDiff = Math.abs(rq - q);
    const rDiff = Math.abs(rr - r);
    const sDiff = Math.abs(rs - s);

    if (qDiff > rDiff && qDiff > sDiff) {
      rq = -rr - rs;
    } else if (rDiff > sDiff) {
      rr = -rq - rs;
    }
    return { q: rq, r: rr };
  }

  static getNeighbor(q: number, r: number, direction: number): HexCoord {
    const dir = [
      { q: 1, r: 0 },   // 0: Right
      { q: 1, r: -1 },  // 1: Top Right
      { q: 0, r: -1 },  // 2: Top Left
      { q: -1, r: 0 },  // 3: Left
      { q: -1, r: 1 },  // 4: Bottom Left
      { q: 0, r: 1 }    // 5: Bottom Right
    ][direction % 6];
    return { q: q + dir.q, r: r + dir.r };
  }

  static getNeighborCoords(q: number, r: number): HexCoord[] {
    return [
      { q: 1, r: 0 },
      { q: 1, r: -1 },
      { q: 0, r: -1 },
      { q: -1, r: 0 },
      { q: -1, r: 1 },
      { q: 0, r: 1 }
    ].map(dir => ({ q: q + dir.q, r: r + dir.r }));
  }

  static hexDistance(q1: number, r1: number, q2: number, r2: number): number {
    const s1 = -q1 - r1;
    const s2 = -q2 - r2;
    return Math.max(Math.abs(q1 - q2), Math.abs(r1 - r2), Math.abs(s1 - s2));
  }
}
