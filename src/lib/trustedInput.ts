/**
 * Real mouse input, through Chrome's debugger protocol.
 *
 * A click dispatched from a page script is flagged as untrusted, and Flow's
 * generate action ignores it: in identical page state the prompt sat in the
 * box when the extension "clicked" send, and generated the moment a person
 * did. Events sent through the debugger enter Chrome's input pipeline, so the
 * page sees them exactly as it sees a physical mouse.
 *
 * The cost is the "Roose Flow is debugging this browser" banner Chrome shows
 * for as long as the debugger is attached, so it is attached lazily and
 * released when a run ends.
 */

const attached = new Set<number>();

/** Wraps a callback-style chrome call, turning lastError into a rejection. */
function call<T>(run: (done: (result?: T) => void) => void): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    run((result) => {
      const failure = chrome.runtime.lastError;
      if (failure) reject(new Error(failure.message));
      else resolve(result);
    });
  });
}

async function ensureAttached(tabId: number): Promise<boolean> {
  if (attached.has(tabId)) return true;

  try {
    await call<void>((done) => chrome.debugger.attach({ tabId }, '1.3', done));
    attached.add(tabId);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Our own earlier attach outlives the service worker being restarted, and
    // then reads as "already attached". Only claim it if a command goes through.
    if (/already attached/i.test(message)) {
      try {
        await call<unknown>((done) =>
          chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', { expression: '1' }, done)
        );
        attached.add(tabId);
        return true;
      } catch {
        /* held by something else */
      }
    }

    console.error('[Roose Flow] could not attach for real input:', message);
    return false;
  }
}

/** Presses and releases the left mouse button at a point in the page's viewport (CSS pixels). */
export async function trustedClick(tabId: number, x: number, y: number): Promise<boolean> {
  if (!(await ensureAttached(tabId))) return false;

  const mouse = (params: Record<string, unknown>) =>
    call<unknown>((done) => chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', params, done));

  try {
    await mouse({ type: 'mouseMoved', x, y });
    await mouse({ type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await mouse({ type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    return true;
  } catch (error) {
    console.error('[Roose Flow] real click failed:', error instanceof Error ? error.message : error);
    attached.delete(tabId);
    return false;
  }
}

/** Drop a tab from the attached set, e.g. when the user dismisses Chrome's banner. */
export function forgetDetached(tabId: number): void {
  attached.delete(tabId);
}

/** Detach everything, which also removes Chrome's debugging banner. */
export async function releaseTrustedInput(): Promise<void> {
  for (const tabId of Array.from(attached)) {
    attached.delete(tabId);
    try {
      await call<void>((done) => chrome.debugger.detach({ tabId }, done));
    } catch {
      /* already detached */
    }
  }
}
