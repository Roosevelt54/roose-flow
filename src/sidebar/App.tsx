import React from 'react'
import { Sidebar } from './components/Sidebar'
import { useQueue } from './hooks/useQueue'
import { useSettings } from './hooks/useSettings'
import { useProgress } from './hooks/useProgress'
import { useDirectory } from './hooks/useDirectory'
import { useCharacters } from './hooks/useCharacters'

export function App() {
  const { queue, addPrompt, removePrompt, reorderQueue } = useQueue()
  const { settings, updateSettings } = useSettings()
  const { stats, start, pause, stop, continueFrom } = useProgress()
  const directory = useDirectory()
  const { characters, addCharacter, removeCharacter } = useCharacters()

  return (
    <Sidebar
      queue={queue}
      settings={settings}
      directory={directory}
      characters={characters}
      onAddCharacter={addCharacter}
      onRemoveCharacter={removeCharacter}
      isRunning={stats.isRunning}
      done={stats.done}
      pending={stats.pending}
      skipped={stats.skipped}
      currentIndex={stats.currentIndex}
      onAddPrompt={addPrompt}
      onRemovePrompt={removePrompt}
      onReorderQueue={reorderQueue}
      onUpdateSettings={updateSettings}
      onStart={start}
      onStop={stop}
      onContinue={(promptNumber: number) => continueFrom(promptNumber - 1)}
      onImportPrompts={async (prompts) => {
        for (const prompt of prompts) {
          await addPrompt(prompt.text, prompt.number)
          await new Promise(r => setTimeout(r, 10)) // Small delay between adds
        }
      }}
    />
  )
}
