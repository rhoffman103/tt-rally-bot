/** "Third ball attack" → "third-ball-attack.json". */
export function fileName(drillName: string, extension: 'json' | 'txt'): string {
  const base = drillName
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'drill'}.${extension}`;
}
