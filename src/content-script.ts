/**
 * Content script for Google Flow automation.
 *
 * Purely a driver for Flow's page: it types prompts, submits them, and reports
 * back what was rendered. The UI lives in the side panel, so nothing is
 * injected here and a page refresh costs no state.
 */

import { mediaKey } from './lib/media';

export function isGoogleFlow(): boolean {
  return window.location.href.includes('flow.google.com');
}

/* ------------------------------------------------------------------ */
/* Prompt entry                                                         */
/* ------------------------------------------------------------------ */

interface PromptTarget {
  el: HTMLElement;
  /** Plain form control vs. a rich-text editor div. */
  kind: 'value' | 'contenteditable';
}

const PROMPT_HINT = /prompt|describe|create|generate|imagine|idea|what do you want/i;

function readValue(t: PromptTarget): string {
  return t.kind === 'value'
    ? (t.el as HTMLTextAreaElement | HTMLInputElement).value
    : t.el.textContent || '';
}

/**
 * Flow's page has several text fields (search, filters), so the first visible
 * one is not necessarily the prompt box. Score the candidates instead and take
 * the best: placeholder wording is the strongest signal, then size, then
 * position — the prompt bar sits at the bottom of the page.
 */
function findPromptInput(): PromptTarget | null {
  const nodes = document.querySelectorAll<HTMLElement>(
    'textarea, input[type="text"], input:not([type]), [contenteditable="true"], [contenteditable=""]'
  );

  const scored: { target: PromptTarget; score: number }[] = [];

  for (const el of nodes) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 80 || rect.height < 16) continue;

    const kind: PromptTarget['kind'] =
      el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement
        ? 'value'
        : 'contenteditable';

    const hint = [
      el.getAttribute('placeholder'),
      el.getAttribute('aria-label'),
      el.getAttribute('aria-placeholder'),
      el.getAttribute('name'),
      el.id,
    ]
      .filter(Boolean)
      .join(' ');

    let score = rect.width / 10 + rect.top / 20;
    if (PROMPT_HINT.test(hint)) score += 1000;
    if (kind === 'contenteditable' || el instanceof HTMLTextAreaElement) score += 50;

    scored.push({ target: { el, kind }, score });
  }

  if (!scored.length) return null;
  scored.sort((a, b) => b.score - a.score);
  const winner = scored[0];
  console.log('[Roose Flow] prompt field:', winner.target.el.tagName, winner.target.kind);
  return winner.target;
}

/**
 * Writing a prompt is fiddly: React reverts direct `.value` assignment, and
 * rich-text editors only commit text that arrives through the real
 * beforeinput/input sequence. execCommand produces that sequence, with the
 * native prototype setter as a fallback for plain controls.
 * Returns whether the text actually landed.
 */
async function writePrompt(t: PromptTarget, text: string): Promise<boolean> {
  const el = t.el;
  el.focus();
  el.click();

  // Select whatever is there so the insert replaces it.
  if (t.kind === 'value') {
    const field = el as HTMLTextAreaElement | HTMLInputElement;
    field.setSelectionRange?.(0, field.value.length);
  } else {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  try {
    document.execCommand('insertText', false, text);
  } catch {
    /* falls through to the setter below */
  }

  if (readValue(t).trim() !== text.trim()) {
    console.log('[Roose Flow] execCommand did not take, trying a synthetic paste');

    if (t.kind === 'value') {
      const proto =
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, text);
      el.dispatchEvent(
        new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' })
      );
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      // Flow's editor is Slate.js (confirmed by a sibling extension's own
      // diagnostics: "Prompt editor found ... Slate attrs"). Slate keeps its
      // own document model in memory and does not treat a direct DOM write
      // as a real edit - it listens for native beforeinput events the same
      // way a real paste would arrive, and reconciles the DOM back to its
      // internal model on the next render. Writing el.textContent directly
      // is exactly the kind of change Slate reverts, which fits a reference
      // chip attaching (a change Slate initiated itself) followed by the
      // typed text vanishing (a change it did not).
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);

      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', text);
      el.dispatchEvent(
        new InputEvent('beforeinput', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertFromPaste',
          dataTransfer,
        })
      );
    }
  }

  await new Promise((r) => setTimeout(r, 300));
  const landed = readValue(t).trim().length;
  console.log('[Roose Flow] prompt readback:', landed, 'of', text.length, 'chars');
  return landed > 0;
}

