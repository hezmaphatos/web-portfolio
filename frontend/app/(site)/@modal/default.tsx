/**
 * The @modal slot after a hard load (direct URL, refresh): Next can't restore a modal that was
 * opened by a client-side navigation, so the slot renders nothing and the full page shows.
 * The Stage modal itself is the intercepting route ./(.)projects/[slug].
 */
export default function NoModal() {
  return null;
}
