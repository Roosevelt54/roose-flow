export interface ParsedPrompt {
  /** The shot number from the file, e.g. 4 for "IMG-004". Absent in plain numbered files. */
  number?: number;
  text: string;
}

export interface SkippedShot {
  number: number;
  type: string;
}

export interface ParsedPromptFile {
  format: 'shot-list' | 'numbered';
  items: ParsedPrompt[];
  skipped: SkippedShot[];
}

const SHOT_HEADER = /^\s*IMG-(\d+)\s*\|[^|]*\|\s*(.*?)\s*$/i;
const DIVIDER = /^\s*[-=]{10,}\s*$/;
const PROMPT_LABEL = /^\s*PROMPT:\s*(.*)$/i;
const NOTE_LABEL = /^\s*NOTE:/i;
const AI_IMAGE = 'ai image';

/**
 * Reads a shot-list file and keeps only the shots typed "AI IMAGE", each with
 * the number it has in the file. Stock footage, B-roll, graphics and real
 * media are reported as skipped. A file with no "IMG-nnn | … | TYPE" headers
 * falls back to the plain "1. prompt" numbered format.
 */
export function parsePromptFile(text: string): ParsedPromptFile {
  const lines = text.split(/\r?\n/);
  const headerAt: number[] = [];
  lines.forEach((line, i) => {
    if (SHOT_HEADER.test(line)) headerAt.push(i);
  });

  if (headerAt.length === 0) {
    return { format: 'numbered', items: parseNumbered(text), skipped: [] };
  }

  const items: ParsedPrompt[] = [];
  const skipped: SkippedShot[] = [];

  headerAt.forEach((start, n) => {
    const [, num, rawType] = lines[start].match(SHOT_HEADER) as RegExpMatchArray;
    const number = parseInt(num, 10);
    const type = rawType.trim();

    if (type.toLowerCase() !== AI_IMAGE) {
      skipped.push({ number, type });
      return;
    }

    const end = n + 1 < headerAt.length ? headerAt[n + 1] : lines.length;
    const body = extractPrompt(lines.slice(start + 1, end));
    if (!body) {
      skipped.push({ number, type: 'AI IMAGE (no prompt)' });
      return;
    }
    items.push({ number, text: body });
  });

  items.sort((a, b) => (a.number as number) - (b.number as number));
  skipped.sort((a, b) => a.number - b.number);
  return { format: 'shot-list', items, skipped };
}

function extractPrompt(block: string[]): string {
  const at = block.findIndex((l) => PROMPT_LABEL.test(l));
  if (at === -1) return '';

  const parts: string[] = [];
  const first = (block[at].match(PROMPT_LABEL) as RegExpMatchArray)[1].trim();
  if (first) parts.push(first);

  for (let i = at + 1; i < block.length; i++) {
    const line = block[i];
    if (NOTE_LABEL.test(line) || DIVIDER.test(line) || line.trim() === '') break;
    parts.push(line.trim());
  }
  return parts.join(' ').trim();
}

function parseNumbered(text: string): ParsedPrompt[] {
  return text
    .split(/(?:^|\n)(?=\d+\.\s)/)
    .map((p) => p.trim())
    .filter((p) => /^\d+\.\s/.test(p))
    .filter((p) => p.length > 10)
    .map((p) => ({ text: p }));
}

/**
 * Turns a shot number typed by the user into a 1-based queue position. A number
 * that was left out of the queue moves forward to the next shot that exists.
 */
export function positionForNumber(numbers: number[], wanted: number): number {
  if (numbers.length === 0) return 1;
  const at = numbers.findIndex((n) => n >= wanted);
  return (at === -1 ? numbers.length - 1 : at) + 1;
}
