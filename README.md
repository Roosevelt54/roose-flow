# Roose Flow — Chrome Extension

Run a list of image prompts as a batch on [flow.google.com](https://flow.google.com).
Load a `.txt` of numbered prompts, review the queue, and start: Roose Flow enters
each prompt, waits for the render, saves it, and moves on.

## Features

- **Prompt import** — numbered `.txt` files, multi-line prompts kept intact
- **Queue review** — add, remove, and reorder before starting
- **Resume anywhere** — continue from any prompt number
- **Automatic retries** — 3 attempts per prompt, with Flow's own error message
  detected in seconds instead of waiting out the timeout
- **Auto-save to any folder** — pick an output folder with Browse, or fall back
  to Chrome's Downloads directory
- **Side panel UI** — refreshing Flow does not interrupt a run

## Installation

1. `npm install && npm run build`
2. Open `chrome://extensions` and enable **Developer mode**
3. **Load unpacked** → select `dist/`
4. Open <https://flow.google.com> and click the toolbar icon to open the panel

Requires Chrome 114+ (the side panel API).

## Usage

1. **Open the panel** from the toolbar icon
2. **Add prompts** — upload a `.txt` or type them in
3. **Configure settings** — delays, auto-download, download folder
4. **START GENERATION**, or enter a number and **CONTINUE FROM #n**

Prompt files are split on numbered lines (`1. `, `2. `, …), so a prompt may span
as many lines as it needs.

## Settings

| Option | Default | Description |
|--------|---------|-------------|
| Auto-download | On | Save each finished render automatically |
| Serial numbering | Off | Prefix filenames with a sequence number |
| Character consistency | Off | Maintain character consistency across generations |
| Save renders to | Downloads / `roose-flow` | **Browse…** picks any folder on disk; otherwise a subfolder of Chrome's Downloads |
| Delay min | 5s | Minimum random delay between generations |
| Delay max | 15s | Maximum random delay between generations |

## Data handling

Prompts live in `chrome.storage.session` — memory only, never written to disk —
and are discarded when you close the panel. Settings persist in
`chrome.storage.local`. Nothing is uploaded anywhere. See [PRIVACY.md](PRIVACY.md).

## Development

```bash
npm install       # Install dependencies
npm run build     # Build to dist/
npm run test      # Run tests
npm run icons     # Regenerate brand icons
npm run package   # Build and zip for the Web Store
```

## Architecture

- **Content script** (`src/content-script.ts`) — drives Flow's page: types the
  prompt, submits it with Enter, detects the finished render. Injects no UI.
- **Service worker** (`src/background.ts`) — owns the queue and the automation
  loop, and handles downloads.
- **Side panel** (`src/sidepanel.tsx`, `src/sidebar/`) — the React UI. Its port
  to the worker signals when the panel closes, and keeps the worker alive during
  long renders.
- **Storage** (`src/lib/storage.ts`) — queue in session storage, settings in local.

## Publishing

See [STORE_LISTING.md](STORE_LISTING.md) for the Web Store submission sheet.

## A note on terms of service

This extension automates a third-party service. Google's terms for Flow may
prohibit automated or scripted access, and the Chrome Web Store removes
extensions that facilitate breaching a third party's terms. Read Flow's current
terms and satisfy yourself that your use is permitted before distributing this.

## License

[Specify your license here]
