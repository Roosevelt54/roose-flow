import { useState, useEffect } from 'react';
import { AppSettings } from '../../types';

interface UseSettingsReturn {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => Promise<AppSettings>;
  isLoading: boolean;
  error: string | null;
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<AppSettings>({
    autoDownload: false,
    serialNumber: false,
    characterConsistency: false,
    downloadFolder: '',
    delayMin: 0,
    delayMax: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch settings from service worker on mount
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        const response = await chrome.runtime.sendMessage({
          action: 'getSettings',
        });
        if (response && response.settings) {
          setSettings(response.settings);
          setError(null);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        console.error('Failed to fetch settings:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();

    const handleSettingsUpdate = (message: { settings?: AppSettings }) => {
      if (message?.settings) {
        setSettings(message.settings);
        setError(null);
      }
    };

    chrome.runtime.onMessage.addListener(handleSettingsUpdate);

    return () => {
      chrome.runtime.onMessage.removeListener(handleSettingsUpdate);
    };
  }, []);

  const updateSettings = async (
    partial: Partial<AppSettings>
  ): Promise<AppSettings> => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'updateSettings',
        payload: { settings: partial },
      });
      if (response && response.success) {
        setSettings(prev => ({ ...prev, ...partial }));
        setError(null);
        return settings;
      }
      return settings;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('[useSettings] Error:', err);
      return settings;
    }
  };

  return {
    settings,
    updateSettings,
    isLoading,
    error,
  };
}
