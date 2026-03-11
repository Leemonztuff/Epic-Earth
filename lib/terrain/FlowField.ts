import { HexGrid, HexCell } from '../hex/HexGrid';
import { TERRAIN_REGISTRY } from './TerrainRegistry';

export interface FlowFieldResult {
  origin: HexCell;
  cameFrom: Map<HexCell, HexCell | null>;
  costSoFar: Map<HexCell, number>;
}

class PriorityQueue<T> {
  private elements: { item: T; priority: number }[] = [];

  enqueue(item: T, priority: number) {
    this.elements.push({ item, priority });
    this.bubbleUp(this.elements.length - 1);
  }

  dequeue(): T | undefined {
    if (this.elements.length === 0) return undefined;
    const result = this.elements[0].item;
    const end = this.elements.pop();
    if (this.elements.length > 0 && end) {
      this.elements[0] = end;
      this.sinkDown(0);
    }
    return result;
  }

  isEmpty() {
    return this.elements.length === 0;
  }

  private bubbleUp(n: number) {
    const element = this.elements[n];
    while (n > 0) {
      const parentN = Math.floor((n - 1) / 2);
      const parent = this.elements[parentN];
      if (element.priority >= parent.priority) break;
      this.elements[parentN] = element;
      this.elements[n] = parent;
      n = parentN;
    }
  }

  private sinkDown(n: number) {
    const length = this.elements.length;
    const element = this.elements[n];
    while (true) {
      const leftChildN = 2 * n + 1;
      const rightChildN = 2 * n + 2;
      let leftChild, rightChild;
      let swap = null;

      if (leftChildN < length) {
        leftChild = this.elements[leftChildN];
        if (leftChild.priority < element.priority) {
          swap = leftChildN;
        }
      }
      if (rightChildN < length) {
        rightChild = this.elements[rightChildN];
        if (
          (swap === null && rightChild.priority < element.priority) ||
          (swap !== null && leftChild && rightChild.priority < leftChild.priority)
        ) {
          swap = rightChildN;
        }
      }
      if (swap === null) break;
      this.elements[n] = this.elements[swap];
      this.elements[swap] = element;
      n = swap;
    }
  }
}

export class FlowField {
  static getCost(cell: HexCell): number {
    let cost = TERRAIN_REGISTRY[cell.terrainCode]?.movementCost || 1;
    if (cell.overlay) {
      const overlayCost = TERRAIN_REGISTRY[cell.overlay]?.movementCost;
      if (overlayCost !== undefined) {
        cost = Math.max(cost, overlayCost);
      }
    }
    return cost;
  }

  static calculate(grid: HexGrid, start: HexCell): FlowFieldResult {
    const frontier = new PriorityQueue<HexCell>();
    frontier.enqueue(start, 0);

    const cameFrom = new Map<HexCell, HexCell | null>();
    const costSoFar = new Map<HexCell, number>();

    cameFrom.set(start, null);
    costSoFar.set(start, 0);

    while (!frontier.isEmpty()) {
      const current = frontier.dequeue()!;

      for (const neighbor of current.neighbors) {
        if (!neighbor) continue;

        const cost = this.getCost(neighbor);
        if (cost >= 99) continue; // Impassable

        const newCost = costSoFar.get(current)! + cost;

        if (!costSoFar.has(neighbor) || newCost < costSoFar.get(neighbor)!) {
          costSoFar.set(neighbor, newCost);
          frontier.enqueue(neighbor, newCost);
          cameFrom.set(neighbor, current);
        }
      }
    }

    return { origin: start, cameFrom, costSoFar };
  }

  static getPath(field: FlowFieldResult, destination: HexCell): HexCell[] {
    if (destination === field.origin) {
      return [];
    }
    
    if (!field.cameFrom.has(destination)) {
      return []; // Unreachable
    }

    const path: HexCell[] = [];
    let current: HexCell | null = destination;

    while (current && current !== field.origin) {
      path.push(current);
      current = field.cameFrom.get(current) || null;
    }

    if (current === field.origin) {
      path.push(field.origin);
      return path.reverse();
    }

    return [];
  }
}
