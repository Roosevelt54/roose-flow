import { useState, useEffect, useRef, useCallback } from 'react';
import {
  isSupported,
  loadSavedDirectory,
  forgetDirectory,
  pickDirectory,
  checkPermission,
  writeFile,
  dataUrlToBlob,
} from '../../lib/directory';

export interface SaveNotification {
  text: string;
  kind: 'success' | 'error';
}

interface UseDirectoryReturn {
  /** False where the folder picker is unavailable; the UI hides the control. */
  supported: boolean;
  /** Name of the chosen folder, or null when saving to Chrome's Downloads. */
  folderName: string | null;
  /** A folder is remembered but Chrome dropped the grant — needs one click. */
  needsPermission: boolean;
  error: string | null;
  /** Most recent save attempt into the chosen folder, self-clearing after a few seconds. */
  notification: SaveNotification | null;
  choose: () => Promise<void>;
  reconnect: () => Promise<void>;
  clear: () => Promise<void>;
}

const NOTIFICATION_MS = 4000;

/**
 * Owns the output folder and performs the writes.
 *
 * The service worker drives generation but cannot hold a directory grant, so it
 * hands finished renders to the panel over SAVE_MEDIA and this hook writes them.
 */
export function useDirectory(): UseDirectoryReturn {
  const [folderName, setFolderName] = useState<string | null>(null);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<SaveNotification | null>(null);

  // The listener is registered once, so it reads the handle through a ref
  // rather than closing over a stale value.
  const handleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const notificationTimeoutRef = useRef<number | null>(null);

  const notify = useCallback((next: SaveNotification) => {
    if (notificationTimeoutRef.current !== null) {
      window.clearTimeout(notificationTimeoutRef.current);
    }
    setNotification(next);
    notificationTimeoutRef.current = window.setTimeout(() => setNotification(null), NOTIFICATION_MS);
  }, []);

  const adopt = useCallback(async (handle: FileSystemDirectoryHandle | null) => {
    handleRef.current = handle;
    setFolderName(handle?.name ?? null);
    // The worker decides whether to route a render here or to chrome.downloads.
    await chrome.runtime
      .sendMessage({
        action: 'updateSettings',
        payload: { settings: { customFolderName: handle?.name ?? null } },
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isSupported()) return;

    loadSavedDirectory()
      .then(async (handle) => {
        if (!handle) return;
        handleRef.current = handle;
        setFolderName(handle.name);
        setNeedsPermission((await checkPermission(handle)) !== 'granted');
      })
      .catch(() => setError('Could not restore the saved folder'));
  }, []);

  useEffect(() => {
    const listener = (
      message: { type?: string; dataUrl?: string; filename?: string },
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: { saved: boolean; reason?: string }) => void
    ) => {
      if (message?.type !== 'SAVE_MEDIA') return false;

      const directory = handleRef.current;
      const { dataUrl, filename } = message;
      if (!directory || !dataUrl || !filename) {
        sendResponse({ saved: false, reason: 'no-folder' });
        return false;
      }

      void (async () => {
        try {
          // Cannot prompt here: a background save is not a user gesture.
          if ((await checkPermission(directory)) !== 'granted') {
            setNeedsPermission(true);
            notify({ text: `Could not save ${filename} — folder access lost`, kind: 'error' });
            sendResponse({ saved: false, reason: 'permission-lapsed' });
            return;
          }
          await writeFile(directory, filename, dataUrlToBlob(dataUrl));
          notify({ text: `Saved ${filename}`, kind: 'success' });
          sendResponse({ saved: true });
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          notify({ text: `Could not save ${filename} — ${reason}`, kind: 'error' });
          sendResponse({ saved: false, reason });
        }
      })();

      return true; // responding asynchronously
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const choose = useCallback(async () => {
    try {
      setError(null);
      await adopt(await pickDirectory());
      setNeedsPermission(false);
    } catch (err) {
      // Dismissing the picker is a normal outcome, not a failure.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Could not open the folder picker');
    }
  }, [adopt]);

  const reconnect = useCallback(async () => {
    const directory = handleRef.current;
    if (!directory) return;
    try {
      setError(null);
      setNeedsPermission((await checkPermission(directory, true)) !== 'granted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restore access');
    }
  }, []);

  const clear = useCallback(async () => {
    await forgetDirectory();
    await adopt(null);
    setNeedsPermission(false);
  }, [adopt]);

  return {
    supported: isSupported(),
    folderName,
    needsPermission,
    error,
    notification,
    choose,
    reconnect,
    clear,
  };
}
