import { describe, it, expect, beforeEach, vi } from 'vitest';

type Call = { method: string; params?: Record<string, unknown> };

const calls: Call[] = [];
let attachError: string | null = null;
let commandError: string | null = null;
const runtime: { lastError?: { message: string } } = {};

vi.stubGlobal('chrome', {
  runtime,
  debugger: {
    attach: vi.fn((_target: unknown, _version: string, cb: () => void) => {
      runtime.lastError = attachError ? { message: attachError } : undefined;
      cb();
      runtime.lastError = undefined;
    }),
    sendCommand: vi.fn(
      (_target: unknown, method: string, params: Record<string, unknown>, cb: () => void) => {
        calls.push({ method, params });
        runtime.lastError = commandError ? { message: commandError } : undefined;
        cb();
        runtime.lastError = undefined;
      }
    ),
    detach: vi.fn((_target: unknown, cb: () => void) => cb()),
  },
});

async function load() {
  vi.resetModules();
  return await import('../src/lib/trustedInput');
}

describe('trustedClick', () => {
  beforeEach(() => {
    calls.length = 0;
    attachError = null;
    commandError = null;
    vi.clearAllMocks();
  });

  it('moves, presses and releases the left button at the given point', async () => {
    const { trustedClick } = await load();

    expect(await trustedClick(7, 640, 480)).toBe(true);

    const mouse = calls.filter((c) => c.method === 'Input.dispatchMouseEvent');
    expect(mouse.map((c) => c.params?.type)).toEqual(['mouseMoved', 'mousePressed', 'mouseReleased']);
    for (const c of mouse) {
      expect(c.params?.x).toBe(640);
      expect(c.params?.y).toBe(480);
    }
    expect(mouse[1].params?.button).toBe('left');
    expect(mouse[1].params?.clickCount).toBe(1);
  });

  it('attaches to a tab only once across several clicks', async () => {
    const { trustedClick } = await load();

    await trustedClick(7, 1, 1);
    await trustedClick(7, 2, 2);

    expect(chrome.debugger.attach).toHaveBeenCalledTimes(1);
  });

  it('reports failure instead of throwing when the debugger cannot attach', async () => {
    attachError = 'Cannot attach to this target.';
    const { trustedClick } = await load();

    expect(await trustedClick(7, 10, 10)).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('reports failure and re-attaches next time when a command fails', async () => {
    const { trustedClick } = await load();
    await trustedClick(7, 1, 1);

    commandError = 'Debugger is not attached to the tab with id: 7.';
    expect(await trustedClick(7, 2, 2)).toBe(false);

    commandError = null;
    await trustedClick(7, 3, 3);
    expect(chrome.debugger.attach).toHaveBeenCalledTimes(2);
  });

  it('detaches every tab it attached to when released', async () => {
    const { trustedClick, releaseTrustedInput } = await load();
    await trustedClick(7, 1, 1);
    await trustedClick(9, 1, 1);

    await releaseTrustedInput();

    expect(chrome.debugger.detach).toHaveBeenCalledTimes(2);
  });

  it('does not try to detach a tab the user already cancelled', async () => {
    const { trustedClick, forgetDetached, releaseTrustedInput } = await load();
    await trustedClick(7, 1, 1);

    forgetDetached(7);
    await releaseTrustedInput();

    expect(chrome.debugger.detach).not.toHaveBeenCalled();
  });
});
