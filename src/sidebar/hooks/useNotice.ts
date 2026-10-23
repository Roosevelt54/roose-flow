import { useState, useEffect, useCallback } from 'react';

export interface Notice {
  text: string;
  kind: 'error' | 'warning';
}

/** A warning fades on its own; an error stays until the user closes it or acts. */
const WARNING_MS = 20000;

interface UseNoticeReturn {
  notice: Notice | null;
  dismiss: () => void;
}

/** Messages the service worker raises when a run cannot start or a prompt fails. */
export function useNotice(): UseNoticeReturn {
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    const handle = (message: { type?: string; notice?: Notice }) => {
      if (message?.type === 'NOTICE' && message.notice?.text) {
        setNotice(message.notice);
      }
    };
    chrome.runtime.onMessage.addListener(handle);
    return () => chrome.runtime.onMessage.removeListener(handle);
  }, []);

  useEffect(() => {
    if (!notice || notice.kind !== 'warning') return;
    const timer = window.setTimeout(() => setNotice(null), WARNING_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const dismiss = useCallback(() => setNotice(null), []);

  return { notice, dismiss };
}
