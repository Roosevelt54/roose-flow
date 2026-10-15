import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AutomationController } from '../src/lib/automation';
import type { QueueItem } from '../src/types/index';

describe('AutomationController', () => {
  let controller: AutomationController;

  beforeEach(() => {
    controller = new AutomationController();
    vi.clearAllMocks();
  });

  describe('getNextPending', () => {
    it('returns first pending item from queue', () => {
      const queue: QueueItem[] = [
        { id: '1', text: 'Task 1', status: 'done' },
        { id: '2', text: 'Task 2', status: 'pending' },
        { id: '3', text: 'Task 3', status: 'pending' },
      ];
      const result = controller.getNextPending(queue);
      expect(result).toEqual({ id: '2', text: 'Task 2', status: 'pending' });
    });

    it('returns undefined when no pending items exist', () => {
      const queue: QueueItem[] = [
        { id: '1', text: 'Task 1', status: 'done' },
        { id: '2', text: 'Task 2', status: 'skipped' },
      ];
      const result = controller.getNextPending(queue);
      expect(result).toBeUndefined();
    });

    it('returns undefined for empty queue', () => {
      const result = controller.getNextPending([]);
      expect(result).toBeUndefined();
    });

    it('ignores in-progress and done items', () => {
      const queue: QueueItem[] = [
        { id: '1', text: 'Task 1', status: 'in-progress' },
        { id: '2', text: 'Task 2', status: 'done' },
        { id: '3', text: 'Task 3', status: 'pending' },
      ];
      const result = controller.getNextPending(queue);
      expect(result?.id).toBe('3');
    });

    it('skips pending items before fromIndex', () => {
      const queue: QueueItem[] = [
        { id: '1', text: 'Task 1', status: 'pending' },
        { id: '2', text: 'Task 2', status: 'pending' },
        { id: '3', text: 'Task 3', status: 'pending' },
      ];
      expect(controller.getNextPending(queue, 1)?.id).toBe('2');
      expect(controller.getNextPending(queue, 2)?.id).toBe('3');
    });

    it('returns undefined when fromIndex is past the last pending item', () => {
      const queue: QueueItem[] = [
        { id: '1', text: 'Task 1', status: 'pending' },
        { id: '2', text: 'Task 2', status: 'done' },
      ];
      expect(controller.getNextPending(queue, 1)).toBeUndefined();
    });

    it('still honours status when starting at fromIndex', () => {
      const queue: QueueItem[] = [
        { id: '1', text: 'Task 1', status: 'pending' },
        { id: '2', text: 'Task 2', status: 'done' },
        { id: '3', text: 'Task 3', status: 'pending' },
      ];
      expect(controller.getNextPending(queue, 1)?.id).toBe('3');
    });
  });

  describe('getRandomDelay', () => {
    it('returns a number within the specified range', () => {
      const min = 100;
      const max = 200;
      for (let i = 0; i < 10; i++) {
        const delay = controller.getRandomDelay(min, max);
        expect(delay).toBeGreaterThanOrEqual(min);
        expect(delay).toBeLessThanOrEqual(max);
      }
    });

    it('returns delay in milliseconds', () => {
      const delay = controller.getRandomDelay(1000, 2000);
      expect(typeof delay).toBe('number');
      expect(delay % 1).toBeLessThanOrEqual(1); // Allow for float precision
    });

    it('handles single value range', () => {
      const delay = controller.getRandomDelay(500, 500);
      expect(delay).toBe(500);
    });

    it('generates different values on successive calls', () => {
      const delays = new Set();
      for (let i = 0; i < 20; i++) {
        delays.add(controller.getRandomDelay(1, 100));
      }
      // With 20 attempts in a range of 100, we should get variance
      expect(delays.size).toBeGreaterThan(1);
    });
  });

  describe('sanitizeFilename', () => {
    it('removes invalid filename characters', () => {
      const input = 'Test<>:"/\\|?*Task';
      const result = controller.sanitizeFilename(input);
      expect(result).not.toMatch(/[<>:"/\\|?*]/);
    });

    it('truncates to 100 characters', () => {
      const input = 'a'.repeat(150);
      const result = controller.sanitizeFilename(input);
      expect(result.length).toBeLessThanOrEqual(100);
    });

    it('preserves valid characters', () => {
      const input = 'Test-Task_2024.txt';
      const result = controller.sanitizeFilename(input);
      expect(result).toBe(input);
    });

    it('handles empty string', () => {
      const result = controller.sanitizeFilename('');
      expect(typeof result).toBe('string');
    });

    it('handles spaces', () => {
      const input = 'My Test Task';
      const result = controller.sanitizeFilename(input);
      expect(result).toBe('My Test Task');
    });

    it('handles unicode characters', () => {
      const input = 'Test_2024_完成';
      const result = controller.sanitizeFilename(input);
      expect(result.length).toBeLessThanOrEqual(100);
    });

    it('exactly 100 character string is kept intact if valid', () => {
      const input = 'a'.repeat(100);
      const result = controller.sanitizeFilename(input);
      expect(result).toBe(input);
    });
  });

  describe('buildFilename', () => {
    it('builds filename with serial number format', () => {
      const result = controller.buildFilename('My Prompt', 5, true);
      expect(result).toMatch(/^006_/);
      expect(result).toContain('My Prompt');
      expect(result).toContain('.png');
    });

    it('builds filename without serial number', () => {
      const result = controller.buildFilename('My Prompt', 0, false);
      expect(result).not.toMatch(/^\d+_/);
      expect(result).toBe('My Prompt.png');
    });

    it('uses 3-digit zero-padded index', () => {
      const result = controller.buildFilename('Test', 1, true);
      expect(result).toMatch(/^002_/);
    });

    it('handles large indices', () => {
      const result = controller.buildFilename('Test', 999, true);
      expect(result).toMatch(/^1000_/);
    });

    it('sanitizes text in filename', () => {
      const result = controller.buildFilename('Test<Invalid>', 0, false);
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).toContain('.png');
    });

    it('always appends .png extension', () => {
      const result1 = controller.buildFilename('Test', 0, true);
      const result2 = controller.buildFilename('Test', 0, false);
      expect(result1).toMatch(/\.png$/);
      expect(result2).toMatch(/\.png$/);
    });

    it('handles zero index with serial number', () => {
      const result = controller.buildFilename('First', 0, true);
      expect(result).toMatch(/^001_/);
    });
  });

  describe('sleep', () => {
    it('resolves after specified milliseconds', async () => {
      const start = Date.now();
      await controller.sleep(100);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow 10ms tolerance
    });

    it('is an async function', async () => {
      const result = controller.sleep(0);
      expect(result instanceof Promise).toBe(true);
      await result;
    });

    it('resolves immediately with 0ms', async () => {
      const start = Date.now();
      await controller.sleep(0);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(50);
    });

    it('handles multiple concurrent sleeps', async () => {
      const start = Date.now();
      await Promise.all([
        controller.sleep(50),
        controller.sleep(50),
        controller.sleep(50),
      ]);
      const elapsed = Date.now() - start;
      // All should complete around 50ms, not 150ms
      expect(elapsed).toBeLessThan(150);
    });
  });

  describe('setRunning/getRunning', () => {
    it('sets running state to true', () => {
      controller.setRunning(true);
      expect(controller.getRunning()).toBe(true);
    });

    it('sets running state to false', () => {
      controller.setRunning(true);
      controller.setRunning(false);
      expect(controller.getRunning()).toBe(false);
    });

    it('defaults to false', () => {
      const newController = new AutomationController();
      expect(newController.getRunning()).toBe(false);
    });

    it('maintains state across multiple calls', () => {
      controller.setRunning(true);
      expect(controller.getRunning()).toBe(true);
      expect(controller.getRunning()).toBe(true);
      controller.setRunning(false);
      expect(controller.getRunning()).toBe(false);
    });

    it('allows toggling state', () => {
      expect(controller.getRunning()).toBe(false);
      controller.setRunning(true);
      expect(controller.getRunning()).toBe(true);
      controller.setRunning(false);
      expect(controller.getRunning()).toBe(false);
      controller.setRunning(true);
      expect(controller.getRunning()).toBe(true);
    });
  });
});
