import { useState, useEffect } from 'react';
import { QueueItem } from '../../types';

interface ProgressStats {
  total: number;
  done: number;
  skipped: number;
  pending: number;
  isRunning: boolean;
  currentIndex: number;
}

interface UseProgressReturn {
  stats: ProgressStats;
  getStats: () => ProgressStats;
  start: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  continueFrom: (index: number) => Promise<void>;
  error: string | null;
}

export function useProgress(): UseProgressReturn {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch initial state from service worker
    const fetchState = async () => {
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'getQueue',
        });
        if (response && response.queue) {
          setQueue(response.queue);
        }

        const stateResponse = await chrome.runtime.sendMessage({
          action: 'getState',
        });
        if (stateResponse) {
          setIsRunning(stateResponse.isRunning || false);
          setCurrentIndex(stateResponse.currentIndex || 0);
        }
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        console.error('Failed to fetch state:', err);
      }
    };

    fetchState();

    const handleStateUpdate = (message: {
      queue?: QueueItem[];
      isRunning?: boolean;
      currentIndex?: number;
    }) => {
      if (!message) return;
      if (Array.isArray(message.queue)) setQueue(message.queue);
      if (message.isRunning !== undefined) setIsRunning(message.isRunning);
      if (message.currentIndex !== undefined) setCurrentIndex(message.currentIndex);
      setError(null);
    };

    chrome.runtime.onMessage.addListener(handleStateUpdate);

    return () => {
      chrome.runtime.onMessage.removeListener(handleStateUpdate);
    };
  }, []);

  const getStats = (): ProgressStats => {
    const total = queue.length;
    const done = queue.filter((item) => item.status === 'done').length;
    const skipped = queue.filter((item) => item.status === 'skipped').length;
    const pending = queue.filter((item) => item.status === 'pending').length;

    return {
      total,
      done,
      skipped,
      pending,
      isRunning,
      currentIndex,
    };
  };

  const start = async (): Promise<void> => {
    try {
      await chrome.runtime.sendMessage({ action: 'start' });
      setIsRunning(true);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('[useProgress] Start error:', err);
    }
  };

  const pause = async (): Promise<void> => {
    try {
      await chrome.runtime.sendMessage({ action: 'pause' });
      setIsRunning(false);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('[useProgress] Pause error:', err);
    }
  };

  const stop = async (): Promise<void> => {
    try {
      await chrome.runtime.sendMessage({ action: 'stop' });
      setIsRunning(false);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('[useProgress] Stop error:', err);
    }
  };

  const continueFrom = async (index: number): Promise<void> => {
    try {
      await chrome.runtime.sendMessage({
        action: 'continueFrom',
        payload: { index },
      });
      setCurrentIndex(index);
      setIsRunning(true);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('[useProgress] ContinueFrom error:', err);
    }
  };

  const stats = getStats();

  return {
    stats,
    getStats,
    start,
    pause,
    stop,
    continueFrom,
    error,
  };
}