/** keyCode is read-only on KeyboardEvent, so it has to be patched on after construction. */
function pressEnter(el: HTMLElement): void {
  for (const type of ['keydown', 'keypress', 'keyup']) {
    const ev = new KeyboardEvent(type, {
      key: 'Enter',
      code: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(ev, 'keyCode', { get: () => 13 });
    Object.defineProperty(ev, 'which', { get: () => 13 });
    el.dispatchEvent(ev);
  }
}

/**
 * A click as a person's mouse produces it: hover, press, release, then click,
 * at the element's centre. A bare element.click() only fires the last step,
 * and Flow's controls do not all react to that alone - the "Add to prompt"
 * menu item only started working once it was given the full sequence.
 */
function clickLikeUser(el: HTMLElement): void {
  const r = el.getBoundingClientRect();
  const opts: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: r.left + r.width / 2,
    clientY: r.top + r.height / 2,
    button: 0,
  };
  const pointer = { ...opts, pointerType: 'mouse', isPrimary: true };

  el.dispatchEvent(new PointerEvent('pointerover', pointer));
  el.dispatchEvent(new MouseEvent('mouseover', opts));
  el.dispatchEvent(new PointerEvent('pointerenter', pointer));
  el.dispatchEvent(new MouseEvent('mouseenter', opts));
  el.dispatchEvent(new PointerEvent('pointerdown', pointer));
  el.dispatchEvent(new MouseEvent('mousedown', opts));
  el.focus?.();
  el.dispatchEvent(new PointerEvent('pointerup', pointer));
  el.dispatchEvent(new MouseEvent('mouseup', opts));
  el.click();
}

/**
 * Flow's send control: an icon button whose text is the literal Material
 * Symbols name "arrow_forward". More than one such button can exist on the
 * page (any "next" arrow), so distance alone can pick the wrong one - a click
 * that was followed by an unrelated image appearing and no generation. The
 * right one lives in the same bar as the prompt box: walk up from the box
 * and take the first arrow found inside the smallest enclosing element.
 */
function findSendButton(near: HTMLElement): HTMLElement | null {
  const arrows = (root: ParentNode) =>
    Array.from(root.querySelectorAll<HTMLElement>('button, [role="button"]')).filter((b) => {
      const label = (b.textContent || '').trim().toLowerCase();
      const r = b.getBoundingClientRect();
      return label === 'arrow_forward' && r.width > 0 && r.height > 0;
    });

  console.log('[Roose Flow] arrow_forward buttons on the page:', arrows(document).length);

  let scope: HTMLElement | null = near.parentElement;
  for (let depth = 0; scope && depth < 10; depth++, scope = scope.parentElement) {
    const found = arrows(scope);
    if (found.length > 0) {
      console.log('[Roose Flow] send button found in the prompt bar (level', depth + ')');
      return found[0];
    }
  }
  return null;
}

/**
 * Whatever Flow is currently telling the user: snackbars, alerts, live
 * regions. A refused submit (a limit reached, a rule broken) is normally
 * explained in one of these for a few seconds, and nothing was reading them.
 */
function readFlowMessages(): string {
  const seen = new Set<string>();
  document
    .querySelectorAll<HTMLElement>(
      'mat-snack-bar-container, simple-snack-bar, [role="alert"], [role="status"], [aria-live="assertive"], [aria-live="polite"]'
    )
    .forEach((el) => {
      const r = el.getBoundingClientRect();
      const text = (el.textContent || '').trim().replace(/\s+/g, ' ');
      if (r.width > 0 && r.height > 0 && text.length > 0 && text.length <= 200) seen.add(text);
    });
  return seen.size ? Array.from(seen).join(' | ') : '(none)';
}

/* ------------------------------------------------------------------ */
/* Character references                                                 */
/* ------------------------------------------------------------------ */
//
// Flow has no dedicated "character" system: this automates a manual,
// three-step action a user already does by hand — right-click a renamed
// output tile in the gallery, click "Add to prompt" in the context menu it
// opens, which attaches a small reference chip next to the prompt box.
//
// This section is built from screenshots, not from inspecting Flow's actual
// markup directly, so it is the least trustworthy part of the file. Expect
// it to need a round of adjustment once real console output comes back —
// the same way the prompt input and Generate button did earlier.

function wordsContain(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(haystack);
}

/** A caption that is not the name but holds it as whole words, or the other way round. */
function looseCaptionMatch(caption: string, target: string): boolean {
  if (caption.length < 3 || caption.length > 60 || caption === target) return false;
  return wordsContain(caption, target) || wordsContain(target, caption);
}

/** Which picture a tile shows, so two names that lead to one tile are noticed. */
function tileIdentity(tile: HTMLElement): string {
  const img = tile.querySelector('img');
  const src = img ? img.currentSrc || img.src : '';
  return src ? mediaKey(src) : (tile.textContent || '').trim().toLowerCase();
}

/** Tiles already attached to the prompt being built, so one is never attached twice. */
const attachedTiles = new Set<string>();

/** Why the last attach did not happen, so a missing tile is not searched for again and again. */
let lastAttachFailure: 'no-tile' | 'menu' | null = null;

/**
 * Find a gallery tile whose visible caption matches a character name exactly.
 * Walks up from the caption text looking for the nearest ancestor that also
 * contains a thumbnail image, on the assumption that is the card Flow expects
 * a right-click on — rather than the bare caption text itself.
 */
function findGalleryTile(name: string): HTMLElement | null {
  const target = name.trim().toLowerCase();
  if (!target) return null;

  const captions: HTMLElement[] = [];
  const loose: HTMLElement[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode() as HTMLElement | null;

  while (node) {
    const ownText = Array.from(node.childNodes)
      .filter((child) => child.nodeType === Node.TEXT_NODE)
      .map((child) => child.textContent || '')
      .join('')
      .trim();

    const lowered = ownText.toLowerCase();
    if (lowered === target) captions.push(node);
    else if (looseCaptionMatch(lowered, target)) loose.push(node);
    node = walker.nextNode() as HTMLElement | null;
  }

  console.log(`[Roose Flow] "${name}": found ${captions.length} caption match(es)`);

  // With no exact caption, accept a near one (a tile captioned "BAEK SEO-HWAN"
  // for the name "SEO-HWAN") but only when it is clearly one tile.
  const usingLoose = captions.length === 0 && loose.length > 0;
  if (usingLoose) {
    console.log(`[Roose Flow] "${name}": no exact caption, ${loose.length} near match(es)`);
  }
  const found: HTMLElement[] = [];

  for (const caption of usingLoose ? loose : captions) {
    let ancestor: HTMLElement | null = caption;
    for (let depth = 0; depth < 6 && ancestor; depth++) {
      if (ancestor.querySelector('img')) {
        const rect = ancestor.getBoundingClientRect();
        if (rect.width > 40 && rect.height > 40) {
          console.log(
            '[Roose Flow] tile for',
            name,
            '→',
            ancestor.tagName,
            `${Math.round(rect.width)}x${Math.round(rect.height)}`,
            'at depth',
            depth
          );
          if (!usingLoose) return ancestor;
          found.push(ancestor);
          break;
        }
      }
      ancestor = ancestor.parentElement;
    }
  }

  if (usingLoose) {
    const distinct = new Set(found.map(tileIdentity));
    if (distinct.size === 1) return found[0];
    if (distinct.size > 1) {
      console.log(`[Roose Flow] "${name}": near matches point at ${distinct.size} different tiles, not guessing`);
    }
  }

  return null;
}

/** Dispatches the mouse sequence a real right-click produces, at the element's centre. */
function rightClick(el: HTMLElement): void {
  const rect = el.getBoundingClientRect();
  const opts: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
    button: 2,
  };
  el.dispatchEvent(new MouseEvent('mousedown', opts));
  el.dispatchEvent(new MouseEvent('mouseup', opts));
  el.dispatchEvent(new MouseEvent('contextmenu', opts));
}

/**
 * Polls for a visible, exact-text menu item and clicks it.
 *
 * The right-click reliably opens Flow's menu (confirmed against the live
 * page), so this is the narrower, still-unverified part: whether the click
 * itself lands. Menus like this often respond to pointer events rather than
 * plain mouse events, so both are dispatched. A short settle delay comes
 * first in case the menu is still animating in, and a check afterwards for
 * whether the menu is still on screen is a rough signal for whether the
 * click actually did anything.
 */
async function clickMenuItem(text: string, timeout = 2000): Promise<boolean> {
  await new Promise((r) => setTimeout(r, 200));

  const target = text.trim().toLowerCase();
  const start = Date.now();
  let loggedCandidates = false;

  while (Date.now() - start < timeout) {
    const items = Array.from(
      document.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menu"] *')
    ).filter((item) => {
      const rect = item.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    if (items.length > 0 && !loggedCandidates) {
      loggedCandidates = true;
      console.log(
        '[Roose Flow] menu items visible:',
        items
          .map(
            (i) =>
              `${i.tagName}[${i.getAttribute('role') || '-'}] "${(i.textContent || '').trim().slice(0, 40)}"`
          )
          .join(' | ')
      );
    }

    const match = items.find((i) => (i.textContent || '').trim().toLowerCase() === target);

    if (match) {
      console.log(
        '[Roose Flow] clicking menu item:',
        match.tagName,
        'role=',
        match.getAttribute('role')
      );

      const rect = match.getBoundingClientRect();
      const opts: MouseEventInit = {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
      };
      match.dispatchEvent(new PointerEvent('pointerdown', opts));
      match.dispatchEvent(new MouseEvent('mousedown', opts));
      match.dispatchEvent(new PointerEvent('pointerup', opts));
      match.dispatchEvent(new MouseEvent('mouseup', opts));
      match.click();

      await new Promise((r) => setTimeout(r, 300));
      const stillOpen = !!document.querySelector('[role="menu"]');
      console.log(
        '[Roose Flow] menu still open after click:',
        stillOpen,
        stillOpen ? '(click likely did not register)' : '(click likely worked)'
      );
      return true;
    }

    await new Promise((r) => setTimeout(r, 100));
  }

  console.log('[Roose Flow] no menu item matched:', text);
  return false;
}

/** Reference chips attached beside the prompt box: "Ingredient" buttons, never the (+) add button. */
function visibleReferenceChips(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('button[aria-label]')).filter((b) => {
    const label = (b.getAttribute('aria-label') || '').trim();
    if (!/^ingredient(\s|$)/i.test(label) || /\badd\b/i.test(label)) return false;
    const r = b.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}

/** What the chips look like right now, so a change shows even if their number does not. */
function chipSignature(): string {
  return visibleReferenceChips()
    .map((chip) => chip.innerHTML)
    .join('|');
}

/**
 * Attach a reference, retrying only when the click itself did not happen.
 *
 * "Add to prompt" is only retried when the tile or the menu item could not be
 * found. Whether a chip then appeared is logged but is not a verdict: an
 * earlier version treated "the chip count did not go up" as a failure, and
 * reported characters as missing when they had in fact been attached (Flow
 * can cap or restyle the chips it shows), while the retries risked adding the
 * same reference twice.
 */
async function attachVerified(label: string, attach: () => Promise<boolean>): Promise<boolean> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const beforeCount = visibleReferenceChips().length;
    const beforeLook = chipSignature();
    lastAttachFailure = null;
    if (await attach()) {
      const deadline = Date.now() + 2500;
      let changed = false;
      while (Date.now() < deadline) {
        if (visibleReferenceChips().length > beforeCount || chipSignature() !== beforeLook) {
          changed = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 200));
      }
      console.log(
        `[Roose Flow] "${label}" attached` +
          (changed ? ` (chips ${beforeCount} → ${visibleReferenceChips().length})` : ' (no chip change seen, trusting the click)')
      );
      // Let the prompt bar finish rebuilding before the next reference.
      await new Promise((r) => setTimeout(r, 800));
      return true;
    }
    console.log(`[Roose Flow] "${label}" could not be clicked (attempt ${attempt}/3)`);
    // A tile that is not in Flow will not appear on a second look; only a menu
    // that did not respond is worth another try.
    if (lastAttachFailure === 'no-tile') return false;
    // Close a menu that may still be open and reset the gallery's search.
    (document.activeElement || document.body).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    await clearGallerySearch();
    await new Promise((r) => setTimeout(r, 800));
  }
  return false;
}

/**
 * Best-effort removal of a reference chip left over from a previous prompt.
 *
 * The removal control itself has not been confirmed to exist on Flow — this
 * looks for a close/remove button near the prompt input and clicks whatever
 * it finds, logging plainly either way so the search can be corrected once
 * we know what the chip actually looks like.
 */
async function clearAttachedReferences(_promptEl: HTMLElement): Promise<void> {
  // Flow calls a reference an "Ingredient", and each chip's cancel button
  // carries exactly that aria-label (seen in a real layout dump, with the
  // visible text "cancelaccessibility_new"). The earlier search only looked
  // for "remove"/"close", so it never matched: the chips from every previous
  // prompt stayed put and new ones piled on top, until Flow stopped taking
  // more. Each click re-renders the bar, so look again after every removal.
  // Real chips are labelled exactly "Ingredient". Matching anything that
  // merely contained the word also caught the "Add ingredients to the prompt
  // box" (+) button, which is what got clicked every time - opening its menu
  // - while no chip was ever touched. Never match that one.
  const visibleChips = visibleReferenceChips;

  const before = visibleChips().length;
  let stuck = 0;

  for (let i = 0; i < 40 && stuck < 2; i++) {
    const chip = visibleChips()[0];
    if (!chip) break;
    const count = visibleChips().length;

    // The chip holds a person icon and a small "cancel" icon; clicking the
    // middle of the button may open the reference rather than remove it.
    const cancel = Array.from(chip.querySelectorAll<HTMLElement>('mat-icon, .material-symbols-outlined, span')).find(
      (el) => (el.textContent || '').trim().toLowerCase() === 'cancel'
    );
    clickLikeUser(cancel ?? chip);
    await new Promise((r) => setTimeout(r, 300));

    // If the count did not drop, that click did not remove anything.
    stuck = visibleChips().length >= count ? stuck + 1 : 0;
  }

  const left = visibleChips().length;
  if (left > 0) {
    // Removal still did not work: show the chip's real markup so the next
    // attempt targets what is actually there instead of a guess.
    console.log('[Roose Flow] chip markup:', visibleChips()[0].outerHTML.slice(0, 500));
  }
  console.log(
    before === 0
      ? '[Roose Flow] no leftover reference chips to remove'
      : `[Roose Flow] reference chips: ${before} before cleanup, ${left} left`
  );
}

/**
 * Opens Flow's "Characters" sidebar section if it exists and isn't already
 * open.
 *
 * Screenshots show Flow has a dedicated Characters section, separate from
 * the general Images/All media grid — most likely a distinct route whose
 * tiles are not rendered into the DOM at all until it is opened, which would
 * fully explain a caption search finding zero matches even with the exact
 * right name. The prompt bar itself is visible at the bottom regardless of
 * which sidebar section is open, so switching here should not lose it.
 */
async function ensureCharactersSectionOpen(): Promise<void> {
  const candidates = document.querySelectorAll<HTMLElement>('button, a, [role="button"], [role="tab"], li, div');

  // Flow's icons render as literal Material Symbols ligature text (confirmed
  // earlier in this project: buttons named "arrow_forward", "more_vert",
  // "search"). A nav item combining an icon glyph with the word "Characters"
  // could have textContent like "personCharacters", which an exact match
  // against "characters" would never catch - hence a substring match here,
  // plus logging every candidate so a further mismatch is visible directly
  // rather than guessed at again.
  const matches: HTMLElement[] = [];
  for (const item of candidates) {
    const ownText = (item.textContent || '').trim();
    if (ownText.length === 0 || ownText.length > 60) continue;
    if (!ownText.toLowerCase().includes('characters')) continue;
    matches.push(item);
  }

  console.log(
    '[Roose Flow] "characters" nav candidates:',
    matches.length
      ? matches.map((m) => `${m.tagName} "${(m.textContent || '').trim().slice(0, 40)}"`).join(' | ')
      : '(none)'
  );

  for (const item of matches) {
    const rect = item.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    console.log('[Roose Flow] opening Characters section:', item.tagName);
    viewDisturbed = true;
    item.click();
    await new Promise((r) => setTimeout(r, 500));
    return;
  }

  console.log('[Roose Flow] no visible "Characters" nav item found (already open, or different UI)');
}

/** Right-clicks a named tile and selects "Add to prompt". */
/**
 * Scrolls through scrollable containers on the page looking for a tile.
 *
 * A long-running batch keeps adding new generations, and if Flow virtualizes
 * this gallery the way most long lists are (rendering only what is near the
 * viewport into the DOM), a tile that has been pushed further down is not
 * merely offscreen — it may not exist in the DOM at all until scrolled into
 * range. This is a last resort, tried only once the plain search has
 * already failed with the section open.
 */
async function scrollToFindTile(
  name: string,
  find: (name: string) => HTMLElement | null = findGalleryTile
): Promise<HTMLElement | null> {
  const scrollables = Array.from(
    document.querySelectorAll<HTMLElement>('div, section, ul, ol, main, aside')
  ).filter((el) => {
    const style = getComputedStyle(el);
    return (
      (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
      el.scrollHeight > el.clientHeight + 40
    );
  });

  console.log('[Roose Flow] scrollable containers found:', scrollables.length);

  for (const container of scrollables) {
    container.scrollTop = 0;
    await new Promise((r) => setTimeout(r, 200));

    for (let step = 0; step < 15; step++) {
      const tile = find(name);
      if (tile) {
        console.log('[Roose Flow] found tile by scrolling, step', step);
        return tile;
      }

      const before = container.scrollTop;
      container.scrollTop += container.clientHeight * 0.8;
      await new Promise((r) => setTimeout(r, 250));
      if (container.scrollTop === before) break; // reached the bottom of this container
    }
  }

  return null;
}

/** A visible text input whose placeholder/aria-label/name hints it is a search box. */
function findVisibleSearchInput(): HTMLInputElement | null {
  const inputs = document.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])');
  for (const el of inputs) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const hint = [el.getAttribute('placeholder'), el.getAttribute('aria-label'), el.getAttribute('name')]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (hint.includes('search')) return el;
  }
  return null;
}

