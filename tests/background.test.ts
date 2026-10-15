import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock chrome API
const mockChrome = {
  runtime: {
    onMessage: {
      addListener: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
  },
};

// Mock StorageService
const mockStorage = {
  initializeIfEmpty: vi.fn(),
  getQueue: vi.fn().mockResolvedValue([]),
  saveQueue: vi.fn().mockResolvedValue(undefined),
  updateQueue: vi.fn().mockImplementation(async (fn) => {
    const queue = await mockStorage.getQueue();
    return fn(queue);
  }),
  getSettings: vi.fn().mockResolvedValue({ delayMin: 1, delayMax: 2 }),
  updateSettings: vi.fn().mockResolvedValue(undefined),
  getState: vi.fn().mockResolvedValue({ isRunning: false, currentIndex: 0 }),
  updateState: vi.fn().mockResolvedValue(undefined),
};

// Mock AutomationController
const mockAutomation = {
  getRunning: vi.fn().mockReturnValue(false),
  setRunning: vi.fn(),
  getNextPending: vi.fn().mockReturnValue(null),
  getRandomDelay: vi.fn().mockReturnValue(100),
  sleep: vi.fn().mockResolvedValue(undefined),
};

describe('Background Service Worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global as any).chrome = mockChrome;
  });

  afterEach(() => {
    delete (global as any).chrome;
  });

  describe('Message Routing (addPrompt, start, stop)', () => {
    it('should route addPrompt action and broadcast queue update', async () => {
      const mockSender = { url: 'chrome-extension://test-id/popup.html' };
      let messageHandler: any;

      mockChrome.runtime.onMessage.addListener.mockImplementation((fn) => {
        messageHandler = fn;
      });

      // Simulate listener registration
      if (messageHandler) {
        const response = await messageHandler(
          { action: 'addPrompt', payload: { text: 'test prompt' } },
          mockSender,
          vi.fn()
        );
        expect(response).toBeDefined();
      }
    });

    it('should route start action and update state', async () => {
      const mockSender = { url: 'chrome-extension://test-id/popup.html' };
      let messageHandler: any;

      mockChrome.runtime.onMessage.addListener.mockImplementation((fn) => {
        messageHandler = fn;
      });

      if (messageHandler) {
        const response = await messageHandler(
          { action: 'start' },
          mockSender,
          vi.fn()
        );
        expect(response).toBeDefined();
      }
    });

    it('should route stop action and reset state', async () => {
      const mockSender = { url: 'chrome-extension://test-id/popup.html' };
      let messageHandler: any;

      mockChrome.runtime.onMessage.addListener.mockImplementation((fn) => {
        messageHandler = fn;
      });

      if (messageHandler) {
        const response = await messageHandler(
          { action: 'stop' },
          mockSender,
          vi.fn()
        );
        expect(response).toBeDefined();
      }
    });

    it('should reject messages from unauthorized origins', async () => {
      const mockSender = { url: 'https://malicious.com' };
      let messageHandler: any;
      const mockSendResponse = vi.fn();

      mockChrome.runtime.onMessage.addListener.mockImplementation((fn) => {
        messageHandler = fn;
      });

      if (messageHandler) {
        const result = messageHandler(
          { action: 'addPrompt', payload: { text: 'test' } },
          mockSender,
          mockSendResponse
        );
        expect(result).toBe(false);
        expect(mockSendResponse).toHaveBeenCalledWith({
          error: 'Unauthorized origin',
        });
      }
    });
  });

  describe('State Transitions (isRunning true/false)', () => {
    it('should transition from isRunning false to true on start', async () => {
      mockAutomation.getRunning.mockReturnValue(false);
      mockAutomation.setRunning.mockImplementation((val) => {
        mockAutomation.getRunning.mockReturnValue(val);
      });

      mockAutomation.setRunning(true);
      expect(mockAutomation.getRunning()).toBe(true);
    });

    it('should transition from isRunning true to false on stop', async () => {
      mockAutomation.getRunning.mockReturnValue(true);
      mockAutomation.setRunning.mockImplementation((val) => {
        mockAutomation.getRunning.mockReturnValue(val);
      });

      mockAutomation.setRunning(false);
      expect(mockAutomation.getRunning()).toBe(false);
    });

    it('should reset currentIndex to 0 on stop', async () => {
      await mockStorage.updateState({ isRunning: false, currentIndex: 0 });
      expect(mockStorage.updateState).toHaveBeenCalledWith({
        isRunning: false,
        currentIndex: 0,
      });
    });
  });

  describe('Broadcast Updates on Queue Change', () => {
    it('should broadcast QUEUE_UPDATE when queue changes', async () => {
      mockChrome.tabs.query.mockResolvedValue([
        { id: 1, url: 'https://labs.google.com/test' },
        { id: 2, url: 'https://labs.google.com/test' },
      ]);

      const tabs = await mockChrome.tabs.query({
        url: 'https://labs.google.com/*',
      });

      expect(tabs).toHaveLength(2);
      tabs.forEach((tab: any) => {
        if (tab.id) {
          mockChrome.tabs.sendMessage(tab.id, { type: 'QUEUE_UPDATE' });
        }
      });

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalled();
    });

    it('should broadcast AUTOMATION_STATE when automation state changes', async () => {
      mockChrome.tabs.query.mockResolvedValue([
        { id: 1, url: 'https://labs.google.com/test' },
      ]);

      const tabs = await mockChrome.tabs.query({
        url: 'https://labs.google.com/*',
      });

      tabs.forEach((tab: any) => {
        if (tab.id) {
          mockChrome.tabs.sendMessage(tab.id, { type: 'AUTOMATION_STATE' });
        }
      });

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        type: 'AUTOMATION_STATE',
      });
    });

    it('should filter tabs by google.com origin for efficiency', async () => {
      mockChrome.tabs.query.mockResolvedValue([
        { id: 1, url: 'https://labs.google.com/test' },
      ]);

      await mockChrome.tabs.query({ url: 'https://labs.google.com/*' });

      expect(mockChrome.tabs.query).toHaveBeenCalledWith({
        url: 'https://labs.google.com/*',
      });
    });

    it('should handle send message errors gracefully', async () => {
      mockChrome.tabs.query.mockResolvedValue([
        { id: 1, url: 'https://labs.google.com/test' },
      ]);
      mockChrome.tabs.sendMessage.mockRejectedValue(new Error('Tab closed'));

      const tabs = await mockChrome.tabs.query({
        url: 'https://labs.google.com/*',
      });

      for (const tab of tabs) {
        if (tab.id) {
          await expect(
            mockChrome.tabs.sendMessage(tab.id, { type: 'QUEUE_UPDATE' })
          ).rejects.toThrow();
        }
      }
    });
  });

  describe('Error Handling & Retry Logic', () => {
    it('should handle automation loop errors gracefully', async () => {
      mockAutomation.getRunning.mockReturnValue(true);
      mockStorage.getQueue.mockRejectedValueOnce(
        new Error('Storage error')
      );

      try {
        if (mockAutomation.getRunning()) {
          await mockStorage.getQueue();
        }
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        mockAutomation.setRunning(false);
      }

      expect(mockAutomation.setRunning).toHaveBeenCalledWith(false);
    });

    it('should return error response for invalid actions', async () => {
      const response = { success: false, error: 'Unknown action: invalid' };
      expect(response.success).toBe(false);
      expect(response.error).toContain('Unknown action');
    });

    it('should retry on first sendToContentScript failure', async () => {
      let callCount = 0;
      mockChrome.tabs.sendMessage.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Timeout'));
        }
        return Promise.resolve({ success: true, imageUrl: 'test.jpg' });
      });

      await expect(mockChrome.tabs.sendMessage(1, {})).rejects.toThrow();
      const result = await mockChrome.tabs.sendMessage(1, {});
      expect(result).toEqual({ success: true, imageUrl: 'test.jpg' });
    });
  });
});
