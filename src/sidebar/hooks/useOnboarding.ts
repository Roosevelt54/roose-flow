import { useState, useEffect, useCallback } from 'react';

const KEY = 'onboardingDone';

interface UseOnboardingReturn {
  open: boolean;
  step: number;
  setStep: (step: number) => void;
  /** Open the guide, at the given step. */
  show: (at?: number) => void;
  /** Close it and remember it was seen, so it does not open by itself again. */
  finish: () => void;
}

/** First-run guide: opens by itself once, and can be reopened any time from Help. */
export function useOnboarding(): UseOnboardingReturn {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let alive = true;
    try {
      chrome.storage.local
        .get(KEY)
        .then((stored) => {
          if (alive && !stored?.[KEY]) setOpen(true);
        })
        .catch(() => {});
    } catch {
      // No storage (a preview page): stay closed rather than nag.
    }
    return () => {
      alive = false;
    };
  }, []);

  const show = useCallback((at = 0) => {
    setStep(at);
    setOpen(true);
  }, []);

  const finish = useCallback(() => {
    setOpen(false);
    try {
      chrome.storage.local.set({ [KEY]: true }).catch(() => {});
    } catch {
      // Nothing to remember it in; it will simply show again next time.
    }
  }, []);

  return { open, step, setStep, show, finish };
}
