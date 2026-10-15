import React, { useState } from 'react'
import { positionForNumber } from '../../lib/promptFile'

interface ControlPanelProps {
  /** Shot number of each queued prompt, in queue order. */
  numbers?: number[]
  isRunning: boolean
  done: number
  pending: number
  skipped: number
  currentIndex: number
  queueLength: number
  onStart: () => void
  /** 1-based prompt number the user picked. */
  onContinue: (promptNumber: number) => void
  onStop: () => void
}

export function ControlPanel({
  isRunning,
  done,
  pending,
  skipped,
  currentIndex,
  queueLength,
  numbers,
  onStart,
  onContinue,
  onStop
}: ControlPanelProps) {
  const [startAt, setStartAt] = useState<string>('')

  // An empty box just resumes wherever the run left off.
  // The box takes a shot number as written in the file; the queue may skip some.
  const shotNumbers = numbers ?? Array.from({ length: queueLength }, (_, i) => i + 1)
  const typed = parseInt(startAt, 10)
  const clamped = Number.isFinite(typed)
    ? positionForNumber(shotNumbers, typed)
    : Math.min(Math.max(currentIndex + 1, 1), Math.max(queueLength, 1))
  const currentLabel = shotNumbers[currentIndex] ?? currentIndex + 1
  const canContinue = !isRunning && queueLength > 0
  // Status text
  const statusText = isRunning
    ? `Running — ${done} done, ${pending} pending`
    : `Stopped — ${done} done, ${skipped} skipped`

  const promptText = queueLength > 0
    ? `Prompt ${currentLabel} (${currentIndex + 1} of ${queueLength})`
    : 'No prompts'

  return (
    <div style={{
      padding: '12px',
      backgroundColor: '#1a1a1a',
      borderTop: '1px solid #2a2a2a'
    }}>
      {/* Status display */}
      <div style={{
        marginBottom: '8px',
        fontSize: '12px',
        color: '#ccc'
      }}>
        <div>{statusText}</div>
        <div style={{ color: '#999', marginTop: '4px' }}>{promptText}</div>
      </div>

      {/* Buttons */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px'
      }}>
        {/* Start button */}
        <button
          onClick={onStart}
          disabled={isRunning}
          style={{
            padding: '8px 12px',
            backgroundColor: isRunning ? '#4b5563' : '#1e3a8a',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
            opacity: isRunning ? 0.6 : 1
          }}
        >
          START GENERATION
        </button>

        {/* Stop button */}
        <button
          onClick={onStop}
          disabled={!isRunning}
          style={{
            padding: '8px 12px',
            backgroundColor: isRunning ? '#6b7280' : '#4b5563',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: !isRunning ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
            opacity: !isRunning ? 0.6 : 1
          }}
        >
          STOP
        </button>

        {/* Continue from a chosen prompt */}
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '8px' }}>
          <input
            type="number"
            min={1}
            value={startAt}
            placeholder={String(currentLabel)}
            onChange={(e) => setStartAt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canContinue) onContinue(clamped)
            }}
            disabled={!canContinue}
            style={{
              width: '72px',
              padding: '8px',
              backgroundColor: '#2a2a2a',
              color: '#ccc',
              border: '1px solid #444',
              borderRadius: '4px',
              fontSize: '12px',
              textAlign: 'center',
              boxSizing: 'border-box'
            }}
          />
          <button
            onClick={() => onContinue(clamped)}
            disabled={!canContinue}
            style={{
              flex: 1,
              padding: '8px 12px',
              backgroundColor: canContinue ? '#d97706' : '#6b5703',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: canContinue ? 'pointer' : 'not-allowed',
              fontSize: '12px',
              fontWeight: 'bold',
              opacity: canContinue ? 1 : 0.6
            }}
          >
            CONTINUE FROM #{clamped}
          </button>
        </div>
      </div>
    </div>
  )
}
