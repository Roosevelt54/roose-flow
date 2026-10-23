export interface RenderRecord {
  /** Shot or queue number the render was generated for. */
  number: number;
  text: string;
  /** Host and path of the generated image (see mediaKey), used to find its tile in Flow. */
  mediaKey: string;
  /** The scene block this shot belonged to, when the prompt file has them. */
  scene?: string;
}

/** Share of setting words two prompts must have in common to count as the same place. */
const SAME_SCENE_THRESHOLD = 0.7;

const CONTINUITY_CUE =
  /\b(same (?:location|place|room|spot|setting|scene)|back (?:at|in|to) the same|returns? to the same)\b/i;

const STOPWORDS = new Set([
  'the', 'and', 'with', 'for', 'from', 'into', 'onto', 'over', 'under', 'around', 'near',
  'that', 'this', 'its', 'are', 'was', 'has', 'have', 'each', 'some', 'few',
]);

/**
 * The part of a prompt that names the place, taken from its "Setting:" label
 * up to the next label. Empty when the prompt has no such label: without it
 * there is no reliable signal for which environment a prompt is in.
 */
export function extractSetting(text: string): string {
  const match = text.match(
    /\bSetting:\s*([\s\S]*?)(?=\.?\s*(?:Lighting|Avoid|Characters|Camera|Style|Motion|Narration):|$)/i
  );
  return match ? match[1].trim().replace(/\.$/, '') : '';
}

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOPWORDS.has(word))
  );
}

function similarity(a: string, b: string): number {
  const left = tokens(a);
  const right = tokens(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared++;
  return shared / (left.size + right.size - shared);
}

/**
 * Decides whether an earlier render should go on this prompt as a scene
 * reference, and which one.
 *
 * A prompt that says it is the same place ("same location", "back in the same
 * room") gets the most recent render. Otherwise the prompt's setting is
 * compared with each earlier render's, and the closest match above the
 * threshold wins; of equally close ones the earliest is kept, so every shot in
 * a location is anchored to the same establishing image rather than drifting
 * through a chain of copies.
 */
export function pickSceneReference(
  text: string,
  earlier: RenderRecord[],
  scene?: string
): RenderRecord | null {
  const usable = earlier.filter((r) => r.mediaKey);
  if (usable.length === 0) return null;

  // A file that groups its shots into scenes has already said which shots share
  // a place. That is stronger evidence than anything read out of the wording,
  // so the first image made for the scene is its establishing reference.
  if (scene) {
    const sameScene = usable.find((r) => r.scene === scene);
    if (sameScene) return sameScene;
  }

  if (CONTINUITY_CUE.test(text)) return usable[usable.length - 1];

  const setting = extractSetting(text);
  if (!setting) return null;

  let best: RenderRecord | null = null;
  let bestScore = 0;
  for (const record of usable) {
    const score = similarity(setting, extractSetting(record.text));
    if (score >= SAME_SCENE_THRESHOLD && score > bestScore) {
      best = record;
      bestScore = score;
    }
  }
  return best;
}
