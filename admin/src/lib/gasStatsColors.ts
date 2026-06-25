/** Rank-based hue: index 0 (highest cost/km) = red, last = green. */
export function gasStatRankColors(index: number, total: number): { bar: string; text: string; badge: string } {
  if (total <= 0) {
    return { bar: 'hsl(0, 0%, 70%)', text: 'hsl(0, 0%, 40%)', badge: 'hsl(0, 0%, 96%)' };
  }
  const t = total <= 1 ? 0 : index / (total - 1);
  const hue = 120 * t;
  return {
    bar: `hsl(${hue}, 72%, 48%)`,
    text: `hsl(${hue}, 78%, 32%)`,
    badge: `hsl(${hue}, 65%, 94%)`,
  };
}
