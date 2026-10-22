/**
 * Tiny channel between the "Toss stickers" button and <HeroScene>, which owns the Draggable
 * stickers (they sit in different parts of the Hero's markup).
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function onTossStickers(listener: Listener): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function tossStickers(): void {
  listeners.forEach((listener) => listener());
}

/**
 * Folds a value back and forth inside [min, max], like a ball bouncing between two walls:
 * 0…span goes forward, span…2·span comes back. Used to turn a free inertia throw into a bounce.
 */
export function reflect(value: number, min: number, max: number): number {
  const span = max - min;
  if (span <= 0) return min;
  const period = span * 2;
  let t = (value - min) % period;
  if (t < 0) t += period;
  return min + (t > span ? period - t : t);
}
