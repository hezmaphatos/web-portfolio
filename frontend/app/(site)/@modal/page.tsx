/**
 * The @modal slot on Home ("/"). A client-side navigation keeps a parallel slot's last state
 * when the new URL has no match in it, so without this page a link from the Stage modal to
 * Home (e.g. a tech chip → /#skills) would leave the modal open. Matching "/" with nothing
 * closes it. (Hard loads use default.tsx.)
 */
export default function NoModalOnHome() {
  return null;
}
