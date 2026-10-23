import { describe, it, expect } from 'vitest';
import { extractSetting, pickSceneReference, type RenderRecord } from '../src/lib/scenes';

const FIELD =
  'a vast flat barren field outside Gourga village, northern Burkina Faso, around 1980: pale white-grey sealed soil crust with polygonal cracks, scattered dead thorn scrub, a few distant leafless trees';
const PITS =
  'a barren field outside Gourga, northern Burkina Faso: pale cracked soil crust now dotted with neat grid rows of round planting pits about 30 cm wide, each filled with dark dried manure';
const MARKET =
  'a busy open-air market in Ouahigouya, Burkina Faso, late 1970s: wooden stalls under corrugated-iron and woven-straw shades, dusty red laterite ground';

function prompt(setting: string, extra = 'Close-up of a man.'): string {
  return `Cinematic film still. ${extra} Characters: [A MAN]. Setting: ${setting}. Lighting: harsh sun. Avoid: any text.`;
}

function render(number: number, setting: string): RenderRecord {
  return {
    number,
    text: prompt(setting),
    mediaKey: `https://cdn.example.com/img/${number}`,
  };
}

describe('extractSetting', () => {
  it('pulls the Setting clause out of a structured prompt', () => {
    expect(extractSetting(prompt(MARKET))).toBe(MARKET);
  });

  it('returns an empty string when there is no Setting clause', () => {
    expect(extractSetting('A plain prompt with nothing labelled.')).toBe('');
  });

  it('stops at the next labelled section even without a trailing dot', () => {
    expect(extractSetting('Setting: a quiet beach Lighting: dusk')).toBe('a quiet beach');
  });
});

describe('pickSceneReference', () => {
  it('reuses an earlier render of the same setting', () => {
    const earlier = [render(1, FIELD), render(3, MARKET)];
    const pick = pickSceneReference(prompt(FIELD, 'Wide shot.'), earlier);
    expect(pick?.number).toBe(1);
  });

  it('does not reuse a render of a different setting', () => {
    const earlier = [render(1, FIELD), render(3, MARKET)];
    expect(pickSceneReference(prompt(PITS), earlier)).toBeNull();
  });

  it('returns null when nothing has been generated yet', () => {
    expect(pickSceneReference(prompt(FIELD), [])).toBeNull();
  });

  it('prefers the earliest of several equally good matches, as the scene anchor', () => {
    const earlier = [render(1, FIELD), render(2, FIELD), render(5, FIELD)];
    expect(pickSceneReference(prompt(FIELD), earlier)?.number).toBe(1);
  });

  it('prefers the closest match over an earlier looser one', () => {
    const looser = FIELD + ', plus an extra detail about a well and a granary and a goat';
    const earlier = [render(1, looser), render(2, FIELD)];
    expect(pickSceneReference(prompt(FIELD), earlier)?.number).toBe(2);
  });

  it('uses the most recent render when the prompt says it is the same place', () => {
    const earlier = [render(1, FIELD), render(2, MARKET)];
    const text = 'Back in the same location as before, a man sits down. Setting: somewhere else entirely.';
    expect(pickSceneReference(text, earlier)?.number).toBe(2);
  });

  it('ignores a prompt with no setting and no continuity cue', () => {
    expect(pickSceneReference('A man walks.', [render(1, FIELD)])).toBeNull();
  });

  it('never picks a render with no usable image key', () => {
    const earlier: RenderRecord[] = [{ number: 1, text: prompt(FIELD), mediaKey: '' }];
    expect(pickSceneReference(prompt(FIELD), earlier)).toBeNull();
  });
});

describe('pickSceneReference within a scene block', () => {
  const inScene = (number: number, scene: string): RenderRecord => ({
    number,
    text: 'A shot with no setting line at all.',
    mediaKey: `https://cdn.example.com/img/${number}`,
    scene,
  });

  it('anchors on the first render of the same scene, with no setting text at all', () => {
    const earlier = [inScene(1, 'SCENE 1'), inScene(2, 'SCENE 1'), inScene(3, 'SCENE 2')];
    expect(pickSceneReference('Another shot, nothing labelled.', earlier, 'SCENE 1')?.number).toBe(1);
  });

  it('never borrows a render from a different scene', () => {
    const earlier = [inScene(3, 'SCENE 2')];
    expect(pickSceneReference('Another shot, nothing labelled.', earlier, 'SCENE 1')).toBeNull();
  });

  it('falls back to the setting match when the scene has no render yet', () => {
    const earlier = [render(1, FIELD)];
    expect(pickSceneReference(prompt(FIELD), earlier, 'SCENE 9')?.number).toBe(1);
  });
});