/**
 * Types into Flow's own search box so its filtering narrows the rendered
 * list, instead of scrolling blind through a gallery of unknown length. A
 * "search" button was confirmed to exist from this project's very first
 * diagnostics of Flow's UI (its Material Symbols icon renders as literal
 * ligature text), so the box may be collapsed behind that icon rather than
 * always visible.
 */
async function searchGallery(query: string): Promise<boolean> {
  let input = findVisibleSearchInput();

  if (!input) {
    const searchButton = Array.from(
      document.querySelectorAll<HTMLElement>('button, [role="button"]')
    ).find((el) => (el.textContent || '').trim().toLowerCase() === 'search');

    if (searchButton) {
      console.log('[Roose Flow] clicking search icon to reveal the search box');
      searchButton.click();
      await new Promise((r) => setTimeout(r, 300));
      input = findVisibleSearchInput();
    }
  }

  if (!input) {
    console.log('[Roose Flow] no search box found');
    return false;
  }

  viewDisturbed = true;
  input.focus();
  input.select();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, query);
  input.dispatchEvent(new InputEvent('input', { bubbles: true, data: query, inputType: 'insertText' }));

  console.log('[Roose Flow] searched gallery for:', query);
  await new Promise((r) => setTimeout(r, 500));
  return true;
}

