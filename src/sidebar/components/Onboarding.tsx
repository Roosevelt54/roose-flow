import React from 'react'

interface OnboardingProps {
  step: number
  onStep: (step: number) => void
  onFinish: () => void
}

/** Index of the characters step, so other screens can open the guide right there. */
export const CHARACTERS_STEP = 2

function Welcome() {
  return (
    <>
      <p>
        Roose Flow types your prompts into Google Flow one by one, waits for each image, and
        saves it for you. You just press Start.
      </p>
      <ol className="rf-steps">
        <li>
          <span>
            Open your project on <b>flow.google.com</b> in a Chrome tab and leave it open.
          </span>
        </li>
        <li>
          <span>Keep this panel open while it works. Closing it stops the run.</span>
        </li>
        <li>
          <span>
            Look at the top of this panel: <b>"Connected to Flow"</b> means you're ready.
          </span>
        </li>
      </ol>
    </>
  )
}

function Prompts() {
  return (
    <>
      <p>
        On the <b>Prompts</b> tab, press <b>Upload prompts file</b> and choose a .txt file.
      </p>
      <ol className="rf-steps">
        <li>
          <span>
            A simple numbered list works: <code>1.</code> your first prompt, <code>2.</code> your
            second prompt, and so on.
          </span>
        </li>
        <li>
          <span>
            A full shot list works too. Roose Flow keeps only the <b>AI IMAGE</b> shots and skips
            stock footage and B-roll.
          </span>
        </li>
        <li>
          <span>
            Your numbers are kept: image 4 is saved as <b>004</b>, even if 3 was skipped.
          </span>
        </li>
      </ol>
      <div className="rf-note">You can also type a single prompt and press Add.</div>
    </>
  )
}

function Characters() {
  return (
    <>
      <p>Want the same face in every image? Set each character up once:</p>
      <ol className="rf-steps">
        <li>
          <span>
            In Flow, save your character and give its tile a name, for example{' '}
            <b>CHINAZA NWOSU</b>.
          </span>
        </li>
        <li>
          <span>
            Here, open the <b>Characters</b> tab and type that exact name in{' '}
            <b>Character name in Flow</b>.
          </span>
        </li>
        <li>
          <span>
            In <b>Words in your prompts</b>, type how your prompts write that name, for example{' '}
            <b>CHINAZA</b>. Whenever a prompt has those words, the character is attached for you.
          </span>
        </li>
      </ol>
      <div className="rf-diagram">
        <div className="rf-pair">
          <div className="rf-box">
            <small>Tile caption in Flow</small>
            <b>CHINAZA NWOSU</b>
          </div>
          <span className="rf-arrow">=</span>
          <div className="rf-box">
            <small>Character name in Flow</small>
            <b>CHINAZA NWOSU</b>
          </div>
        </div>
        <div className="rf-pair">
          <div className="rf-box">
            <small>Your prompt says</small>
            <b>"…CHINAZA stands at the desk…"</b>
          </div>
          <span className="rf-arrow">→</span>
          <div className="rf-box">
            <small>Words in your prompts</small>
            <b>CHINAZA</b>
          </div>
        </div>
      </div>
      <div className="rf-tip">
        One entry per person. Capital letters don't matter, but the name in Flow must match the
        tile's caption.
      </div>
    </>
  )
}

function Start() {
  return (
    <>
      <p>
        Press <b>Start making images</b>. For every prompt, Roose Flow adds the characters, sends
        it, waits for the image and saves it.
      </p>
      <ol className="rf-steps">
        <li>
          <span>
            Chrome shows a <b>"debugging this browser"</b> bar. That's expected: it lets Roose Flow
            press Flow's send button. Please don't close it.
          </span>
        </li>
        <li>
          <span>
            Stop any time. To carry on later, type the prompt's number under{' '}
            <b>Start from prompt</b>.
          </span>
        </li>
        <li>
          <span>
            Images from the same scene look alike: Roose Flow adds the scene's first image as a
            reference. You can switch this off in Settings.
          </span>
        </li>
      </ol>
    </>
  )
}

const STEPS = [
  { title: 'Welcome to Roose Flow', body: <Welcome /> },
  { title: 'Add your prompts', body: <Prompts /> },
  { title: 'Add your characters', body: <Characters /> },
  { title: 'Press Start', body: <Start /> },
]

export function Onboarding({ step, onStep, onFinish }: OnboardingProps) {
  const last = STEPS.length - 1
  const current = Math.min(Math.max(step, 0), last)

  return (
    <div className="rf-backdrop" role="dialog" aria-modal="true" aria-label="Quick tour">
      <div className="rf-modal">
        <div className="rf-step-tag">
          Step {current + 1} of {STEPS.length}
        </div>
        <h2>{STEPS[current].title}</h2>
        {STEPS[current].body}

        <div className="rf-dots" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span key={i} className={`rf-dot${i === current ? ' on' : ''}`} />
          ))}
        </div>

        <div className="rf-nav">
          {current === 0 ? (
            <button className="rf-btn link" onClick={onFinish}>
              Skip
            </button>
          ) : (
            <button className="rf-btn" onClick={() => onStep(current - 1)}>
              Back
            </button>
          )}
          {current === last ? (
            <button className="rf-btn primary" onClick={onFinish}>
              Get started
            </button>
          ) : (
            <button className="rf-btn primary" onClick={() => onStep(current + 1)}>
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
