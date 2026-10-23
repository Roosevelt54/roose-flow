import { describe, it, expect } from 'vitest';
import { parsePromptFile, positionForNumber } from '../src/lib/promptFile';

const SAMPLE = `HOW TO USE THIS FILE
1. Make the character reference images first.
2. In Flow, attach the matching reference.

--------------------------------------------------------------------------------
SECTION 1. THE MADMAN
--------------------------------------------------------------------------------

IMG-001  |  00:00–00:06  |  AI IMAGE
Narration: "Look at him."
Attach: REF-Y80
Motion: slow push-in
PROMPT:
First prompt text with a long enough body.

IMG-002  |  00:06–00:12  |  AI IMAGE
Narration: "Second."
PROMPT:
Second prompt text with a long enough body.
NOTE: Flashback look.

IMG-003  |  00:12–00:18  |  AI B-ROLL or STOCK
PROMPT:
Stock-style prompt that must be skipped.
NOTE: STOCK SEARCH: 'dry riverbed'.

IMG-004  |  00:18–00:24  |  AI IMAGE
PROMPT:
Fourth prompt text with a long enough body.

--------------------------------------------------------------------------------
SECTION 2. THE SHOP
--------------------------------------------------------------------------------

IMG-005  |  00:24–00:30  |  EDITORIAL GRAPHIC
PROMPT:
cross-section of soil.

IMG-006  |  00:30–00:36  |  STOCK FOOTAGE
NOTE: STOCK SEARCH: 'x'.

IMG-007  |  00:36–00:42  |  REAL PHOTO
NOTE: Use a genuine photo.

IMG-008  |  00:42–00:48  |  AI IMAGE
PROMPT:
Eighth prompt text with a long enough body.

================================================================================
END OF FILE
================================================================================
`;

describe('parsePromptFile', () => {
  it('keeps only AI IMAGE shots, in order, with their original numbers', () => {
    const result = parsePromptFile(SAMPLE);
    expect(result.format).toBe('shot-list');
    expect(result.items.map((i) => i.number)).toEqual([1, 2, 4, 8]);
  });

  it('extracts only the prompt body, not narration, notes or dividers', () => {
    const { items } = parsePromptFile(SAMPLE);
    expect(items[0].text).toBe('First prompt text with a long enough body.');
    expect(items[1].text).toBe('Second prompt text with a long enough body.');
    expect(items[3].text).toBe('Eighth prompt text with a long enough body.');
  });

  it('reports what was left out, by shot number and type', () => {
    const { skipped } = parsePromptFile(SAMPLE);
    expect(skipped).toEqual([
      { number: 3, type: 'AI B-ROLL or STOCK' },
      { number: 5, type: 'EDITORIAL GRAPHIC' },
      { number: 6, type: 'STOCK FOOTAGE' },
      { number: 7, type: 'REAL PHOTO' },
    ]);
  });

  it('sorts shots into numeric order even if the file is shuffled', () => {
    const text = `IMG-010 | 0 | AI IMAGE\nPROMPT:\nTen\n\nIMG-002 | 0 | AI IMAGE\nPROMPT:\nTwo\n`;
    expect(parsePromptFile(text).items.map((i) => i.number)).toEqual([2, 10]);
  });

  it('joins a prompt that wraps over several lines', () => {
    const text = `IMG-001 | 0 | AI IMAGE\nPROMPT:\nline one\nline two\nNOTE: n\n`;
    expect(parsePromptFile(text).items[0].text).toBe('line one line two');
  });

  it('ignores an AI IMAGE shot that has no prompt body', () => {
    const text = `IMG-001 | 0 | AI IMAGE\nNarration: x\n\nIMG-002 | 0 | AI IMAGE\nPROMPT:\nreal\n`;
    const result = parsePromptFile(text);
    expect(result.items.map((i) => i.number)).toEqual([2]);
    expect(result.skipped).toContainEqual({ number: 1, type: 'AI IMAGE (no prompt)' });
  });

  it('matches the type case-insensitively and tolerates extra spacing', () => {
    const text = `IMG-001|0|ai image  \nPROMPT:\nfine\n`;
    expect(parsePromptFile(text).items).toHaveLength(1);
  });

  it('falls back to the plain numbered format when there are no IMG headers', () => {
    const text = `1. first numbered prompt here\n2. second numbered prompt here\n`;
    const result = parsePromptFile(text);
    expect(result.format).toBe('numbered');
    expect(result.items.map((i) => i.text)).toEqual([
      'first numbered prompt here',
      'second numbered prompt here',
    ]);
    expect(result.items.map((i) => i.number)).toEqual([1, 2]);
  });

  describe('a numbered file organised into scenes', () => {
    const FILE = `MASTER DESCRIPTIONS
CHARACTER: a long description that is not a prompt.

================================================================
SCENE 1 — AIRPORT TERMINAL / WORK
================================================================

1.
Wide shot of the terminal at dawn.
Her posture is upright, with a 3.5mm detail.
negative: no text

2.
Medium shot at the check-in counter.

================================================================
SCENE 2 — THE ENTRANCE
================================================================

3.
Close on the sliding door as he arrives.
`;

    it('keeps each prompt number and ignores the preamble', () => {
      const { items } = parsePromptFile(FILE);
      expect(items.map((i) => i.number)).toEqual([1, 2, 3]);
    });

    it('gives each prompt the scene it sits under', () => {
      const { items } = parsePromptFile(FILE);
      expect(items[0].scene).toBe('SCENE 1 — AIRPORT TERMINAL / WORK');
      expect(items[1].scene).toBe(items[0].scene);
      expect(items[2].scene).toBe('SCENE 2 — THE ENTRANCE');
    });

    it('keeps scene headers and dividers out of the prompt text', () => {
      const { items } = parsePromptFile(FILE);
      expect(items[1].text).toBe('Medium shot at the check-in counter.');
      expect(items[1].text).not.toMatch(/SCENE|====/);
    });

    it('keeps a multi-line prompt together, including a decimal at a line start', () => {
      const { items } = parsePromptFile(FILE);
      expect(items[0].text).toBe(
        'Wide shot of the terminal at dawn.\nHer posture is upright, with a 3.5mm detail.\nnegative: no text'
      );
    });
  });
});

describe('positionForNumber', () => {
  const numbers = [1, 2, 4, 8];

  it('finds the exact shot', () => {
    expect(positionForNumber(numbers, 4)).toBe(3);
  });

  it('moves a missing number forward to the next shot that exists', () => {
    expect(positionForNumber(numbers, 3)).toBe(3);
  });

  it('clamps past the end to the last shot', () => {
    expect(positionForNumber(numbers, 99)).toBe(4);
  });

  it('clamps below the start to the first shot', () => {
    expect(positionForNumber(numbers, 0)).toBe(1);
  });

  it('returns 1 for an empty queue', () => {
    expect(positionForNumber([], 5)).toBe(1);
  });
});
