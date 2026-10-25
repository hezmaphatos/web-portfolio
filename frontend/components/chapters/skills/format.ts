/** Cooldown label: 4000 → "4.0 s". */
export function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}
