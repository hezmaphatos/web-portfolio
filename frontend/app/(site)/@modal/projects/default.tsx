/**
 * Hard load of /projects/[slug] (direct URL, refresh): this slot has a `projects` folder but no
 * `[slug]` in it, so it falls back here — nothing; the full page renders in `children`.
 */
export default function NoModal() {
  return null;
}
