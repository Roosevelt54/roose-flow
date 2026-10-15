import React, { useState } from 'react'
import type { CharacterEntry } from '../../lib/characters'

interface CharactersPanelProps {
  characters: CharacterEntry[]
  onAdd: (name: string, trigger: string) => void
  onRemove: (name: string) => void
}

const inputStyle: React.CSSProperties = {
  padding: '6px 8px',
  backgroundColor: '#2a2a2a',
  color: '#ccc',
  border: '1px solid #444',
  borderRadius: '4px',
  fontSize: '12px',
  boxSizing: 'border-box'
}

export function CharactersPanel({ characters, onAdd, onRemove }: CharactersPanelProps) {
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
    <div style={{
      padding: '12px',
      backgroundColor: '#1a1a1a',
      color: '#ccc',
      borderRadius: '6px',
      maxHeight: '400px',
      overflowY: 'auto'
    }}>
      <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '10px', lineHeight: 1.5 }}>
        <strong>Tile name</strong> must match the renamed tile's caption on Flow
        exactly — that's what gets right-clicked. <strong>Trigger text</strong> is
        what to look for in a prompt; leave it blank to reuse the tile name. Set
        it separately when a prompt spells a name differently from how the tile
        was renamed (tile "Sun Jing Woo", prompts say "SUNG JIN WOO").
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
        <input
          type="text"
          placeholder="Tile name on Flow, e.g. Sun Jing Woo"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyPress={onEnter}
          style={inputStyle}
        />
        <div style={{ display: 'flex', gap: '4px' }}>
          <input
            type="text"
            placeholder="Trigger text in prompts (optional)"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            onKeyPress={onEnter}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={handleAdd}
            style={{
              padding: '6px 12px',
              backgroundColor: '#1e3a8a',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold'
            }}
          >
            +
          </button>
        </div>
      </div>

      {characters.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
          No characters saved
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {characters.map((c) => (
            <li
              key={c.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px',
                borderBottom: '1px solid #2a2a2a'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px' }}>{c.name}</div>
                {c.trigger.toLowerCase() !== c.name.toLowerCase() && (
                  <div style={{ fontSize: '10px', color: '#9ca3af' }}>matches: "{c.trigger}"</div>
                )}
              </div>
              <button
                onClick={() => onRemove(c.name)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontSize: '14px',
                  padding: '0 4px'
                }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
