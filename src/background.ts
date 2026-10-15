import { StorageService } from './lib/storage';
import { AutomationController } from './lib/automation';
import { matchCharacters } from './lib/characters';
import { trustedClick, releaseTrustedInput, forgetDetached } from './lib/trustedInput';
import type { QueueItem, AppSettings } from './types/index';

const storage = new StorageService();
const automation = new AutomationController();

const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 5000;

/** No content script is listening; retrying cannot help until the tab reloads. */
const UNREACHABLE = 'content-script-unreachable';

/** Resolved Flow tab, re-verified before each use and dropped when it dies. */
let cachedFlowTabId: number | null = null;

/** Does this tab have a content script actually listening right now? */
async function isAlive(tabId: number): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, { action: 'ping' }, () => {
        resolve(!chrome.runtime.lastError);
      });
    } catch {
      resolve(false);
    }
  });
}

/**
 * Find a Flow tab that can actually receive messages.
 *
 * Several tabs can match the URL while only some have a live content script:
 * a tab opened before the extension was installed or reloaded never got one,
 * and Chrome's Memory Saver discards idle background tabs during long runs,
 * which kills the script but leaves the tab matching the query. Picking the
 * first match blindly meant talking to a dead tab while a working one sat
 * further down the list, so every candidate is pinged before it is used.
 */
async function findFlowTab(): Promise<number | null> {
  if (cachedFlowTabId !== null && (await isAlive(cachedFlowTabId))) {
    return cachedFlowTabId;
  }

  const tabs = await chrome.tabs.query({ url: 'https://flow.google.com/*' });
  if (tabs.length === 0) {
    console.error('[Roose Flow] no flow.google.com tab is open');
    cachedFlowTabId = null;
    return null;
  }

  // A discarded tab cannot answer, and pinging it would wake it pointlessly.
  // Prefer the tab the user is actually looking at.
  const candidates = tabs
    .filter((tab) => tab.id !== undefined && !tab.discarded)
    .sort((a, b) => Number(b.active) - Number(a.active));

  for (const tab of candidates) {
    if (await isAlive(tab.id!)) {
      cachedFlowTabId = tab.id!;
      return cachedFlowTabId;
    }
  }

  console.error(
    `[Roose Flow] found ${tabs.length} Flow tab(s) but none is listening — reload the tab you are generating in`
  );
  cachedFlowTabId = null;
  return null;
}

// Initialize storage on load
storage.initializeIfEmpty();

// Clicking the toolbar icon opens the side panel.
chrome.sidePanel
  ?.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('[background] setPanelBehavior failed:', error));

// The side panel holds a port open for as long as it is on screen. Closing it
// disconnects, which is the signal to drop the queue — a Flow page reload no
// longer touches it.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'sidepanel') return;

  port.onDisconnect.addListener(() => {
    automation.setRunning(false);
    void releaseTrustedInput();
    void storage.clearQueue();
    void storage.updateState({ isRunning: false, currentIndex: 0 });
  });
});

// The user can dismiss Chrome's "debugging this browser" banner at any time,
// which detaches us. Forget the tab so the next click attaches afresh instead
// of failing against a debugger that is no longer there.
chrome.debugger?.onDetach?.addListener((source) => {
  if (source.tabId !== undefined) forgetDetached(source.tabId);
});

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // FIX 3: Add origin validation - allow extension pages and our content script
  const isAllowed = sender.url?.startsWith('chrome-extension://') || sender.url?.includes('flow.google.com');
  if (!isAllowed) {
    sendResponse({ error: 'Unauthorized origin' });
    return false;
  }
  handleMessage(request, sender).then(sendResponse).catch(console.error);
  return true; // Will respond asynchronously
});

