export type QueueItemStatus = 'pending' | 'in-progress' | 'done' | 'skipped';

export interface QueueItem {
  id: string;
  text: string;
  /** Shot number from an imported shot list; names the saved file. */
  number?: number;
  status: QueueItemStatus;
  imageUrl?: string;
}

export interface AppSettings {
  autoDownload: boolean;
  serialNumber: boolean;
  characterConsistency: boolean;
  /** Subfolder under Chrome's Downloads directory, used when no folder is picked. */
  downloadFolder: string;
  /**
   * Display name of the folder chosen through the picker, or null to save via
   * Chrome's downloads. The handle itself lives in the side panel's IndexedDB;
   * only the name is mirrored here so the worker knows where to route a render.
   */
  customFolderName: string | null;
  delayMin: number;
  delayMax: number;
}

export interface AutomationState {
  isRunning: boolean;
  currentIndex: number;
}

export interface StorageData {
  queue: QueueItem[];
  settings: AppSettings;
}

export interface GenerateResult {
  success: boolean;
  data: string;
}

export interface QueueUpdateMessage {
  type: 'QUEUE_UPDATE';
  item: QueueItem;
}

export interface ContentScriptMessage {
  type: 'QUEUE_UPDATE' | 'AUTOMATION_STATE';
  payload: Record<string, unknown>;
}

export interface ServiceWorkerMessage {
  type: 'START_AUTOMATION' | 'STOP_AUTOMATION' | 'UPDATE_SETTINGS';
  payload: Record<string, unknown>;
}
