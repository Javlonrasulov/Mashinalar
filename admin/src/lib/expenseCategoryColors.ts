const SLUG_COLORS: Record<string, string> = {
  FUEL: '#f59e0b',
  REPAIR: '#3b82f6',
  OIL: '#8b5cf6',
  OTHER: '#64748b',
};

const PALETTE = ['#2563eb', '#0d9488', '#d97706', '#7c3aed', '#db2777', '#059669', '#4f46e5', '#b45309'];

export function colorForCategory(slug: string, index: number): string {
  return SLUG_COLORS[slug] ?? PALETTE[index % PALETTE.length];
}
