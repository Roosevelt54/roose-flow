import { useState, useEffect } from 'react';
import { QueueItem } from '../../types';

interface UseQueueReturn {
  queue: QueueItem[];
  addPrompt: (text: string, number?: number) => Promise<QueueItem[]>;
  removePrompt: (id: string) => Promise<QueueItem[]>;
  reorderQueue: (items: QueueItem[]) => Promise<QueueItem[]>;
  isLoading: boolean;
  error: string | null;
}

export function useQueue(): UseQueueReturn {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch queue from service worker on mount
    const fetchQueue = async () => {
      try {
        if (typeof chrome === 'undefined' || !chrome.runtime) {
          throw new Error('chrome.runtime not available');
        }

        setIsLoading(true);
        const response = await new Promise<{queue?: QueueItem[]}>((resolve, reject) => {
          chrome.runtime.sendMessage({ action: 'getQueue', payload: {} }, (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response || {});
            }
          });
        });

        if (response?.queue) {
          setQueue(response.queue);
          setError(null);
        } else {
          setQueue([]);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error('[useQueue] ERROR:', msg);
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    };

    fetchQueue();

    const handleQueueUpdate = (message: { queue?: QueueItem[] }) => {
      if (!Array.isArray(message?.queue)) return;
      setQueue(message.queue);
      setError(null);
    };

    chrome.runtime.onMessage.addListener(handleQueueUpdate);

    return () => {
      chrome.runtime.onMessage.removeListener(handleQueueUpdate);
    };
  }, []);

  const addPrompt = async (text: string, number?: number): Promise<QueueItem[]> => {
    try {
      if (!chrome?.runtime) {
        throw new Error('chrome.runtime not available');
      }
      const response = await new Promise<{queue?: QueueItem[]}>((resolve, reject) => {
        chrome.runtime.sendMessage(
          { action: 'addPrompt', payload: { text, number } },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response || {});
            }
          }
        );
      });
      if (response?.queue) {
        setQueue(response.queue);
        setError(null);
        return response.queue;
      }
      return queue;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Failed to add prompt:', err);
      return queue;
    }
  };

  const removePrompt = async (id: string): Promise<QueueItem[]> => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'removePrompt',
        payload: { id },
      });
      if (response && response.queue) {
        setQueue(response.queue);
        setError(null);
        return response.queue;
      }
      return queue;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('[useQueue] Failed to remove prompt:', err);
      return queue;
    }
  };

  const reorderQueue = async (items: QueueItem[]): Promise<QueueItem[]> => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'reorderQueue',
        payload: { queue: items },
      });
      if (response && response.queue) {
        setQueue(response.queue);
        setError(null);
        return response.queue;
      }
      return queue;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('[useQueue] Failed to reorder queue:', err);
      return queue;
    }
  };

  return {
    queue,
    addPrompt,
    removePrompt,
    reorderQueue,
    isLoading,
    error,
  };
}
