import React, { useState } from 'react'
import { QueueItem, AppSettings } from '../../types'
import type { ParsedPrompt } from '../../lib/promptFile'
import type { CharacterEntry } from '../../lib/characters'
import { QueuePanel } from './QueuePanel'
import { SettingsPanel } from './SettingsPanel'
import { CharactersPanel } from './CharactersPanel'
import { ControlPanel } from './ControlPanel'
import { FileImport } from './FileImport'

interface DirectoryControls {
  supported: boolean
  folderName: string | null
  needsPermission: boolean
  error: string | null
  notification: { text: string; kind: 'success' | 'error' } | null
  choose: () => Promise<void>
  reconnect: () => Promise<void>
  clear: () => Promise<void>
}

interface SidebarProps {
  queue: QueueItem[]
  settings: AppSettings
  directory: DirectoryControls
  characters: CharacterEntry[]
  isRunning: boolean
  done: number
  pending: number
  skipped: number
  currentIndex: number
  onAddPrompt: (text: string) => void
  onRemovePrompt: (id: string) => void
  onReorderQueue: (items: QueueItem[]) => void
  onUpdateSettings: (partial: Partial<AppSettings>) => void
  onAddCharacter: (name: string, trigger: string) => void
  onRemoveCharacter: (name: string) => void
  onStart: () => void
  onStop: () => void
  /** 1-based prompt number to resume from. */
  onContinue: (promptNumber: number) => void
  onImportPrompts: (prompts: ParsedPrompt[]) => void
}

export function Sidebar({
  queue, settings, directory, characters, isRunning, done, pending, skipped, currentIndex,
  onAddPrompt, onRemovePrompt, onReorderQueue, onUpdateSettings,
  onAddCharacter, onRemoveCharacter,
  onStart, onStop, onContinue, onImportPrompts
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<'queue' | 'characters' | 'settings'>('queue')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#1a1a1a', color: '#ccc', position: 'relative' }}>
      {directory.notification && (
        <div
          style={{
            position: 'absolute',
            bottom: '76px',
            left: '12px',
            right: '12px',
            zIndex: 10,
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 'bold',
            color: '#fff',
            backgroundColor: directory.notification.kind === 'success' ? '#15803d' : '#b91c1c',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}
        >
          {directory.notification.kind === 'success' ? '✓ ' : '⚠ '}
          {directory.notification.text}
        </div>
      )}

      <div style={{ padding: '12px', borderBottom: '1px solid #2a2a2a' }}>
        <h1 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>Roose Flow</h1>
      </div>

      <div style={{ display: 'flex', gap: '8px', padding: '8px 12px', borderBottom: '1px solid #2a2a2a' }}>
        <button onClick={() => setActiveTab('queue')} style={{ flex: 1, padding: '6px', backgroundColor: activeTab === 'queue' ? '#1e3a8a' : '#2a2a2a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Queue</button>
        <button onClick={() => setActiveTab('characters')} style={{ flex: 1, padding: '6px', backgroundColor: activeTab === 'characters' ? '#1e3a8a' : '#2a2a2a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Characters</button>
        <button onClick={() => setActiveTab('settings')} style={{ flex: 1, padding: '6px', backgroundColor: activeTab === 'settings' ? '#1e3a8a' : '#2a2a2a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Settings</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        {activeTab === 'queue' && (
          <QueuePanel queue={queue} onAdd={onAddPrompt} onRemove={onRemovePrompt} onReorder={onReorderQueue} />
        )}
        {activeTab === 'characters' && (
          <CharactersPanel characters={characters} onAdd={onAddCharacter} onRemove={onRemoveCharacter} />
        )}
        {activeTab === 'settings' && (
          <SettingsPanel settings={settings} onUpdate={onUpdateSettings} directory={directory} />
        )}
      </div>

      <ControlPanel isRunning={isRunning} done={done} pending={pending} skipped={skipped} currentIndex={currentIndex} queueLength={queue.length} numbers={queue.map((item, i) => item.number ?? i + 1)} onStart={onStart} onContinue={onContinue} onStop={onStop} />

      <FileImport onImport={onImportPrompts} />
    </div>
  )
}