async function handleMessage(
  request: {
    action?: string;
    payload?: Record<string, unknown>;
  },
  sender: chrome.runtime.MessageSender
): Promise<Record<string, unknown>> {
  const { action, payload } = request;

  switch (action) {
    case 'addPrompt': {
      const text = payload?.text as string;
      if (!text) return { success: false, error: 'Missing text' };
      const rawNumber = payload?.number;
      const number =
        typeof rawNumber === 'number' && Number.isInteger(rawNumber) && rawNumber > 0
          ? rawNumber
          : undefined;

      await storage.updateQueue((queue) => [
        ...queue,
        {
          id: `${Date.now()}-${queue.length}`,
          text,
          ...(number !== undefined ? { number } : {}),
          status: 'pending' as const,
        },
      ]);
      await broadcastUpdate('QUEUE_UPDATE');
      const queue = await storage.getQueue();
      return { success: true, queue };
    }

    case 'removePrompt': {
      const id = payload?.id as string;
      if (!id) return { success: false, error: 'Missing id' };

      await storage.updateQueue((queue) => queue.filter((item) => item.id !== id));
      await broadcastUpdate('QUEUE_UPDATE');
      const queue = await storage.getQueue();
      return { success: true, queue };
    }

    case 'reorderQueue': {
      const newQueue = payload?.queue as QueueItem[];
      if (!Array.isArray(newQueue)) return { success: false, error: 'Invalid queue' };

      await storage.saveQueue(newQueue);
      await broadcastUpdate('QUEUE_UPDATE');
      const queue = await storage.getQueue();
      return { success: true, queue };
    }

    case 'updateSettings': {
      const settings = payload?.settings;
      if (!settings) return { success: false, error: 'Missing settings' };

      await storage.updateSettings(settings);
      await broadcastUpdate('SETTINGS_UPDATE');
      return { success: true };
    }

    case 'start': {
      automation.setRunning(true);
      // Plain start always runs the queue from the top.
      await storage.updateState({ isRunning: true, currentIndex: 0 });
      await broadcastUpdate('AUTOMATION_STATE');
      startAutomationLoop().catch(err => console.error('[background] Loop error:', err));
      return { success: true };
    }

    case 'pause': {
      automation.setRunning(false);
      await releaseTrustedInput();
      await storage.updateState({ isRunning: false });
      await broadcastUpdate('AUTOMATION_STATE');
      return { success: true };
    }

    case 'stop': {
      automation.setRunning(false);
      await releaseTrustedInput();
      await storage.updateState({ isRunning: false, currentIndex: 0 });
      await broadcastUpdate('AUTOMATION_STATE');
      return { success: true };
    }

    // The page asks for a real click because Flow ignores scripted ones on the
    // send button. Only the tab that asked can be clicked.
    case 'trustedClick': {
      const tabId = sender.tab?.id;
      const x = payload?.x;
      const y = payload?.y;
      if (tabId === undefined || typeof x !== 'number' || typeof y !== 'number') {
        return { success: false, error: 'Invalid click request' };
      }
      return { success: await trustedClick(tabId, x, y) };
    }

    case 'continueFrom': {
      const index = payload?.index as number;
      const current = await storage.getQueue();
      if (typeof index !== 'number' || index < 0 || index >= current.length) {
        return { success: false, error: 'Invalid index' };
      }

      // Re-queue everything from here to the end regardless of what it was
      // before, so prompts that already ran are generated again.
      await storage.updateQueue((q) =>
        q.map((item, i) => (i >= index ? { ...item, status: 'pending' as const } : item))
      );

      automation.setRunning(true);
      await storage.updateState({ isRunning: true, currentIndex: index });
      await broadcastUpdate('AUTOMATION_STATE');
      startAutomationLoop().catch((err) => console.error('[background] Loop error:', err));
      return { success: true };
    }

    case 'getQueue': {
      const queue = await storage.getQueue();
      return { success: true, queue };
    }

    case 'getSettings': {
      const settings = await storage.getSettings();
      return { success: true, settings };
    }

    case 'getState': {
      const state = await storage.getState();
      return { success: true, isRunning: state?.isRunning || false, currentIndex: state?.currentIndex || 0 };
    }

    case 'getCharacters': {
      const characters = await storage.getCharacters();
      return { success: true, characters };
    }

    case 'addCharacter': {
      const name = (payload?.name as string)?.trim();
      const trigger = ((payload?.trigger as string) || name)?.trim();
      if (!name) return { success: false, error: 'Missing name' };

      // Re-adding an existing tile name updates its trigger rather than
      // creating a duplicate, so fixing a mismatch is just re-submitting it.
      await storage.updateCharacters((chars) => [
        ...chars.filter((c) => c.name !== name),
        { name, trigger },
      ]);
      await broadcastUpdate('CHARACTERS_UPDATE');
      const characters = await storage.getCharacters();
      return { success: true, characters };
    }

    case 'removeCharacter': {
      const name = payload?.name as string;
      if (!name) return { success: false, error: 'Missing name' };

      await storage.updateCharacters((chars) => chars.filter((c) => c.name !== name));
      await broadcastUpdate('CHARACTERS_UPDATE');
      const characters = await storage.getCharacters();
      return { success: true, characters };
    }

    case 'clearQueue': {
      automation.setRunning(false);
      await storage.clearQueue();
      await storage.updateState({ isRunning: false, currentIndex: 0 });
      await broadcastUpdate('QUEUE_UPDATE');
      return { success: true, queue: [] };
    }

    default:
      return { success: false, error: `Unknown action: ${action}` };
  }
}

