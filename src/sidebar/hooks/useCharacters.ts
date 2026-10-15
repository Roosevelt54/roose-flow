import { useState, useEffect } from 'react';
import type { CharacterEntry } from '../../lib/characters';

interface UseCharactersReturn {
  characters: CharacterEntry[];
  addCharacter: (name: string, trigger: string) => Promise<CharacterEntry[]>;
  removeCharacter: (name: string) => Promise<CharacterEntry[]>;
  isLoading: boolean;
  error: string | null;
}

export function useCharacters(): UseCharactersReturn {
  const [characters, setCharacters] = useState<CharacterEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCharacters = async () => {
      try {
        setIsLoading(true);
        const response = await new Promise<{ characters?: CharacterEntry[] }>((resolve, reject) => {
          chrome.runtime.sendMessage({ action: 'getCharacters', payload: {} }, (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response || {});
            }
          });
        });
        setCharacters(response?.characters || []);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        console.error('[useCharacters] Failed to fetch:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCharacters();

    const handleUpdate = (message: { characters?: CharacterEntry[] }) => {
      if (!Array.isArray(message?.characters)) return;
      setCharacters(message.characters);
      setError(null);
    };

    chrome.runtime.onMessage.addListener(handleUpdate);
    return () => {
      chrome.runtime.onMessage.removeListener(handleUpdate);
    };
  }, []);

  const addCharacter = async (name: string, trigger: string): Promise<CharacterEntry[]> => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'addCharacter',
        payload: { name, trigger },
      });
      if (response?.characters) {
        setCharacters(response.characters);
        setError(null);
        return response.characters;
      }
      return characters;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('[useCharacters] Failed to add:', err);
      return characters;
    }
  };

  const removeCharacter = async (name: string): Promise<CharacterEntry[]> => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'removeCharacter',
        payload: { name },
      });
      if (response?.characters) {
        setCharacters(response.characters);
        setError(null);
        return response.characters;
      }
      return characters;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('[useCharacters] Failed to remove:', err);
      return characters;
    }
  };

  return { characters, addCharacter, removeCharacter, isLoading, error };
}
