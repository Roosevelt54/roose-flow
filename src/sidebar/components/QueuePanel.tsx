import React, { useState } from 'react'
import { QueueItem } from '../../types'

interface QueuePanelProps {
  queue: QueueItem[]
  onRemove: (id: string) => void
  onReorder: (items: QueueItem[]) => void
  onAdd: (text: string) => void
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Waiting',
  'in-progress': 'Making image…',
  done: 'Done',
  skipped: 'Skipped',
}

const STATUS_CLASS: Record<string, string> = {
  'in-progress': 'running',
  done: 'done',
  skipped: 'skipped',
}

export function QueuePanel({ queue, onRemove, onReorder, onAdd }: QueuePanelProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState<string>('')

  const handleDrop = (dropIndex: number) => {
    if (draggedId === null) return
    const draggedIndex = queue.findIndex((item) => item.id === draggedId)
    if (draggedIndex === -1 || draggedIndex === dropIndex) {
      setDraggedId(null)
      return
    }
    const next = [...queue]
    const [moved] = next.splice(draggedIndex, 1)
    next.splice(dropIndex, 0, moved)
    onReorder(next)
    setDraggedId(null)
  }

  const handleAddPrompt = () => {
    if (inputValue.trim()) {
      onAdd(inputValue.trim())
      setInputValue('')
    }
  }

  return (
    <>
      <div className="rf-row">
        <input
          className="rf-input"
          type="text"
          placeholder="Or type one prompt here…"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddPrompt()}
        />
        <button className="rf-btn" onClick={handleAddPrompt}>
          Add
        </button>
      </div>

      {queue.length === 0 ? (
        <div className="rf-card rf-empty">
          <div className="big">No prompts yet</div>
          <p className="rf-sub">Upload a file above, or type a prompt and press Add.</p>
        </div>
      ) : (
        <>
          <div className="rf-section-title">
            {queue.length} {queue.length === 1 ? 'prompt' : 'prompts'} ready · drag to reorder
          </div>
          <ul className="rf-list">
            {queue.map((item, index) => (
              <li
                key={item.id}
                className={`rf-item${draggedId === item.id ? ' dragging' : ''}`}
                draggable
                onDragStart={() => setDraggedId(item.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(index)}
              >
                <span className="rf-num">{item.number ?? index + 1}</span>
                <span className="rf-text">{item.text}</span>
                <span className={`rf-chip ${STATUS_CLASS[item.status] ?? ''}`}>
                  {STATUS_LABEL[item.status] ?? item.status}
                </span>
                <button className="rf-icon-btn" onClick={() => onRemove(item.id)} aria-label="Remove prompt" title="Remove">
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