/**
 * Main automation loop
 * Processes pending items one at a time with delays between them
 */
async function startAutomationLoop(): Promise<void> {
  try {
    // Captured once: the loop advances currentIndex as it goes, but the floor
    // for picking work stays wherever the run was told to begin.
    const { currentIndex: startIndex } = await storage.getState();
    console.log('[Roose Flow] run starting at index', startIndex);

    while (automation.getRunning()) {
      const queue = await storage.getQueue();
      const nextItem = automation.getNextPending(queue, startIndex);

      if (!nextItem) {
        console.log('[Roose Flow] nothing pending in a queue of', queue.length, '— stopping');
        automation.setRunning(false);
        await releaseTrustedInput();
        await storage.updateState({ isRunning: false });
        await broadcastUpdate('AUTOMATION_STATE');
        break;
      }

      const itemIndex = queue.findIndex((i) => i.id === nextItem.id);
      console.log(`[Roose Flow] prompt ${itemIndex + 1} of ${queue.length}`);
      await storage.updateState({ currentIndex: itemIndex });

      // Mark as in-progress
      await storage.updateQueue((q) =>
        q.map((item) =>
          item.id === nextItem.id ? { ...item, status: 'in-progress' as const } : item
        )
      );
      await broadcastUpdate('QUEUE_UPDATE');

      const characters = await storage.getCharacters();
      const characterNames = matchCharacters(nextItem.text, characters);
      console.log(
        '[Roose Flow] character list:',
        characters.length
          ? characters.map((c) => `${c.name} (trigger: "${c.trigger}")`).join(', ')
          : '(empty)'
      );
      console.log(
        '[Roose Flow] matched for this prompt:',
        characterNames.length ? characterNames.join(', ') : '(none)'
      );

      // Flow intermittently errors on a prompt that succeeds on a second try,
      // so re-submit the same text a few times before giving up on it.
      let result: Record<string, unknown> | null = null;
      let unreachable = false;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        result = await sendToContentScript({
          action: 'generatePrompt',
          payload: { text: nextItem.text, characterNames },
        });

        if (result?.success) break;

        // Retrying a page that has no content script just burns the queue.
        if (result?.error === UNREACHABLE) {
          unreachable = true;
          break;
        }

        console.log(
          `[Roose Flow] attempt ${attempt}/${MAX_ATTEMPTS} failed:`,
          result?.error ?? 'no response from the Flow tab'
        );
        if (!automation.getRunning()) break;
        if (attempt < MAX_ATTEMPTS) {
          // Give Flow a moment to clear its error state before resubmitting.
          await automation.sleep(RETRY_BACKOFF_MS);
        }
      }

      if (unreachable) {
        console.error(
          '[Roose Flow] stopped — reload the flow.google.com tab, then start again'
        );
        // Hand the prompt back rather than marking it skipped: nothing about it
        // failed, the page simply was not listening.
        await storage.updateQueue((q) =>
          q.map((item) =>
            item.id === nextItem.id ? { ...item, status: 'pending' as const } : item
          )
        );
        automation.setRunning(false);
        await storage.updateState({ isRunning: false });
        await broadcastUpdate('QUEUE_UPDATE');
        await broadcastUpdate('AUTOMATION_STATE');
        break;
      }

      if (result?.success && result.imageUrl) {
        // Mark as done and save image URL
        const finalResult = result;
        await storage.updateQueue((q) =>
          q.map((item) =>
            item.id === nextItem.id
              ? {
                  ...item,
                  status: 'done' as const,
                  imageUrl: finalResult.imageUrl as string,
                }
              : item
          )
        );

        const settings = await storage.getSettings();
        console.log('[Roose Flow] autoDownload setting:', settings.autoDownload);
        if (settings.autoDownload) {
          await saveMedia(
            finalResult.imageUrl as string,
            (finalResult.kind as string) || 'image',
            nextItem.number ?? itemIndex + 1,
            settings,
            finalResult.dataUrl as string | undefined
          );
        }
      } else {
        // Mark as skipped (after failed retry)
        await storage.updateQueue((q) =>
          q.map((item) =>
            item.id === nextItem.id ? { ...item, status: 'skipped' as const } : item
          )
        );
      }

      await broadcastUpdate('QUEUE_UPDATE');

      // Wait for random delay before next item
      if (automation.getRunning()) {
        const settings = await storage.getSettings();
        const delay = automation.getRandomDelay(
          settings.delayMin * 1000,
          settings.delayMax * 1000
        );
        await automation.sleep(delay);
      }
    }
  } catch (error) {
    console.error('Automation loop failed:', error);
    automation.setRunning(false);
    await releaseTrustedInput();
    await broadcastUpdate('AUTOMATION_STATE');
  }
}

