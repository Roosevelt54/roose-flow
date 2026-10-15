import React, { useState } from 'react'
import { QueueItem } from '../../types'

interface QueuePanelProps {
  queue: QueueItem[]
  onRemove: (id: string) => void
  onReorder: (items: QueueItem[]) => void
  onAdd: (text: string) => void
}

export function QueuePanel({ queue, onRemove, onReorder, onAdd }: QueuePanelProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState<string>('')

  // Status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return '#10b981'    // green
      case 'in-progress': return '#f59e0b'  // orange
      case 'skipped': return '#ef4444'  // red
      case 'pending':
      default: return '#9ca3af'  // gray
    }
  }

  // Truncate text to 50 chars
  const truncateText = (text: string, maxLength = 50) => {
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text
  }

  // Handle drag start
  const handleDragStart = (id: string, index: number) => {
    setDraggedId(id)
  }

  // Handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  // Handle drop
  const handleDrop = (dropIndex: number) => {
    if (draggedId === null) return
    const draggedIndex = queue.findIndex(item => item.id === draggedId)
    if (draggedIndex === dropIndex) return

    const newQueue = [...queue]
    const [draggedItem] = newQueue.splice(draggedIndex, 1)
    newQueue.splice(dropIndex, 0, draggedItem)
    onReorder(newQueue)
    setDraggedId(null)
  }

  const handleAddPrompt = () => {
    if (inputValue.trim()) {
      onAdd(inputValue.trim())
      setInputValue('')
    }
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
      {/* Input to add new prompt */}
      <div style={{ marginBottom: '12px', display: 'flex', gap: '4px' }}>
        <input
          type="text"
          placeholder="Add prompt..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleAddPrompt()}
          style={{
            flex: 1,
            padding: '6px 8px',
            backgroundColor: '#2a2a2a',
            color: '#ccc',
            border: '1px solid #444',
            borderRadius: '4px',
            fontSize: '12px'
          }}
        />
        <button
          onClick={handleAddPrompt}
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

      {queue.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
          No prompts in queue
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {queue.map((item, index) => (
            <li
              key={item.id}
              draggable
              onDragStart={() => handleDragStart(item.id, index)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(index)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px',
                borderBottom: '1px solid #2a2a2a',
                backgroundColor: draggedId === item.id ? '#2a2a2a' : 'transparent',
                cursor: 'grab'
              }}
            >
              <span style={{ color: '#666', minWidth: '24px' }}>
                {item.number ?? index + 1}
              </span>
              <span style={{ flex: 1, fontSize: '12px' }}>
                {truncateText(item.text)}
              </span>
              <span style={{
                display: 'inline-block',
                backgroundColor: getStatusColor(item.status),
                color: '#fff',
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '3px',
                minWidth: '60px',
                textAlign: 'center'
              }}>
                {item.status}
              </span>
              <button
                onClick={() => onRemove(item.id)}
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
