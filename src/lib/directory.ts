/**
 * Persistent access to a user-chosen output folder.
 *
 * chrome.downloads can only write inside Chrome's own Downloads directory, and
 * no extension API can move that directory. Saving anywhere else means going
 * through the File System Access API and holding on to the handle the user
 * grants, which is what this module stores.
 *
 * Side-panel only: picking a folder and re-granting access both need a user
 * gesture, which a service worker never has.
 */

const DB_NAME = 'roose-flow';
const STORE = 'handles';
const KEY = 'output-directory';

export type DirectoryPermission = 'granted' | 'denied' | 'prompt';

/** queryPermission/requestPermission are not in lib.dom yet. */
type PermissionCapableHandle = FileSystemDirectoryHandle & {
  queryPermission(descriptor: { mode: 'readwrite' }): Promise<DirectoryPermission>;
  requestPermission(descriptor: { mode: 'readwrite' }): Promise<DirectoryPermission>;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

/** False wherever the picker is unavailable, so callers can fall back. */
export function isSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function loadSavedDirectory(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await withStore<FileSystemDirectoryHandle | undefined>('readonly', (store) =>
      store.get(KEY)
    );
    return handle ?? null;
  } catch {
    return null;
  }
}

export async function forgetDirectory(): Promise<void> {
  try {
    await withStore('readwrite', (store) => store.delete(KEY));
  } catch {
    /* the handle is a convenience; failing to drop it is not worth surfacing */
  }
}

/** Opens the native folder picker. Must be called from a user gesture. */
export async function pickDirectory(): Promise<FileSystemDirectoryHandle> {
  const picker = (
    window as unknown as {
      showDirectoryPicker(options?: {
        mode?: 'read' | 'readwrite';
        id?: string;
      }): Promise<FileSystemDirectoryHandle>;
    }
  ).showDirectoryPicker;

  const handle = await picker({ mode: 'readwrite', id: 'roose-flow-output' });
  await withStore('readwrite', (store) => store.put(handle, KEY));
  return handle;
}

/**
 * Grants lapse between browser sessions. Pass `request` only from a user
 * gesture — asking outside one throws.
 */
export async function checkPermission(
  handle: FileSystemDirectoryHandle,
  request = false
): Promise<DirectoryPermission> {
  const capable = handle as PermissionCapableHandle;
  const current = await capable.queryPermission({ mode: 'readwrite' });
  if (current === 'granted' || !request) return current;
  return capable.requestPermission({ mode: 'readwrite' });
}

/** Writes into the chosen folder, creating any intermediate directories. */
export async function writeFile(
  handle: FileSystemDirectoryHandle,
  path: string,
  data: Blob
): Promise<void> {
  const segments = path.split('/').filter(Boolean);
  const name = segments.pop();
  if (!name) throw new Error('Empty file path');

  let directory = handle;
  for (const segment of segments) {
    directory = await directory.getDirectoryHandle(segment, { create: true });
  }

  const file = await directory.getFileHandle(name, { create: true });
  const writable = await file.createWritable();
  await writable.write(data);
  await writable.close();
}

/** Renders arrive as data URLs, since the worker cannot read page blob URLs. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(',');
  const mime = /:(.*?);/.exec(meta)?.[1] ?? 'application/octet-stream';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
