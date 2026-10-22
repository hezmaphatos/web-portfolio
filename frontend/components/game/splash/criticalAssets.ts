import { useGameStore } from "@/lib/store";

/**
 * Real loading progress for the splash (spec §5.1 point 4): the share of critical assets that are
 * ready, 0…1. Only what the first screen needs — never the whole page:
 * - the page payload (HTML + RSC data): already in, we are running hydrated code;
 * - GSAP: lib/gsap.ts registered its plugins when it was imported;
 * - the save file: the cookie has been read into the game store;
 * - fonts: document.fonts.ready;
 * - the Hero image (the LCP candidate), when the Hero has one.
 */
type Task = { weight: number; done: boolean };

export function watchCriticalAssets(): { fraction: () => number; dispose: () => void } {
  const tasks: Record<string, Task> = {
    payload: { weight: 1, done: true },
    gsap: { weight: 1, done: true },
    save: { weight: 1, done: useGameStore.getState().hydrated },
    fonts: { weight: 3, done: !document.fonts },
  };

  const unsubscribe = useGameStore.subscribe((state) => {
    if (state.hydrated) tasks.save.done = true;
  });

  void document.fonts?.ready.then(() => {
    tasks.fonts.done = true;
  });

  const heroImage = document.querySelector<HTMLImageElement>('[data-chapter="hero"] img');
  if (heroImage) {
    const image: Task = { weight: 3, done: heroImage.complete && heroImage.naturalWidth > 0 };
    tasks.image = image;
    // decode() resolves once the image can be painted; a broken image still counts as "done".
    if (!image.done) {
      heroImage
        .decode()
        .catch(() => undefined)
        .finally(() => {
          image.done = true;
        });
    }
  }

  return {
    fraction: () => {
      let total = 0;
      let done = 0;
      for (const task of Object.values(tasks)) {
        total += task.weight;
        if (task.done) done += task.weight;
      }
      return total === 0 ? 1 : done / total;
    },
    dispose: unsubscribe,
  };
}
