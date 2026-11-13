export type Band = { top: number; bottom: number };

/**
 * Maps a document position to a scene value. Each section holds its own scene while the
 * position is well inside it and blends linearly to the next one across the boundary.
 */
export function sceneAt(center: number, bands: readonly Band[], viewport: number): number {
  let previousEnd = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    if (!band) continue;
    const margin = Math.max(0, Math.min(viewport * 0.3, (band.bottom - band.top) * 0.25));
    const start = index === 0 ? Number.NEGATIVE_INFINITY : band.top + margin;
    const end = index === bands.length - 1 ? Number.POSITIVE_INFINITY : band.bottom - margin;
    if (center < start) {
      const span = start - previousEnd;
      return index - 1 + (span > 0 ? (center - previousEnd) / span : 1);
    }
    if (center <= end) return index;
    previousEnd = end;
  }
  return Math.max(0, bands.length - 1);
}

/** Progress from 0 to 1 while a section taller than the viewport stays pinned. */
export function pinProgress(scroll: number, top: number, height: number, viewport: number): number {
  const distance = height - viewport;
  if (distance <= 0) return scroll >= top ? 1 : 0;
  return Math.min(1, Math.max(0, (scroll - top) / distance));
}
