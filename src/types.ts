export interface QueueItem {
  id: string
  text: string
  /** Shot number from an imported shot list; names the saved file. */
  number?: number
  status: 'pending' | 'in-progress' | 'done' | 'skipped'
}

export interface AppSettings {
  autoDownload: boolean
  serialNumber: boolean
  characterConsistency: boolean
  downloadFolder: string
  delayMin: number
  delayMax: number
}
