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

export function SettingsPanel({ settings, onUpdate, directory }: SettingsPanelProps) {
  return (
    <>
      <div className="rf-section-title">Saving your images</div>
      <div className="rf-card">
        <label className="rf-toggle">
          <input type="checkbox" checked={settings.autoDownload} onChange={(e) => onUpdate({ autoDownload: e.target.checked })} />
          <span>
            <strong>Save images automatically</strong>
            <small>Each finished image is saved as soon as it's ready.</small>
          </span>
        </label>

        <label className="rf-label">Where to save</label>
        {directory.supported ? (
          <>
            <div className="rf-row">
              <div className="rf-input" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {directory.folderName ?? `Downloads / ${settings.downloadFolder.trim() || 'roose-flow'}`}
              </div>
              <button className="rf-btn" onClick={directory.choose}>Choose folder</button>
            </div>
            {directory.folderName && (
              <button className="rf-btn link" onClick={directory.clear}>
                Use the Downloads folder instead
              </button>
            )}
            {directory.needsPermission && (
              <div className="rf-tip" style={{ marginTop: 8 }}>
                Chrome dropped access to this folder, which it does when it restarts.
                <button className="rf-btn block" style={{ marginTop: 8 }} onClick={directory.reconnect}>
                  Restore access
                </button>
              </div>
            )}
            {directory.error && <p className="rf-help" style={{ color: 'var(--bad)' }}>{directory.error}</p>}
            <p className="rf-help">Images are named by prompt number, like 004. Keep this panel open while saving.</p>
          </>
        ) : (
          <>
            <input className="rf-input" type="text" value={settings.downloadFolder} onChange={(e) => onUpdate({ downloadFolder: e.target.value })} placeholder="roose-flow" />
            <p className="rf-help">A folder inside Chrome's Downloads folder.</p>
          </>
        )}
      </div>

      <div className="rf-section-title">Smart helpers</div>
      <div className="rf-card">
        <label className="rf-toggle">
          <input type="checkbox" checked={settings.characterConsistency} onChange={(e) => onUpdate({ characterConsistency: e.target.checked })} />
          <span>
            <strong>Use my characters</strong>
            <small>Attach characters from the Characters tab when a prompt mentions them.</small>
          </span>
        </label>
        <label className="rf-toggle">
          <input type="checkbox" checked={settings.reuseScenes !== false} onChange={(e) => onUpdate({ reuseScenes: e.target.checked })} />
          <span>
            <strong>Reuse earlier scenes</strong>
            <small>Add an earlier image of the same place, so locations look consistent.</small>
          </span>
        </label>
        <label className="rf-toggle">
          <input type="checkbox" checked={settings.serialNumber} onChange={(e) => onUpdate({ serialNumber: e.target.checked })} />
          <span>
            <strong>Number the files</strong>
            <small>Start each file name with its number.</small>
          </span>
        </label>
      </div>

      <div className="rf-section-title">Speed</div>
      <div className="rf-card">
        <p className="rf-sub">
          Roose Flow waits a random time between images, so Flow isn't hit too fast.
        </p>
        <label className="rf-label">Shortest wait: {settings.delayMin} seconds</label>
        <input className="rf-range" type="range" min="0" max="60" value={settings.delayMin} onChange={(e) => onUpdate({ delayMin: parseInt(e.target.value) })} />
        <label className="rf-label">Longest wait: {settings.delayMax} seconds</label>
        <input className="rf-range" type="range" min="0" max="120" value={settings.delayMax} onChange={(e) => onUpdate({ delayMax: parseInt(e.target.value) })} />
      </div>
    </>
  )
}
