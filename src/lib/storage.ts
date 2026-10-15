import type { QueueItem, AppSettings, AutomationState } from '../types/index';
import type { CharacterEntry } from './characters';

const DEFAULT_SETTINGS: AppSettings = {
  autoDownload: true,
  serialNumber: false,
  characterConsistency: false,
  downloadFolder: '',
  customFolderName: null,
  delayMin: 5,
  delayMax: 15,
};

const DEFAULT_STATE: AutomationState = {
  isRunning: false,
  currentIndex: 0,
};

export class StorageService {
  // The queue lives in session storage: never written to disk, dropped when the
  // browser closes, but — unlike a plain module variable — it survives the
  // service worker being shut down mid-run.
  async getQueue(): Promise<QueueItem[]> {
    try {
      const result = await chrome.storage.session.get(['queue']);
      return result.queue || [];
    } catch (error) {
      console.error('Error getting queue:', error);
      return [];
    }
  }

  async saveQueue(queue: QueueItem[]): Promise<void> {
    try {
      await chrome.storage.session.set({ queue });
    } catch (error) {
      console.error('Error saving queue:', error);
    }
  }

  async updateQueue(updater: (queue: QueueItem[]) => QueueItem[]): Promise<void> {
    const current = await this.getQueue();
    await this.saveQueue(updater(current));
  }

  async clearQueue(): Promise<void> {
    try {
      await chrome.storage.session.remove('queue');
    } catch (error) {
      console.error('Error clearing queue:', error);
    }
  }

  async getSettings(): Promise<AppSettings> {
    try {
      const result = await chrome.storage.local.get(['settings']);
      return result.settings || DEFAULT_SETTINGS;
    } catch (error) {
      console.error('Error getting settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  async updateSettings(partial: Partial<AppSettings>): Promise<void> {
    try {
      const current = await this.getSettings();
      const updated = { ...current, ...partial };
      await chrome.storage.local.set({ settings: updated });
    } catch (error) {
      console.error('Error updating settings:', error);
    }
  }

  async getState(): Promise<AutomationState> {
    try {
      const result = await chrome.storage.local.get(['automationState']);
      return result.automationState || DEFAULT_STATE;
    } catch (error) {
      console.error('Error getting state:', error);
      return DEFAULT_STATE;
    }
  }

  async updateState(partial: Partial<AutomationState>): Promise<void> {
    try {
      const current = await this.getState();
      const updated = { ...current, ...partial };
      await chrome.storage.local.set({ automationState: updated });
    } catch (error) {
      console.error('Error updating state:', error);
    }
  }

  // Character entries persist in local storage, like settings: they name
  // durable Flow assets, not run-scoped queue data.
  async getCharacters(): Promise<CharacterEntry[]> {
    try {
      const result = await chrome.storage.local.get(['characters']);
      const raw = (result.characters || []) as Array<string | CharacterEntry>;
      // Migrate entries saved before trigger text was split out from name.
      return raw.map((c) => (typeof c === 'string' ? { name: c, trigger: c } : c));
    } catch (error) {
      console.error('Error getting characters:', error);
      return [];
    }
  }

  async saveCharacters(characters: CharacterEntry[]): Promise<void> {
    try {
      await chrome.storage.local.set({ characters });
    } catch (error) {
      console.error('Error saving characters:', error);
    }
  }

  async updateCharacters(
    updater: (characters: CharacterEntry[]) => CharacterEntry[]
  ): Promise<void> {
    const current = await this.getCharacters();
    await this.saveCharacters(updater(current));
  }

  async initializeIfEmpty(): Promise<void> {
    try {
      // Drop any queue persisted by earlier versions of the extension.
      await chrome.storage.local.remove('queue');
      const data = await chrome.storage.local.get(['settings', 'automationState']);
      if (!data.settings || !data.automationState) {
        await chrome.storage.local.set({
          settings: data.settings || DEFAULT_SETTINGS,
          automationState: data.automationState || DEFAULT_STATE,
        });
      }
    } catch (error) {
      console.error('Error initializing storage:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      await chrome.storage.local.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }
}
