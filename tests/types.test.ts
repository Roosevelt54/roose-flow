import { describe, it, expect } from 'vitest';
import {
  QueueItem,
  QueueItemStatus,
  AppSettings,
  AutomationState,
  StorageData,
  ContentScriptMessage,
  ServiceWorkerMessage,
  GenerateResult,
  QueueUpdateMessage,
} from '../src/types/index';

describe('QueueItemStatus', () => {
  it('should have valid status values', () => {
    const statuses: QueueItemStatus[] = ['pending', 'in-progress', 'done', 'skipped'];
    expect(statuses.length).toBe(4);
  });
});

describe('QueueItem', () => {
  it('should create a queue item with required fields', () => {
    const item: QueueItem = {
      id: '1',
      text: 'Sample task',
      status: 'pending',
    };
    expect(item.id).toBe('1');
    expect(item.text).toBe('Sample task');
    expect(item.status).toBe('pending');
  });

  it('should allow imageUrl as optional field', () => {
    const item: QueueItem = {
      id: '2',
      text: 'Task with image',
      status: 'done',
      imageUrl: 'https://example.com/image.png',
    };
    expect(item.imageUrl).toBe('https://example.com/image.png');
  });

  it('should support all status types', () => {
    const statuses: QueueItemStatus[] = ['pending', 'in-progress', 'done', 'skipped'];
    statuses.forEach(status => {
      const item: QueueItem = {
        id: 'test',
        text: 'Test',
        status,
      };
      expect(item.status).toBe(status);
    });
  });
});

describe('AppSettings', () => {
  it('should have all required settings fields', () => {
    const settings: AppSettings = {
      autoDownload: true,
      serialNumber: false,
      characterConsistency: true,
      downloadFolder: '/downloads',
      delayMin: 1000,
      delayMax: 5000,
    };
    expect(settings.autoDownload).toBe(true);
    expect(settings.serialNumber).toBe(false);
    expect(settings.characterConsistency).toBe(true);
    expect(settings.downloadFolder).toBe('/downloads');
    expect(settings.delayMin).toBe(1000);
    expect(settings.delayMax).toBe(5000);
  });

  it('should ensure delayMin is less than or equal to delayMax', () => {
    const settings: AppSettings = {
      autoDownload: true,
      serialNumber: true,
      characterConsistency: false,
      downloadFolder: '/home/downloads',
      delayMin: 500,
      delayMax: 2000,
    };
    expect(settings.delayMin).toBeLessThanOrEqual(settings.delayMax);
  });

  it('should support boolean toggle fields', () => {
    const settings: AppSettings = {
      autoDownload: false,
      serialNumber: true,
      characterConsistency: false,
      downloadFolder: '/tmp',
      delayMin: 100,
      delayMax: 100,
    };
    expect(typeof settings.autoDownload).toBe('boolean');
    expect(typeof settings.serialNumber).toBe('boolean');
    expect(typeof settings.characterConsistency).toBe('boolean');
  });
});

describe('AutomationState', () => {
  it('should track running status', () => {
    const state: AutomationState = {
      isRunning: true,
      currentIndex: 0,
    };
    expect(state.isRunning).toBe(true);
  });

  it('should track current queue index', () => {
    const state: AutomationState = {
      isRunning: false,
      currentIndex: 5,
    };
    expect(state.currentIndex).toBe(5);
  });

  it('should support state transitions', () => {
    const state: AutomationState = {
      isRunning: false,
      currentIndex: 0,
    };
    expect(state.isRunning).toBe(false);
    const updatedState: AutomationState = {
      ...state,
      isRunning: true,
      currentIndex: 1,
    };
    expect(updatedState.isRunning).toBe(true);
    expect(updatedState.currentIndex).toBe(1);
  });
});

describe('Message types', () => {
  it('should support ContentScriptMessage', () => {
    const msg: ContentScriptMessage = {
      type: 'QUEUE_UPDATE',
      payload: { item: { id: '1', text: 'test', status: 'pending' } },
    };
    expect(msg.type).toBe('QUEUE_UPDATE');
  });

  it('should support ServiceWorkerMessage', () => {
    const msg: ServiceWorkerMessage = {
      type: 'START_AUTOMATION',
      payload: { settings: { autoDownload: true, serialNumber: false, characterConsistency: true, downloadFolder: '/tmp', delayMin: 500, delayMax: 2000 } },
    };
    expect(msg.type).toBe('START_AUTOMATION');
  });

  it('should support GenerateResult', () => {
    const result: GenerateResult = {
      success: true,
      data: 'generated content',
    };
    expect(result.success).toBe(true);
    expect(result.data).toBe('generated content');
  });

  it('should support QueueUpdateMessage', () => {
    const update: QueueUpdateMessage = {
      type: 'QUEUE_UPDATE',
      item: { id: '1', text: 'test', status: 'in-progress' },
    };
    expect(update.type).toBe('QUEUE_UPDATE');
    expect(update.item.status).toBe('in-progress');
  });
});

describe('StorageData', () => {
  it('should combine queue and settings', () => {
    const data: StorageData = {
      queue: [
        { id: '1', text: 'task1', status: 'done' },
        { id: '2', text: 'task2', status: 'pending' },
      ],
      settings: {
        autoDownload: true,
        serialNumber: false,
        characterConsistency: true,
        downloadFolder: '/downloads',
        delayMin: 1000,
        delayMax: 5000,
      },
    };
    expect(data.queue.length).toBe(2);
    expect(data.settings.autoDownload).toBe(true);
  });
});