const MEDIA_EXTENSIONS: Record<string, string> = {
  'image/webp': 'webp',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

/** Name the file after what it actually contains, not what we hoped for. */
function extensionFor(dataUrl: string, kind: string): string {
  const mime = /^data:([^;,]+)/.exec(dataUrl)?.[1]?.toLowerCase();
  return (mime && MEDIA_EXTENSIONS[mime]) || (kind === 'video' ? 'mp4' : 'webp');
}

/**
 * Renders live as page-scoped blob URLs, which the worker cannot read. The
 * content script fetches them in page context and hands back a data URL.
 */
async function inlineMedia(url: string): Promise<string | null> {
  // Signed image links can be briefly unreadable while Flow re-signs them, so
  // one failure is not proof the render is gone. A single miss here used to
  // mean that prompt was quietly never saved.
  for (let attempt = 1; attempt <= 3; attempt++) {
    const resolved = await sendToContentScript({
      action: 'resolveForDownload',
      payload: { url },
    });
    if (resolved?.success) return resolved.url as string;

    console.error(`[Roose Flow] could not read the render (attempt ${attempt}/3):`, resolved?.error);
    if (attempt < 3) await automation.sleep(1500);
  }
  return null;
}

/**
 * Save a finished render. Flow decides the output resolution; this keeps
 * whatever it produced, at full size.
 *
 * Two routes: a folder the user picked, which only the side panel can write to
 * because it holds the grant, or chrome.downloads, which can only ever write
 * inside Chrome's own Downloads directory.
 */
async function saveMedia(
  url: string,
  kind: string,
  index: number,
  settings: AppSettings,
  prefetched?: string
): Promise<void> {
  // Always inline. The bytes are needed for a custom folder anyway, and the
  // MIME type they carry is the only reliable source for the extension. The
  // page reads them at the moment a render is accepted; only if that failed
  // does the worker go back and ask again.
  const dataUrl = prefetched ?? (await inlineMedia(url));
  if (!dataUrl) {
    console.error(`[Roose Flow] prompt ${index}: render could not be read, NOT saved`);
    return;
  }

  const filename = `${String(index).padStart(3, '0')}.${extensionFor(dataUrl, kind)}`;

  if (settings.customFolderName) {
    const response = (await chrome.runtime
      .sendMessage({ type: 'SAVE_MEDIA', dataUrl, filename })
      .catch(() => null)) as { saved?: boolean; reason?: string } | null;

    if (response?.saved) {
      console.log('[Roose Flow] saved to chosen folder:', filename);
      return;
    }
    console.error(
      '[Roose Flow] chosen folder unavailable, falling back to Downloads:',
      response?.reason ?? 'side panel is closed'
    );
  }

  try {
    const dir = settings.downloadFolder.trim().replace(/^[/\\]+|[/\\]+$/g, '') || 'roose-flow';
    const downloadUrl = toBlobUrlIfPossible(dataUrl);
    const downloadId = await chrome.downloads.download({
      url: downloadUrl,
      filename: `${dir}/${filename}`,
      saveAs: false,
    });
    if (downloadUrl !== dataUrl) pendingBlobUrls.set(downloadId, downloadUrl);
    console.log('[Roose Flow] download started, id', downloadId, '→', `${dir}/${filename}`);
  } catch (error) {
    console.error('[Roose Flow] save failed:', error);
  }
}

/**
 * chrome.downloads.download has to base64-decode and buffer a data: URL in
 * full before it can write anything to disk, which for a multi-megabyte
 * render is a real, documented place for a download to fail silently. A
 * blob: URL avoids that decode step entirely. Falls back to the original
 * data: URL untouched if createObjectURL is unavailable in this worker.
 */
function toBlobUrlIfPossible(dataUrl: string): string {
  try {
    if (typeof URL.createObjectURL !== 'function') return dataUrl;
    const [meta, base64] = dataUrl.split(',');
    const mime = /:(.*?);/.exec(meta)?.[1] ?? 'application/octet-stream';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  } catch (error) {
    console.error('[Roose Flow] could not create a blob URL, using the data URL directly:', error);
    return dataUrl;
  }
}

// Blob URLs created above are revoked once their download settles, not
// immediately, since the download may not have finished writing yet when
// chrome.downloads.download() first resolves with an id.
const pendingBlobUrls = new Map<number, string>();

chrome.downloads.onChanged.addListener((delta) => {
  const state = delta.state?.current;
  if (state === 'complete') {
    console.log('[Roose Flow] download complete, id', delta.id);
  } else if (state === 'interrupted') {
    console.error('[Roose Flow] download interrupted, id', delta.id, 'reason:', delta.error?.current);
  } else {
    return;
  }

  const blobUrl = pendingBlobUrls.get(delta.id);
  if (blobUrl) {
    URL.revokeObjectURL(blobUrl);
    pendingBlobUrls.delete(delta.id);
  }
});

/**
 * Send message to content script with timeout
 */
async function sendToContentScript(
  message: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  try {
    const tabId = await findFlowTab();
    if (tabId === null) return { success: false, error: UNREACHABLE };

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(null);
      }, 240000); // must outlast the content script's own generation timeout

      chrome.tabs.sendMessage(tabId, message, (response) => {
        clearTimeout(timeout);
        const failure = chrome.runtime.lastError;
        if (failure) {
          // The tab answered a ping moments ago, so it has gone away mid-send.
          // Drop it from the cache so the next attempt re-scans.
          cachedFlowTabId = null;
          console.error('[Roose Flow] lost the Flow page mid-request:', failure.message);
          resolve({ success: false, error: UNREACHABLE });
          return;
        }
        resolve(response || null);
      });
    });
  } catch (error) {
    console.error('[sendToContentScript] Error:', error);
    return null;
  }
}

/**
 * Broadcast updates to all tabs
 */
async function broadcastUpdate(updateType: string): Promise<void> {
  try {
    // Payload travels with the broadcast so the sidebar can re-render from it
    // directly instead of issuing another round-trip per update.
    const message: Record<string, unknown> = { type: updateType };
    if (updateType === 'QUEUE_UPDATE') {
      message.queue = await storage.getQueue();
    } else if (updateType === 'AUTOMATION_STATE') {
      const state = await storage.getState();
      message.isRunning = state.isRunning;
      message.currentIndex = state.currentIndex;
      message.queue = await storage.getQueue();
    } else if (updateType === 'SETTINGS_UPDATE') {
      message.settings = await storage.getSettings();
    } else if (updateType === 'CHARACTERS_UPDATE') {
      message.characters = await storage.getCharacters();
    }

    // Goes to the side panel. Throws when no panel is open, which is normal.
    await chrome.runtime.sendMessage(message).catch(() => {});
  } catch (error) {
    console.error('[background] Broadcast error:', error);
  }
}