/**
 * Set when attaching a character moved Flow away from the view it generates
 * in: the Characters section was opened, or the search box was typed into.
 */
let viewDisturbed = false;

/**
 * Put Flow back the way generation expects it, after attaching characters.
 *
 * Nothing did this before. The Characters section stayed open and the search
 * box kept the character's name, which filters the gallery - so a brand new
 * render did not appear on screen at all, and any large image that was still
 * showing (the character's own tile) could be taken for the result.
 */
/** Empties Flow's gallery search box, which otherwise keeps filtering to the last name typed. */
async function clearGallerySearch(): Promise<void> {
  const search = findVisibleSearchInput();
  if (search && search.value) {
    search.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(search, '');
    search.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    console.log('[Roose Flow] cleared the gallery search box');
    await new Promise((r) => setTimeout(r, 300));
  }
}

async function restoreGalleryView(): Promise<void> {
  if (!viewDisturbed) return;
  viewDisturbed = false;

  await clearGallerySearch();

  // The sidebar is the narrow column at the left; the smallest element there
  // whose label mentions "images" is the nav entry itself.
  const nav = Array.from(
    document.querySelectorAll<HTMLElement>('button, a, [role="button"], [role="tab"], li, div, span')
  )
    .filter((el) => {
      const text = (el.textContent || '').trim().toLowerCase();
      return text.length > 0 && text.length <= 30 && text.includes('images');
    })
    .map((el) => ({ el, rect: el.getBoundingClientRect() }))
    .filter(({ rect }) => rect.width > 0 && rect.height > 0 && rect.left < 300)
    .sort((a, b) => a.rect.width * a.rect.height - b.rect.width * b.rect.height);

  if (nav.length === 0) {
    console.log('[Roose Flow] no "Images" nav entry found to return to');
    return;
  }

  console.log('[Roose Flow] returning to Images view:', nav[0].el.tagName);
  nav[0].el.click();
  await new Promise((r) => setTimeout(r, 600));
}

