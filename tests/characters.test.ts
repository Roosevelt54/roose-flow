import { describe, it, expect } from 'vitest';
import { matchCharacters, type CharacterEntry } from '../src/lib/characters';

/** Convenience for tests where the trigger is the same as the tile name. */
const entry = (name: string, trigger?: string): CharacterEntry => ({
  name,
  trigger: trigger ?? name,
});

describe('matchCharacters', () => {
  it('matches a character whose trigger text is mentioned in the prompt', () => {
    expect(matchCharacters('Sun Jing Woo enters the room', [entry('Sun Jing Woo')])).toEqual([
      'Sun Jing Woo',
    ]);
  });

  it('matches case-insensitively, since prompts often write names in caps', () => {
    expect(matchCharacters('TESSA MONROE looks up', [entry('Tessa Monroe')])).toEqual([
      'Tessa Monroe',
    ]);
  });

  it('returns the tile name when the trigger spelling differs from it', () => {
    // Tile is renamed "Sun Jing Woo" on Flow, but prompts spell it "SUNG JIN WOO" -
    // the whole reason name and trigger are separate fields.
    const result = matchCharacters(
      "SUNG JIN WOO's arm reaches out",
      [entry('Sun Jing Woo', 'Sung Jin Woo')]
    );
    expect(result).toEqual(['Sun Jing Woo']);
  });

  it('returns nothing when no trigger text appears', () => {
    expect(matchCharacters('a quiet street at dusk', [entry('Tessa Monroe')])).toEqual([]);
  });

  it('returns an empty array for an empty character list', () => {
    expect(matchCharacters('Tessa Monroe walks in', [])).toEqual([]);
  });

  it('matches every distinct character mentioned in one prompt', () => {
    const result = matchCharacters(
      'TESSA MONROE and KIM JI-HO sit on the railing',
      [entry('Tessa Monroe'), entry('Kim Ji-Ho'), entry('Park Sora')]
    );
    expect(result).toEqual(expect.arrayContaining(['Tessa Monroe', 'Kim Ji-Ho']));
    expect(result).not.toContain('Park Sora');
    expect(result).toHaveLength(2);
  });

  it('counts a shorter trigger only once when it is contained in a longer match', () => {
    // "Woo" alone must not also fire because "Sun Jing Woo" already covered it.
    const result = matchCharacters('Sun Jing Woo walks past', [
      entry('Sun Jing Woo'),
      entry('Woo (nickname)', 'Woo'),
    ]);
    expect(result).toEqual(['Sun Jing Woo']);
  });

  it('still matches a shorter trigger on its own mention, independent of a longer one', () => {
    const result = matchCharacters(
      'Woo waits by the door while Sun Jing Woo argues inside',
      [entry('Sun Jing Woo'), entry('Woo (nickname)', 'Woo')]
    );
    expect(result).toEqual(expect.arrayContaining(['Sun Jing Woo', 'Woo (nickname)']));
  });

  it('treats a shorter tile name that is part of a longer matched one as the same character', () => {
    // Both entries name the same person; "CHINAZA" appearing again later in the
    // prompt must not send the extension looking for a second tile.
    const result = matchCharacters('CHINAZA NWOSU stands at the desk. Later CHINAZA looks up.', [
      entry('CHINAZA NWOSU'),
      entry('CHINAZA'),
    ]);
    expect(result).toEqual(['CHINAZA NWOSU']);
  });

  it('keeps the shorter entry when the longer one is not mentioned', () => {
    const result = matchCharacters('CHINAZA looks up.', [entry('CHINAZA NWOSU'), entry('CHINAZA')]);
    expect(result).toEqual(['CHINAZA']);
  });

  it('does not merge names that only share letters, not whole words', () => {
    const result = matchCharacters('Ann and Joanna talk', [entry('Joanna'), entry('Ann')]);
    expect(result).toEqual(expect.arrayContaining(['Joanna', 'Ann']));
  });

  it('falls back to the tile name as the trigger when trigger is blank', () => {
    expect(
      matchCharacters('Tessa Monroe walks in', [{ name: 'Tessa Monroe', trigger: '' }])
    ).toEqual(['Tessa Monroe']);
  });

  it('ignores entries with a blank name even if a trigger is set', () => {
    expect(
      matchCharacters('Tessa Monroe walks in', [{ name: '  ', trigger: 'Tessa Monroe' }])
    ).toEqual([]);
  });

  it('deduplicates an identical name+trigger pair listed more than once', () => {
    expect(
      matchCharacters('Tessa Monroe walks in', [entry('Tessa Monroe'), entry('Tessa Monroe')])
    ).toEqual(['Tessa Monroe']);
  });
});
