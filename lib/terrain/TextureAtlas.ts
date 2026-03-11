export interface UVRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class TextureAtlas {
  canvas: HTMLCanvasElement;
  uvs: Record<string, UVRect> = {};

  constructor(images: Record<string, HTMLImageElement>, padding: number = 2) {
    this.canvas = document.createElement('canvas');
    
    // Simple shelf packing algorithm
    let currentX = 0;
    let currentY = 0;
    let rowHeight = 0;
    let maxWidth = 2048; // Max atlas width

    // First pass: determine required height
    const entries = Object.entries(images);
    for (const [url, img] of entries) {
      if (currentX + img.width + padding > maxWidth) {
        currentX = 0;
        currentY += rowHeight + padding;
        rowHeight = 0;
      }
      rowHeight = Math.max(rowHeight, img.height);
      currentX += img.width + padding;
    }

    this.canvas.width = maxWidth;
    this.canvas.height = currentY + rowHeight + padding;

    const ctx = this.canvas.getContext('2d', { alpha: true, willReadFrequently: false });
    if (!ctx) throw new Error("Could not create atlas context");

    // Second pass: draw images and record UVs
    currentX = 0;
    currentY = 0;
    rowHeight = 0;

    for (const [url, img] of entries) {
      if (currentX + img.width + padding > maxWidth) {
        currentX = 0;
        currentY += rowHeight + padding;
        rowHeight = 0;
      }

      ctx.drawImage(img, currentX, currentY);
      
      this.uvs[url] = {
        x: currentX,
        y: currentY,
        w: img.width,
        h: img.height
      };

      rowHeight = Math.max(rowHeight, img.height);
      currentX += img.width + padding;
    }
  }

  getUV(url: string): UVRect | null {
    return this.uvs[url] || null;
  }
}
