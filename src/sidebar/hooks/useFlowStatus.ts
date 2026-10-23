import { useState, useEffect } from 'react';

export interface FlowStatus {
  /** Not yet answered by the service worker. */
  checking: boolean;
  /** A Flow tab is open and its page script is listening. */
  connected: boolean;
  /** How many flow.google.com tabs are open. */
  tabs: number;
}

const POLL_MS = 4000;

/** Whether a Flow tab is ready to be driven, refreshed while the panel is open. */
export function useFlowStatus(): FlowStatus {
  const [status, setStatus] = useState<FlowStatus>({ checking: true, connected: false, tabs: 0 });

  useEffect(() => {
    let alive = true;

    const check = async () => {
      try {
        const reply = (await chrome.runtime.sendMessage({ action: 'flowStatus' })) as
          | { connected?: boolean; tabs?: number }
          | undefined;
        if (alive) {
          setStatus({ checking: false, connected: !!reply?.connected, tabs: reply?.tabs ?? 0 });
        }
      } catch {
        if (alive) setStatus({ checking: false, connected: false, tabs: 0 });
      }
    };

    check();
    const timer = window.setInterval(check, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  return status;
}