async function attachCharacterReference(name: string): Promise<boolean> {
  console.log('[Roose Flow] attaching character reference:', name);

  // Only open the Characters section when the tile is not already visible.
  // If the nav item is a toggle rather than a persistent tab, clicking it
  // unconditionally on every call would close a section that a previous
  // call already opened, on roughly every other attempt.
  let tile = findGalleryTile(name);
  if (!tile) {
    await ensureCharactersSectionOpen();
    tile = findGalleryTile(name);
  }

  if (!tile) {
    console.log('[Roose Flow] tile not immediately visible, trying Flow\'s own search');
    if (await searchGallery(name)) {
      tile = findGalleryTile(name);
    }
  }

  if (!tile) {
    console.log('[Roose Flow] still not visible, trying to scroll to it');
    tile = await scrollToFindTile(name);
  }

  if (!tile) {
    console.log('[Roose Flow] no gallery tile found named:', name);
    lastAttachFailure = 'no-tile';
    return false;
  }

  // Two entries can lead to one tile ("CHINAZA" and "CHINAZA NWOSU"). It goes
  // on the prompt once; a second click would add a duplicate chip.
  const identity = tileIdentity(tile);
  if (attachedTiles.has(identity)) {
    console.log('[Roose Flow] already attached the tile for', name, '- skipping');
    lastAttachFailure = null;
    return true;
  }

  tile.scrollIntoView({ block: 'center' });
  await new Promise((r) => setTimeout(r, 150));

  rightClick(tile);
  const clicked = await clickMenuItem('Add to prompt');
  await new Promise((r) => setTimeout(r, 300));

  if (clicked) {
    attachedTiles.add(identity);
    lastAttachFailure = null;
  } else {
    lastAttachFailure = 'menu';
    console.log('[Roose Flow] could not attach reference for:', name);
  }
  return clicked;
}

/**
 * Find the tile of an image generated earlier in this run by the identity of
 * its picture. Generated images have no caption to search for, but the same
 * host and path is on screen every time they are shown, whatever size or
 * signature Flow serves them at.
 */
