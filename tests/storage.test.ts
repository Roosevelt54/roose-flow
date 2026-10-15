import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageService } from '../src/lib/storage';
import type { QueueItem, AppSettings, AutomationState } from '../src/types/index';

// Settings and automation state live in local storage; the queue lives in
// session storage so it never reaches disk.
const mockStorageLocal = {
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  clear: vi.fn(),
};

const mockStorageSession = {
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  clear: vi.fn(),
};

vi.stubGlobal('chrome', {
  storage: {
    local: mockStorageLocal,
    session: mockStorageSession,
  },
});

describe('StorageService', () => {
  let storage: StorageService;

  beforeEach(() => {
    storage = new StorageService();
    vi.clearAllMocks();
  });

  describe('getQueue', () => {
    it('returns default empty array when no queue exists', async () => {
      mockStorageSession.get.mockResolvedValue({});
      const result = await storage.getQueue();
      expect(result).toEqual([]);
      expect(mockStorageSession.get).toHaveBeenCalledWith(['queue']);
    });

    it('returns stored queue items', async () => {
      const mockQueue: QueueItem[] = [
        { id: '1', text: 'Task 1', status: 'pending' },
        { id: '2', text: 'Task 2', status: 'in-progress' },
      ];
      mockStorageSession.get.mockResolvedValue({ queue: mockQueue });
      const result = await storage.getQueue();
      expect(result).toEqual(mockQueue);
    });

    it('never reads the queue from disk-backed local storage', async () => {
      mockStorageSession.get.mockResolvedValue({});
      await storage.getQueue();
      expect(mockStorageLocal.get).not.toHaveBeenCalled();
    });
  });

  describe('saveQueue', () => {
    it('stores queue items in session storage', async () => {
      const queue: QueueItem[] = [
        { id: '1', text: 'Task 1', status: 'done' },
      ];
      mockStorageSession.set.mockResolvedValue(undefined);
      await storage.saveQueue(queue);
      expect(mockStorageSession.set).toHaveBeenCalledWith({ queue });
      expect(mockStorageLocal.set).not.toHaveBeenCalled();
    });
  });

  describe('updateQueue', () => {
    it('updates queue using updater function', async () => {
      const mockQueue: QueueItem[] = [
        { id: '1', text: 'Task 1', status: 'pending' },
      ];
      mockStorageSession.get.mockResolvedValue({ queue: mockQueue });
      mockStorageSession.set.mockResolvedValue(undefined);

      await storage.updateQueue((queue) => [
        ...queue,
        { id: '2', text: 'Task 2', status: 'pending' },
      ]);

      expect(mockStorageSession.set).toHaveBeenCalledWith({
        queue: [
          { id: '1', text: 'Task 1', status: 'pending' },
          { id: '2', text: 'Task 2', status: 'pending' },
        ],
      });
    });

    it('handles empty queue in updater', async () => {
      mockStorageSession.get.mockResolvedValue({});
      mockStorageSession.set.mockResolvedValue(undefined);

      await storage.updateQueue((queue) => [
        ...queue,
        { id: '1', text: 'Task 1', status: 'pending' },
      ]);

      expect(mockStorageSession.set).toHaveBeenCalledWith({
        queue: [{ id: '1', text: 'Task 1', status: 'pending' }],
      });
    });
  });

  describe('clearQueue', () => {
    it('drops the queue from session storage', async () => {
      mockStorageSession.remove.mockResolvedValue(undefined);
      await storage.clearQueue();
      expect(mockStorageSession.remove).toHaveBeenCalledWith('queue');
    });
  });

  describe('getSettings', () => {
    it('returns default settings when none exist', async () => {
      mockStorageLocal.get.mockResolvedValue({});
      const result = await storage.getSettings();
      expect(result).toEqual({
        autoDownload: true,
        serialNumber: false,
        characterConsistency: false,
        downloadFolder: '',
        customFolderName: null,
        delayMin: 5,
        delayMax: 15,
      });
      expect(mockStorageLocal.get).toHaveBeenCalledWith(['settings']);
    });

    it('returns stored settings', async () => {
      const mockSettings: AppSettings = {
        autoDownload: false,
        serialNumber: true,
        characterConsistency: true,
        downloadFolder: '/downloads',
        customFolderName: 'Renders',
        delayMin: 10,
        delayMax: 20,
      };
      mockStorageLocal.get.mockResolvedValue({ settings: mockSettings });
      const result = await storage.getSettings();
      expect(result).toEqual(mockSettings);
    });
  });

  describe('updateSettings', () => {
    it('merges partial settings updates', async () => {
      const existingSettings: AppSettings = {
        autoDownload: true,
        serialNumber: false,
        characterConsistency: false,
        downloadFolder: '',
        customFolderName: null,
        delayMin: 5,
        delayMax: 15,
      };
      mockStorageLocal.get.mockResolvedValue({ settings: existingSettings });
      mockStorageLocal.set.mockResolvedValue(undefined);

      await storage.updateSettings({ delayMin: 10, autoDownload: false });

      expect(mockStorageLocal.set).toHaveBeenCalledWith({
        settings: {
          autoDownload: false,
          serialNumber: false,
          characterConsistency: false,
          downloadFolder: '',
          customFolderName: null,
          delayMin: 10,
          delayMax: 15,
        },
      });
    });
  });

  describe('getState', () => {
    it('returns default state when none exists', async () => {
      mockStorageLocal.get.mockResolvedValue({});
      const result = await storage.getState();
      expect(result).toEqual({
        isRunning: false,
        currentIndex: 0,
      });
      expect(mockStorageLocal.get).toHaveBeenCalledWith(['automationState']);
    });

    it('returns stored automation state', async () => {
      const mockState: AutomationState = {
        isRunning: true,
        currentIndex: 5,
      };
      mockStorageLocal.get.mockResolvedValue({ automationState: mockState });
      const result = await storage.getState();
      expect(result).toEqual(mockState);
    });
  });

  describe('updateState', () => {
    it('updates automation state fields', async () => {
      mockStorageLocal.get.mockResolvedValue({
        automationState: { isRunning: false, currentIndex: 0 },
      });
      mockStorageLocal.set.mockResolvedValue(undefined);

      await storage.updateState({ isRunning: true });

      expect(mockStorageLocal.set).toHaveBeenCalledWith({
        automationState: { isRunning: true, currentIndex: 0 },
      });
    });
  });

  describe('initializeIfEmpty', () => {
    it('creates default storage structure when empty', async () => {
      mockStorageLocal.get.mockResolvedValue({});
      mockStorageLocal.set.mockResolvedValue(undefined);
      mockStorageLocal.remove.mockResolvedValue(undefined);

      await storage.initializeIfEmpty();

      expect(mockStorageLocal.set).toHaveBeenCalledWith({
        settings: {
          autoDownload: true,
          serialNumber: false,
          characterConsistency: false,
          downloadFolder: '',
          customFolderName: null,
          delayMin: 5,
          delayMax: 15,
        },
        automationState: {
          isRunning: false,
          currentIndex: 0,
        },
      });
    });

    it('discards a queue persisted by an earlier version', async () => {
      mockStorageLocal.get.mockResolvedValue({});
      mockStorageLocal.set.mockResolvedValue(undefined);
      mockStorageLocal.remove.mockResolvedValue(undefined);

      await storage.initializeIfEmpty();

      expect(mockStorageLocal.remove).toHaveBeenCalledWith('queue');
    });

    it('skips initialization if storage already has data', async () => {
      mockStorageLocal.get.mockResolvedValue({
        queue: [{ id: '1', text: 'Task', status: 'pending' }],
        settings: {
          autoDownload: true,
          serialNumber: false,
          characterConsistency: false,
          downloadFolder: '',
          customFolderName: null,
          delayMin: 5,
          delayMax: 15,
        },
        automationState: {
          isRunning: false,
          currentIndex: 0,
        },
      });

      await storage.initializeIfEmpty();

      expect(mockStorageLocal.set).not.toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('empties all storage', async () => {
      mockStorageLocal.clear.mockResolvedValue(undefined);
      await storage.clear();
      expect(mockStorageLocal.clear).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('getQueue returns empty array on error', async () => {
      mockStorageSession.get.mockRejectedValue(new Error('Storage error'));
      const result = await storage.getQueue();
      expect(result).toEqual([]);
    });

    it('saveQueue handles errors gracefully', async () => {
      mockStorageSession.set.mockRejectedValue(new Error('Storage error'));
      const queue: QueueItem[] = [{ id: '1', text: 'Task', status: 'pending' }];
      await expect(storage.saveQueue(queue)).resolves.not.toThrow();
    });

    it('clearQueue handles errors gracefully', async () => {
      mockStorageSession.remove.mockRejectedValue(new Error('Storage error'));
      await expect(storage.clearQueue()).resolves.not.toThrow();
    });

    it('getSettings returns defaults on error', async () => {
      mockStorageLocal.get.mockRejectedValue(new Error('Storage error'));
      const result = await storage.getSettings();
      expect(result).toEqual({
        autoDownload: true,
        serialNumber: false,
        characterConsistency: false,
        downloadFolder: '',
        customFolderName: null,
        delayMin: 5,
        delayMax: 15,
      });
    });

    it('updateSettings handles errors gracefully', async () => {
      mockStorageLocal.get.mockRejectedValue(new Error('Storage error'));
      await expect(storage.updateSettings({ delayMin: 10 })).resolves.not.toThrow();
    });

    it('getState returns defaults on error', async () => {
      mockStorageLocal.get.mockRejectedValue(new Error('Storage error'));
      const result = await storage.getState();
      expect(result).toEqual({
        isRunning: false,
        currentIndex: 0,
      });
    });

    it('updateState handles errors gracefully', async () => {
      mockStorageLocal.get.mockRejectedValue(new Error('Storage error'));
      await expect(storage.updateState({ isRunning: true })).resolves.not.toThrow();
    });

    it('updateQueue handles errors gracefully', async () => {
      mockStorageSession.get.mockRejectedValue(new Error('Storage error'));
      mockStorageSession.set.mockRejectedValue(new Error('Storage error'));
      await expect(
        storage.updateQueue((q) => [...q, { id: '1', text: 'Task', status: 'pending' }])
      ).resolves.not.toThrow();
    });

    it('initializeIfEmpty handles errors gracefully', async () => {
      mockStorageLocal.get.mockRejectedValue(new Error('Storage error'));
      await expect(storage.initializeIfEmpty()).resolves.not.toThrow();
    });

    it('clear handles errors gracefully', async () => {
      mockStorageLocal.clear.mockRejectedValue(new Error('Storage error'));
      await expect(storage.clear()).resolves.not.toThrow();
    });
  });
});
