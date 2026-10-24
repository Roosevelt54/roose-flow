import React, { useState } from 'react'
import { QueueItem, AppSettings } from '../../types'
import type { ParsedPrompt } from '../../lib/promptFile'
import type { CharacterEntry } from '../../lib/characters'
import type { Notice } from '../hooks/useNotice'
import type { FlowStatus } from '../hooks/useFlowStatus'
import { useOnboarding } from '../hooks/useOnboarding'
import { QueuePanel } from './QueuePanel'
import { SettingsPanel } from './SettingsPanel'
import { CharactersPanel } from './CharactersPanel'
import { HelpPanel } from './HelpPanel'
import { ControlPanel } from './ControlPanel'
import { FileImport } from './FileImport'
import { Onboarding, CHARACTERS_STEP } from './Onboarding'

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
  notice?: Notice | null
  onDismissNotice?: () => void
  flowStatus?: FlowStatus
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

type Tab = 'prompts' | 'characters' | 'settings' | 'help'

export function Sidebar({
  queue, settings, directory, characters, notice, onDismissNotice, flowStatus, isRunning, done, pending, skipped, currentIndex,
  onAddPrompt, onRemovePrompt, onReorderQueue, onUpdateSettings,
  onAddCharacter, onRemoveCharacter,
  onStart, onStop, onContinue, onImportPrompts
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<Tab>('prompts')
  const tour = useOnboarding()

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'prompts', label: queue.length ? `Prompts (${queue.length})` : 'Prompts' },
    { id: 'characters', label: characters.length ? `Characters (${characters.length})` : 'Characters' },
    { id: 'settings', label: 'Settings' },
    { id: 'help', label: 'Help' },
  ]

  return (
    <div className="rf-app">
      <div className="rf-header">
        <div className="rf-brand">
          <span className="rf-logo">R</span>
          Roose Flow
        </div>
        {flowStatus && !flowStatus.checking && (
          <span
            className={`rf-pill ${flowStatus.connected ? 'ok' : 'warn'}`}
            title={flowStatus.connected ? 'A Flow tab is open and ready' : 'Open flow.google.com and reload that tab (F5)'}
          >
            {flowStatus.connected ? 'Connected to Flow' : flowStatus.tabs === 0 ? 'Open Flow in a tab' : 'Reload your Flow tab'}
          </span>
        )}
      </div>

      {notice && (
        <div className={`rf-banner ${notice.kind}`} role="alert">
          <span>{notice.text}</span>
          {onDismissNotice && (
            <button className="rf-icon-btn" onClick={onDismissNotice} aria-label="Dismiss">
              ✕
            </button>
          )}
        </div>
      )}

      <div className="rf-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={activeTab === t.id}
            className={`rf-tab${activeTab === t.id ? ' active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rf-body">
        {activeTab === 'prompts' && (
          <>
            <FileImport onImport={onImportPrompts} />
            <QueuePanel queue={queue} onAdd={onAddPrompt} onRemove={onRemovePrompt} onReorder={onReorderQueue} />
          </>
        )}
        {activeTab === 'characters' && (
          <CharactersPanel
            characters={characters}
            onAdd={onAddCharacter}
            onRemove={onRemoveCharacter}
            onShowGuide={() => tour.show(CHARACTERS_STEP)}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsPanel settings={settings} onUpdate={onUpdateSettings} directory={directory} />
        )}
        {activeTab === 'help' && (
          <HelpPanel onShowTour={() => tour.show(0)} onShowCharacters={() => tour.show(CHARACTERS_STEP)} />
        )}
      </div>

      {directory.notification && (
        <div className={`rf-toast ${directory.notification.kind}`}>
          {directory.notification.kind === 'success' ? '✓ ' : '⚠ '}
          {directory.notification.text}
        </div>
      )}

      <ControlPanel
        isRunning={isRunning}
        done={done}
        pending={pending}
        skipped={skipped}
        currentIndex={currentIndex}
        queueLength={queue.length}
        numbers={queue.map((item, i) => item.number ?? i + 1)}
        onStart={onStart}
        onContinue={onContinue}
        onStop={onStop}
      />

      {tour.open && <Onboarding step={tour.step} onStep={tour.setStep} onFinish={tour.finish} />}
    </div>
  )
}
