import type { QueueItem } from '../types/index';

export class AutomationController {
  private running = false;

  /**
   * Finds the first pending item at or after `fromIndex`, which lets the user
   * resume at a chosen prompt without disturbing the ones before it.
   */
  getNextPending(queue: QueueItem[], fromIndex = 0): QueueItem | undefined {
    return queue.find((item, i) => i >= fromIndex && item.status === 'pending');
  }

  /**
   * Generates a random delay in milliseconds between min and max (inclusive)
   */
  getRandomDelay(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Removes invalid filename characters and limits length to 100 chars
   */
  sanitizeFilename(text: string): string {
    // Remove invalid filename characters: < > : " / \ | ? *
    let sanitized = text.replace(/[<>:"/\\|?*]/g, '');
    // Truncate to 100 characters
    return sanitized.substring(0, 100);
  }

  /**
   * Builds a filename with optional serial number prefix
   * Format: "001_prompt.png" or "prompt.png"
   */
  buildFilename(text: string, index: number, useSerial: boolean): string {
    const sanitized = this.sanitizeFilename(text);

    if (useSerial) {
      // Zero-pad index to 3 digits, then add 1 (so index 0 becomes 001)
      const paddedIndex = String(index + 1).padStart(3, '0');
      return `${paddedIndex}_${sanitized}.png`;
    }

    return `${sanitized}.png`;
  }

  /**
   * Async delay function
   */
  async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Set the running state
   */
  setRunning(state: boolean): void {
    this.running = state;
  }

  /**
   * Get the current running state
   */
  getRunning(): boolean {
    return this.running;
  }
}