function findImageTileByKey(key: string): HTMLElement | null {
  for (const img of document.querySelectorAll<HTMLImageElement>('img')) {
    const src = img.currentSrc || img.src;
    if (!src || mediaKey(src) !== key) continue;
    const rect = img.getBoundingClientRect();
    // The little chip beside the prompt box shows an attached image too; a
    // grid tile is far larger than that.
    if (rect.width < 120 || rect.height < 120) continue;
    return img;
  }
  return null;
}

/** Right-clicks an earlier render and chooses "Add to prompt", as for a character. */
async function attachSceneReference(key: string): Promise<boolean> {
  console.log('[Roose Flow] attaching earlier scene:', key.slice(-40));

  let tile = findImageTileByKey(key);
  if (!tile) {
    console.log('[Roose Flow] scene image not on screen, scrolling to find it');
    tile = await scrollToFindTile(key, findImageTileByKey);
  }

  if (!tile) {
    console.log('[Roose Flow] could not find the earlier scene image, generating without it');
    lastAttachFailure = 'no-tile';
    return false;
  }

  tile.scrollIntoView({ block: 'center' });
  await new Promise((r) => setTimeout(r, 150));

  rightClick(tile);
  const clicked = await clickMenuItem('Add to prompt');
  await new Promise((r) => setTimeout(r, 300));

  if (!clicked) console.log('[Roose Flow] could not attach the earlier scene');
  return clicked;
}

/* ------------------------------------------------------------------ */
/* Render detection                                                     */
/* ------------------------------------------------------------------ */

interface MediaHit {
  url: string;
  kind: 'image' | 'video';
  width: number;
}

/**
 * Renders already handed back for an earlier prompt. Never accepted twice,
 * so a stale image cannot be mistaken for the next prompt's result even if
 * it was somehow missing from the pre-submit snapshot.
 */
const claimedMediaKeys = new Set<string>();

/** Snapshot the identity of every media element currently on the page. */
function collectMediaUrls(): Set<string> {
  const keys = new Set<string>();
  document.querySelectorAll('img, video').forEach((el) => {
    const src = (el as HTMLImageElement | HTMLVideoElement).currentSrc || (el as HTMLImageElement).src;
    if (src) keys.add(mediaKey(src));
  });
  return keys;
}

