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

  // The box takes a shot number as written in the file; the queue may skip some.
  const shotNumbers = numbers ?? Array.from({ length: queueLength }, (_, i) => i + 1)
  const typed = parseInt(startAt, 10)
  const clamped = Number.isFinite(typed)
    ? positionForNumber(shotNumbers, typed)
    : Math.min(Math.max(currentIndex + 1, 1), Math.max(queueLength, 1))
  const currentLabel = shotNumbers[currentIndex] ?? currentIndex + 1
  const canContinue = !isRunning && queueLength > 0

  const finished = done + skipped
  const percent = queueLength > 0 ? Math.round((finished / queueLength) * 100) : 0

  const statusText = isRunning
    ? `Making images · ${done} done, ${pending} to go`
    : queueLength === 0
      ? 'Add some prompts to begin'
      : finished === 0
        ? `${queueLength} ${queueLength === 1 ? 'prompt' : 'prompts'} ready`
        : `Stopped · ${done} done${skipped ? `, ${skipped} skipped` : ''}`

  return (
    <div className="rf-footer">
      <div>
        <div className="rf-progress" aria-label="Progress">
          <div style={{ width: `${percent}%` }} />
        </div>
        <div className="rf-status" style={{ marginTop: 6 }}>
          <span>{statusText}</span>
          <span>{queueLength > 0 ? `Prompt ${currentLabel}` : ''}</span>
        </div>
      </div>

      {isRunning ? (
        <button className="rf-btn danger big block" onClick={onStop}>
          Stop
        </button>
      ) : (
        <button className="rf-btn primary big block" onClick={onStart} disabled={queueLength === 0}>
          Start making images
        </button>
      )}

      <div className="rf-start-from">
        <span>Start from prompt</span>
        <input
          className="rf-input"
          type="number"
          min={1}
          value={startAt}
          placeholder={String(currentLabel)}
          onChange={(e) => setStartAt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canContinue) onContinue(clamped)
          }}
          disabled={!canContinue}
        />
        <button className="rf-btn accent" style={{ flex: 1 }} onClick={() => onContinue(clamped)} disabled={!canContinue}>
          Continue from #{shotNumbers[clamped - 1] ?? clamped}
        </button>
      </div>
    </div>
  )
}
