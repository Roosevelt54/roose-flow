import React, { useState } from 'react'
import type { CharacterEntry } from '../../lib/characters'

interface CharactersPanelProps {
  characters: CharacterEntry[]
  onAdd: (name: string, trigger: string) => void
  onRemove: (name: string) => void
  onShowGuide?: () => void
}

export function CharactersPanel({ characters, onAdd, onRemove, onShowGuide }: CharactersPanelProps) {
  const [name, setName] = useState<string>('')
  const [trigger, setTrigger] = useState<string>('')

  const handleAdd = () => {
    if (name.trim()) {
      onAdd(name.trim(), trigger.trim() || name.trim())
      setName('')
      setTrigger('')
    }
  }

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd()
  }

  return (
    <>
      <div className="rf-card soft">
        <h3 className="rf-h">Keep the same face in every image</h3>
        <p className="rf-sub">
          Add each character once. When a prompt mentions them, Roose Flow attaches that
          character in Flow for you.
        </p>
        {onShowGuide && (
          <button className="rf-btn link" onClick={onShowGuide}>
            How does this work?
          </button>
        )}
      </div>

      <div className="rf-card">
        <h3 className="rf-h">Add a character</h3>

        <label className="rf-label" htmlFor="rf-char-name">
          Character name in Flow
        </label>
        <input
          id="rf-char-name"
          className="rf-input"
          type="text"
          placeholder="e.g. CHINAZA NWOSU"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={onEnter}
        />
        <p className="rf-help">Exactly as written under the character's tile in Flow.</p>

        <label className="rf-label" htmlFor="rf-char-words">
          Words in your prompts <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional)</span>
        </label>
        <input
          id="rf-char-words"
          className="rf-input"
          type="text"
          placeholder="e.g. CHINAZA"
          value={trigger}
          onChange={(e) => setTrigger(e.target.value)}
          onKeyDown={onEnter}
        />
        <p className="rf-help">
          What your prompts call this person. Leave empty to use the name above.
        </p>

        <button className="rf-btn primary block" style={{ marginTop: 12 }} onClick={handleAdd} disabled={!name.trim()}>
          Add character
        </button>
      </div>

      <div className="rf-section-title">Your characters</div>
      {characters.length === 0 ? (
        <div className="rf-card rf-empty">
          <div className="big">No characters yet</div>
          <p className="rf-sub">
            Example: name <b>CHINAZA NWOSU</b>, words in your prompts <b>CHINAZA</b>.
          </p>
        </div>
      ) : (
        <ul className="rf-list">
          {characters.map((c) => (
            <li key={c.name} className="rf-item" style={{ cursor: 'default' }}>
              <div className="rf-text" style={{ display: 'block' }}>
                <b>{c.name}</b>
                <div className="rf-help" style={{ marginTop: 2 }}>
                  Added when a prompt says "{c.trigger}"
                </div>
              </div>
              <button className="rf-icon-btn" onClick={() => onRemove(c.name)} aria-label={`Remove ${c.name}`} title="Remove">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