const ALERT_SELECTOR = '[role="alert"], [role="status"], [aria-live]';
const ERROR_TEXT =
  /(went wrong|failed|error|could ?n[o']?t|cannot|can't|unable to|try again|unavailable|rate limit|quota|too many)/i;

/**
 * Snapshot live-region text so a toast that appears after submitting can be
 * told apart from one that was already on screen.
 */
function collectAlertTexts(): Set<string> {
  const texts = new Set<string>();
  document.querySelectorAll(ALERT_SELECTOR).forEach((el) => {
    const text = (el.textContent || '').trim();
    if (text) texts.add(text);
  });
  return texts;
}

/**
 * Look for a newly-shown error message. Scoped to live regions and short
 * strings so prompt text on the page can never be mistaken for an error.
 */
function findNewError(before: Set<string>): string | null {
  for (const el of document.querySelectorAll(ALERT_SELECTOR)) {
    const text = (el.textContent || '').trim();
    if (!text || before.has(text) || text.length > 300) continue;
    if (ERROR_TEXT.test(text)) return text;
  }
  return null;
}

type Outcome =
  | { kind: 'media'; hit: MediaHit }
  | { kind: 'error'; message: string }
  | { kind: 'timeout' };

/**
 * Race the render against Flow's own error reporting, so a failed generation
 * is caught in seconds instead of burning the whole timeout.
 */
/**
 * How long an image candidate must remain the newest, unchanged sighting
 * before it is trusted as the finished render. Flow appears to show a
 * low-resolution preview before swapping in the final image — a plain "did
 * something over 256px appear" check is satisfied by that preview just as
 * well as by the real thing, and downloads it too early. Waiting for the
 * candidate to hold still catches the swap: a preview gets superseded by a
 * later, different URL before the settle window elapses, which restarts
 * the wait on the new (larger, or simply different) candidate instead.
 */
const IMAGE_SETTLE_MS = 4000;

/**
 * Nothing seen within this long of submitting counts as the render. Flow
 * needs many seconds to generate; an "image" showing up sooner than this is
 * the gallery or a character tile re-rendering under a fresh signature.
 */
const MIN_RENDER_WAIT_MS = 5000;

/** Longest side, in pixels, below which an image is a thumbnail rather than a render. */
const MIN_RENDER_SIDE = 900;

/** Small images already reported, so each is logged once and not every poll. */
const smallSeen = new Set<string>();

/**
 * Google's own CDN serves resized copies from URLs ending in a suffix like
 * "=s1600-rw" — a well known convention where "=s<number>" requests a
 * specific resized version of an image, seen directly in a real capture:
 * a 1600px googleusercontent.com thumbnail appeared first, superseded
 * moments later by a signed storage URL from an entirely different host
 * pattern that was the actual generated asset. 1600px is too large for the
 * plain width filter to reject as an obvious preview, so this excludes the
 * pattern by URL shape instead.
 */
function isKnownPreviewUrl(url: string): boolean {
  return /googleusercontent\.com/.test(url) && /[=&]s\d+(-rw)?(?:[-&]|$)/.test(url);
}

async function waitForOutcome(
  beforeMedia: Set<string>,
  beforeAlerts: Set<string>,
  timeout: number
): Promise<Outcome> {
  const start = Date.now();
  let candidate: MediaHit | null = null;
  let candidateKey = '';
  let candidateSince = 0;

  const isNew = (url: string) => {
    const key = mediaKey(url);
    return !beforeMedia.has(key) && !claimedMediaKeys.has(key);
  };

  while (Date.now() - start < timeout) {
    // A real generation takes many seconds. Anything that "appears" in the
    // first moments after submitting is a page re-render, not the result.
    const tooEarly = Date.now() - start < MIN_RENDER_WAIT_MS;

    for (const el of document.querySelectorAll<HTMLVideoElement>('video')) {
      const url = el.currentSrc || el.src;
      if (!tooEarly && url && isNew(url) && el.readyState >= 1) {
        claimedMediaKeys.add(mediaKey(url));
        return { kind: 'media', hit: { url, kind: 'video', width: el.videoWidth } };
      }
    }

    let best: MediaHit | null = null;
    for (const el of document.querySelectorAll<HTMLImageElement>('img')) {
      const url = el.currentSrc || el.src;
      if (!url || !isNew(url)) continue;
      if (isKnownPreviewUrl(url)) continue;
      // Skip icons, avatars and spinners — a render is always large.
      if (!el.complete || el.naturalWidth < 256) continue;
      // naturalWidth is the file's size, not what is on screen: the little
      // reference chip beside the prompt box is drawn from a full-size image.
      const shown = el.getBoundingClientRect();
      if (shown.width < 120 || shown.height < 120) continue;
      // Real renders in this project's captures were ~1376px. A 512px image
      // was accepted as a render and turned out to be a thumbnail, so a
      // generated image has to be large on its longest side.
      if (Math.max(el.naturalWidth, el.naturalHeight) < MIN_RENDER_SIDE) {
        const key = mediaKey(url);
        if (!smallSeen.has(key)) {
          smallSeen.add(key);
          console.log(
            '[Roose Flow] ignoring a',
            el.naturalWidth + 'x' + el.naturalHeight,
            'image (smaller than a render):',
            key.slice(-40)
          );
        }
        continue;
      }
      if (!best || el.naturalWidth > best.width) {
        best = { url, kind: 'image', width: el.naturalWidth };
      }
    }

    if (best && !tooEarly) {
      const bestKey = mediaKey(best.url);
      if (!candidate || candidateKey !== bestKey || best.width > candidate.width) {
        console.log(
          '[Roose Flow] image candidate:',
          best.width + 'px',
          bestKey.slice(-40),
          candidate ? `(replaces ${candidate.width}px)` : '(first sighting)'
        );
        candidate = best;
        candidateKey = bestKey;
        candidateSince = Date.now();
      } else {
        // Same image, possibly re-signed: keep the freshest URL for the
        // download but do not restart the settle timer.
        candidate = { ...(candidate as MediaHit), url: best.url };
        if (Date.now() - candidateSince >= IMAGE_SETTLE_MS) {
          console.log('[Roose Flow] image settled after', Date.now() - candidateSince, 'ms unchanged');
          claimedMediaKeys.add(candidateKey);
          return { kind: 'media', hit: candidate };
        }
      }
    }

    const error = findNewError(beforeAlerts);
    if (error) return { kind: 'error', message: error };

    await new Promise((r) => setTimeout(r, 500));
  }

  // Out of time, but a candidate that never quite settled is still better
  // than reporting a flat timeout when a render plainly did appear.
  if (candidate) {
    claimedMediaKeys.add(candidateKey);
    return { kind: 'media', hit: candidate };
  }

  return { kind: 'timeout' };
}

/**
 * Type a prompt into Flow's box, submit it with Enter, and wait for the render.
 */
export async function generatePrompt(
  text: string,
  characterNames: string[] = [],
  timeout: number = 180000,
  sceneKeys: string[] = []
): Promise<{
  success: boolean;
  imageUrl?: string;
  dataUrl?: string;
  kind?: string;
  mediaKey?: string;
  warning?: string;
  /** Characters named in the prompt that could not be attached. */
  missingReferences?: string[];
  error?: string;
}> {
  try {

    console.log('[Roose Flow] generating:', text.slice(0, 60));
    // Characters and earlier scenes are both references that make Flow rebuild
    // the prompt bar, so they share every wait and re-check below.
    const hasRefs = characterNames.length > 0 || sceneKeys.length > 0;
    let clickBlocked = false;
    const missing: string[] = [];

    let input = findPromptInput();
    if (!input) {
      return { success: false, error: 'Could not find Flow prompt input' };
    }

    // Always clear first, even with nothing to attach: a chip left from the
    // previous prompt must not silently carry into one that names no character.
    await clearAttachedReferences(input.el);
    attachedTiles.clear();

    // For character prompts the text goes in FIRST. Attaching a reference
    // makes Flow rebuild the whole prompt bar (the old box is detached on
    // every run), and text written straight into the rebuilt box shows on
    // screen without Flow's own copy of the prompt ever receiving it: the
    // send button was found, enabled and clicked, no message appeared and
    // nothing generated. Text entered before the rebuild is carried across
    // by Flow itself, as when a person types first and adds a reference after.
    if (hasRefs) {
      const fresh = findPromptInput();
      if (fresh) input = fresh;
      await writePrompt(input, text);
    }

    // The place first: its image is in the ordinary Images view, so nothing has
    // to be opened, and the character sections can then be opened after it.
    for (const key of sceneKeys) {
      await attachVerified('earlier scene', () => attachSceneReference(key));
    }
    for (const name of characterNames) {
      // The previous character's search text would hide this one's tile.
      await clearGallerySearch();
      if (!(await attachVerified(name, () => attachCharacterReference(name)))) {
        missing.push(name);
      }
    }
    console.log(
      `[Roose Flow] characters attached: ${characterNames.length - missing.length} of ${characterNames.length}`,
      missing.length ? `(missing: ${missing.join(', ')})` : ''
    );
    await restoreGalleryView();

    if (hasRefs) {
      // A person takes many seconds to type a prompt after picking a
      // character; this ran Enter about two seconds after "Add to prompt".
      // If the chip is still loading, Flow ignores the submit.
      console.log('[Roose Flow] letting the reference chip finish attaching');
      await new Promise((r) => setTimeout(r, 2500));
    }

    if (hasRefs) {
      // Attaching a reference can make Flow re-render the prompt bar with a
      // new DOM node, in which case the element found above is now detached
      // and writing into it would silently do nothing.
      console.log('[Roose Flow] original prompt element still attached:', input.el.isConnected);
      const refreshed = findPromptInput();
      if (refreshed) input = refreshed;
    }

    const beforeMedia = collectMediaUrls();
    const beforeAlerts = collectAlertTexts();

    // A character prompt was already entered before the references went on.
    // If it is still there, that is the copy Flow carried across itself, so
    // leave it alone; only write again if the rebuild dropped it. Submitting
    // an empty box would fire off a blank generation, so bail out rather than
    // pressing Enter on nothing.
    const carried =
      hasRefs && readValue(input).trim().length >= text.trim().length * 0.5;
    if (carried) {
      console.log('[Roose Flow] prompt text survived attaching the references');
    } else if (!(await writePrompt(input, text))) {
      return { success: false, error: 'Prompt text did not land in Flow input' };
    }

    // Attaching a character can leave Flow switching views for a moment, which
    // mounts older images after the first snapshot. Fold in a second look taken
    // right at submission so they are not mistaken for the new render.
    for (const key of collectMediaUrls()) beforeMedia.add(key);

    // Menus, the search box and the gallery all took focus while the
    // character was being attached; give it back before submitting.
    if (hasRefs) await new Promise((r) => setTimeout(r, 1000));
    input.el.focus();

    // Scripted Enter and scripted clicks are both ignored by Flow now, with or
    // without a character: with the prompt sitting in the box, a person's click
    // on the send arrow starts the generation and the extension's does nothing
    // (the same happened on the older build that used to work, so it is not a
    // recent change). A real click, sent through the debugger by the worker, is
    // what Flow accepts. Only if that is unavailable does the old scripted
    // route run, so one submit is never sent twice.
    const send = findSendButton(input.el);
    let submitted = false;
    if (send) {
      const at = send.getBoundingClientRect();
      const reply = (await chrome.runtime
        .sendMessage({
          action: 'trustedClick',
          payload: { x: at.left + at.width / 2, y: at.top + at.height / 2 },
        })
        .catch(() => null)) as { success?: boolean } | null;
      submitted = !!reply?.success;
      console.log('[Roose Flow] real click on the send button:', submitted ? 'sent' : 'not available');
    } else {
      console.log('[Roose Flow] no send button found');
    }

    if (!submitted) {
      clickBlocked = true;
      pressEnter(input.el);
      if (send && hasRefs) {
        await new Promise((r) => setTimeout(r, 1500));
        clickLikeUser(send);
      }
    }

    await new Promise((r) => setTimeout(r, 1500));
    console.log('[Roose Flow] message from Flow after submitting:', readFlowMessages());

    const outcome = await waitForOutcome(beforeMedia, beforeAlerts, timeout);
    console.log('[Roose Flow] outcome:', outcome.kind);

    if (outcome.kind === 'media') {
      // Read the bytes now, while this URL's signature is fresh, rather than
      // leaving the worker to fetch a link that may have expired or been
      // re-signed by the time it gets round to saving.
      let dataUrl: string | undefined;
      try {
        dataUrl = await resolveForDownload(outcome.hit.url);
      } catch (error) {
        console.error('[Roose Flow] could not read the render yet, the worker will retry:', error);
      }
      return {
        success: true,
        imageUrl: outcome.hit.url,
        kind: outcome.hit.kind,
        dataUrl,
        mediaKey: mediaKey(outcome.hit.url),
        ...(clickBlocked ? { warning: 'click-blocked' } : {}),
        ...(missing.length ? { missingReferences: missing } : {}),
      };
    }

    if (outcome.kind === 'error') {
      return { success: false, error: `Flow error: ${outcome.message}` };
    }

    return {
      success: false,
      error: 'Generation timed out',
      ...(clickBlocked ? { warning: 'click-blocked' } : {}),
    };
  } catch (error) {
    console.error('[generatePrompt] Error:', error);
    return {
      success: false,
      error: `Error during prompt generation: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Reads a render's bytes and returns them as a data URL.
 *
 * blob: URLs are scoped to this page and http(s) renders are cross-origin to
 * the worker, so either way the fetch has to happen here, in page context.
 */
export async function resolveForDownload(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  const blob = await fetch(url).then((r) => r.blob());
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/* ------------------------------------------------------------------ */
/* Messaging                                                            */
/* ------------------------------------------------------------------ */

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  // Lets the worker tell a live tab from one that merely matches the URL.
  if (request.action === 'ping') {
    sendResponse({ success: true });
    return false;
  }

  if (request.action === 'generatePrompt') {
    const { text, timeout, characterNames, sceneKeys } = request.payload || {};
    if (!text) {
      sendResponse({ success: false, error: 'Missing text in payload' });
      return false;
    }
    generatePrompt(text, characterNames || [], timeout || 180000, sceneKeys || [])
      .then(sendResponse)
      .catch((error) =>
        sendResponse({ success: false, error: `Handler error: ${String(error)}` })
      );
    return true;
  }

  if (request.action === 'resolveForDownload') {
    resolveForDownload(request.payload?.url)
      .then((url) => sendResponse({ success: true, url }))
      .catch((error) => sendResponse({ success: false, error: String(error) }));
    return true;
  }

  return false;
});

if (isGoogleFlow()) {
  console.log('[Roose Flow] content script ready');
}
