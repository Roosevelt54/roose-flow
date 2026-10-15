import React from 'react'
import { AppSettings } from '../../types'

interface SettingsPanelProps {
  settings: AppSettings
  onUpdate: (partial: Partial<AppSettings>) => void
  directory: {
    supported: boolean
    folderName: string | null
    needsPermission: boolean
    error: string | null
    choose: () => Promise<void>
    reconnect: () => Promise<void>
    clear: () => Promise<void>
  }
}

const buttonStyle: React.CSSProperties = {
  padding: '6px 10px',
  backgroundColor: '#1e3a8a',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '12px',
  whiteSpace: 'nowrap'
}

export function SettingsPanel({ settings, onUpdate, directory }: SettingsPanelProps) {
  return (
    <div style={{ padding: '12px', backgroundColor: '#1a1a1a', color: '#ccc' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Settings</h3>

      <label style={{ display: 'flex', marginBottom: '8px', fontSize: '12px' }}>
        <input type="checkbox" checked={settings.autoDownload} onChange={(e) => onUpdate({ autoDownload: e.target.checked })} style={{ marginRight: '8px' }} />
        Auto-download
      </label>

      <label style={{ display: 'flex', marginBottom: '8px', fontSize: '12px' }}>
        <input type="checkbox" checked={settings.serialNumber} onChange={(e) => onUpdate({ serialNumber: e.target.checked })} style={{ marginRight: '8px' }} />
        Serial numbering
      </label>

      <label style={{ display: 'flex', marginBottom: '16px', fontSize: '12px' }}>
        <input type="checkbox" checked={settings.characterConsistency} onChange={(e) => onUpdate({ characterConsistency: e.target.checked })} style={{ marginRight: '8px' }} />
        Character consistency
      </label>

      <div style={{ marginBottom: '12px' }}>
        <label style={{ fontSize: '12px', color: '#999' }}>Save renders to</label>

        {directory.supported ? (
          <div style={{ marginTop: '4px' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <div style={{ flex: 1, padding: '6px 8px', backgroundColor: '#2a2a2a', border: '1px solid #444', borderRadius: '4px', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {directory.folderName ?? `Downloads / ${settings.downloadFolder.trim() || 'roose-flow'}`}
              </div>
              <button onClick={directory.choose} style={buttonStyle}>Browse…</button>
            </div>

            {directory.folderName && (
              <button
                onClick={directory.clear}
                style={{ ...buttonStyle, backgroundColor: 'transparent', color: '#9ca3af', padding: '4px 0', marginTop: '4px' }}
              >
                Use the Downloads folder instead
              </button>
            )}

            {directory.needsPermission && (
              <div style={{ marginTop: '6px', padding: '8px', backgroundColor: '#3b2f0b', borderRadius: '4px', fontSize: '11px', color: '#fcd34d' }}>
                Chrome dropped access to this folder — it asks again each time it
                restarts.
                <button onClick={directory.reconnect} style={{ ...buttonStyle, backgroundColor: '#d97706', display: 'block', marginTop: '6px' }}>
                  Restore access
                </button>
              </div>
            )}

            {directory.error && (
              <div style={{ marginTop: '6px', fontSize: '11px', color: '#ef4444' }}>{directory.error}</div>
            )}

            <div style={{ marginTop: '6px', fontSize: '11px', color: '#6b7280' }}>
              Renders are written here while the panel stays open.
            </div>
          </div>
        ) : (
          <>
            <input type="text" value={settings.downloadFolder} onChange={(e) => onUpdate({ downloadFolder: e.target.value })} placeholder="roose-flow" style={{ width: '100%', padding: '6px', backgroundColor: '#2a2a2a', color: '#ccc', border: '1px solid #444', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box', marginTop: '4px' }} />
            <div style={{ marginTop: '4px', fontSize: '11px', color: '#6b7280' }}>
              A subfolder of Chrome's Downloads folder.
            </div>
          </>
        )}
      </div>

      <div>
        <label style={{ fontSize: '12px', color: '#999' }}>Min delay (seconds): {settings.delayMin}</label>
        <input type="range" min="0" max="60" value={settings.delayMin} onChange={(e) => onUpdate({ delayMin: parseInt(e.target.value) })} style={{ width: '100%', marginTop: '4px' }} />

        <label style={{ fontSize: '12px', color: '#999', marginTop: '12px', display: 'block' }}>Max delay (seconds): {settings.delayMax}</label>
        <input type="range" min="0" max="120" value={settings.delayMax} onChange={(e) => onUpdate({ delayMax: parseInt(e.target.value) })} style={{ width: '100%', marginTop: '4px' }} />
      </div>
    </div>
  )
}
