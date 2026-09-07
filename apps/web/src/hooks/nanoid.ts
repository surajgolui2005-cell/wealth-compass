/**
 * Lightweight nanoid-compatible unique ID generator.
 * Avoids adding the `nanoid` npm package for a 2-line utility.
 */
export function nanoid(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}
