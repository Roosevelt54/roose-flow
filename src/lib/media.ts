/**
 * Stable identity for an image, independent of how it happens to be signed
 * or sized right now.
 *
 * Flow's images come from signed storage URLs, and the Signature= value
 * changes between sightings of the very same image (seen directly in a
 * capture: two sightings of one render, identical apart from the signature).
 * Comparing exact URLs therefore made any already-present image that got
 * re-signed look brand new, so it was accepted as the render for the current
 * prompt - the run moved on far too early and the real image was never
 * waited for. Identity is host + path, with the query string, fragment and
 * Google CDN "=s1600" size suffix removed. blob: and data: URLs are already
 * unique and stable, so they are used as they are.
 */
export function mediaKey(url: string): string {
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  try {
    const parsed = new URL(url);
    return (parsed.origin + parsed.pathname).replace(/=[sw]\d+[^/]*$/, '');
  } catch {
    return url.split(/[?#]/)[0];
  }
}
