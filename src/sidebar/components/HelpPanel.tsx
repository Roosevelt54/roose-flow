import React from 'react'

interface HelpPanelProps {
  onShowTour: () => void
  onShowCharacters: () => void
}

function version(): string {
  try {
    return chrome.runtime.getManifest().version
  } catch {
    return ''
  }
}

export function HelpPanel({ onShowTour, onShowCharacters }: HelpPanelProps) {
  return (
    <>
      <div className="rf-card soft">
        <h3 className="rf-h">New here?</h3>
        <p className="rf-sub">A 1-minute tour of everything you need.</p>
        <div className="rf-row" style={{ marginTop: 10 }}>
          <button className="rf-btn primary" onClick={onShowTour}>
            Show the quick tour
          </button>
          <button className="rf-btn" onClick={onShowCharacters}>
            How characters work
          </button>
        </div>
      </div>

      <div className="rf-card">
        <h3 className="rf-h">Common questions</h3>

        <details className="rf-faq">
          <summary>Nothing happens when I press Start</summary>
          <p>
            Check the top of this panel says "Connected to Flow". If it doesn't, open your project
            on flow.google.com, reload that tab (F5) and keep it open. Turn off any other Flow or
            automation extension, then press Start again.
          </p>
        </details>

        <details className="rf-faq">
          <summary>A character wasn't added to an image</summary>
          <p>
            Open the Characters tab. "Character name in Flow" must match the tile's caption in Flow
            (capital letters don't matter), and "Words in your prompts" must appear in the prompt.
            Keep one entry per person.
          </p>
        </details>

        <details className="rf-faq">
          <summary>Chrome shows "debugging this browser"</summary>
          <p>
            That's normal. Roose Flow uses it to press Flow's send button, which Flow ignores
            otherwise. Leave the bar in place until the run is finished.
          </p>
        </details>

        <details className="rf-faq">
          <summary>Where are my images saved?</summary>
          <p>
            In the folder shown under Settings, named by prompt number, for example 004. By default
            that's Downloads / roose-flow.
          </p>
        </details>

        <details className="rf-faq">
          <summary>Can I stop and carry on later?</summary>
          <p>
            Yes. Press Stop. Later, type the prompt number you want under "Start from prompt" and
            press Continue. Keep this panel open, because closing it clears the queue.
          </p>
        </details>
      </div>

      {version() && <p className="rf-help" style={{ textAlign: 'center' }}>Roose Flow v{version()}</p>}
    </>
  )
}
