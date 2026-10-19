/** `n` with the right form of "Route": "1 Route", "2 Routes". */
export function formatRouteCount(n: number): string {
  return `${n} ${n === 1 ? 'Route' : 'Routes'}`;
}
