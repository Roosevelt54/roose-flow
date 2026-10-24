import React, { useRef, useState } from 'react'
import { parsePromptFile, type ParsedPrompt } from '../../lib/promptFile'

interface FileImportProps {
  onImport: (prompts: ParsedPrompt[]) => void
}

export function FileImport({ onImport }: FileImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string>('')
  const isProcessingRef = useRef(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isProcessingRef.current) return
    isProcessingRef.current = true
    const file = e.target.files?.[0]
    if (!file) {
      isProcessingRef.current = false
      return
    }

    try {
      const text = await file.text()
      const { items: prompts, skipped, format } = parsePromptFile(text)

      if (prompts.length === 0) {
        setMessage('No prompts found in that file. Number them like "1. your prompt".')
        return
      }

      onImport(prompts)
      setMessage(
        format === 'shot-list'
          ? `Added ${prompts.length} AI image prompts and left out ${skipped.length} stock, B-roll or other shots.`
          : `Added ${prompts.length} prompts.`
      )
      setTimeout(() => setMessage(''), 8000)
      e.target.value = ''
    } catch (err) {
      console.error('[FileImport] Error:', err)
      setMessage('Could not read that file.')
    } finally {
      isProcessingRef.current = false
    }
  }

  const failed = message.startsWith('No prompts') || message.startsWith('Could not')

  return (
    <div className="rf-card">
      <input ref={fileInputRef} type="file" accept=".txt" onChange={handleFileChange} style={{ display: 'none' }} />
      <h3 className="rf-h">Your prompts</h3>
      <p className="rf-sub">Upload a .txt file with your numbered prompts.</p>
      <button className="rf-btn primary block" style={{ marginTop: 10 }} onClick={() => fileInputRef.current?.click()}>
        Upload prompts file
      </button>
      {message && (
        <p className="rf-help" style={{ color: failed ? 'var(--bad)' : 'var(--good)', fontWeight: 600 }}>
          {message}
        </p>
      )}
    </div>
  )
}
