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
    if (!file) return

    try {
      const text = await file.text()

      const { items: prompts, skipped, format } = parsePromptFile(text)

      if (prompts.length === 0) {
        setMessage('No valid prompts found in file')
        return
      }

      onImport(prompts)
      setMessage(
        format === 'shot-list'
          ? `✓ Added ${prompts.length} AI image prompts, left out ${skipped.length} stock/B-roll/other shots`
          : `✓ Added ${prompts.length} prompts`
      )
      setTimeout(() => setMessage(''), 6000)
      e.target.value = ''
    } catch (err) {
      console.error('[FileImport] Error:', err)
      setMessage('Error reading file')
    } finally {
      isProcessingRef.current = false
    }
  }

  return (
    <div style={{ padding: '12px', backgroundColor: '#1a1a1a', borderTop: '1px solid #2a2a2a' }}>
      <input ref={fileInputRef} type="file" accept=".txt" onChange={handleFileChange} style={{ display: 'none' }} />
      <button onClick={() => fileInputRef.current?.click()} style={{ width: '100%', padding: '8px', backgroundColor: '#1e3a8a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
        UPLOAD .TXT FILE
      </button>
      {message && <div style={{ marginTop: '8px', fontSize: '12px', color: message.includes('✓') ? '#10b981' : '#ef4444' }}>{message}</div>}
    </div>
  )
}
