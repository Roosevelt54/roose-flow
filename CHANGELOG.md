# Roose Flow — Changelog

## v1.0.2 (2026-10-23)

### Changed
- A friendlier, easier-to-read panel: clearer tabs (Prompts, Characters, Settings, Help), plain-language labels, a progress bar, and light or dark colours to match the browser.
- The Characters tab now explains itself: "Character name in Flow" and "Words in your prompts", with examples.

### Added
- A 4-step quick tour for first-time users, including a picture of how a character's name in Flow connects to the words in your prompts. It opens once after install and can be reopened from Help.
- A Help tab with answers to the most common problems.

### Fixed
- A character named two ways (for example "CHINAZA" and "CHINAZA NWOSU") is attached once, not searched for twice.
- A character is no longer reported as missing when it was attached.

## v1.0.1 (2026-10-23)

### Added
- Reuse earlier scenes: when a prompt's Setting matches a place already generated in the run (or the prompt says "same location"), that earlier image is attached as a reference alongside any characters. Can be switched off in Settings.
- Shot-list import: only `AI IMAGE` shots are queued, in order, and files are named by the shot number from the file.
- Connection status in the panel header, and clear messages when a run cannot start or a prompt is skipped (no Flow tab, tab needs a reload, click blocked by Chrome).
- Start and Continue now check for a ready Flow tab first instead of failing silently.

## v1.0.0 (2026-09-05)

Initial release of ZAPI Flow Chrome extension for batch image generation on Google Flow.

### Features
- Queue management: Add, remove, reorder prompts
- Batch generation: Start, pause, stop, continue automation
- Auto-download: Save generated images to folder
- File import: Upload .txt files with bulk prompts
- Progress tracking: Real-time status and statistics
- Settings: Configurable delays, serial numbering, auto-download options
- Dark theme UI matching ZAPI FLOW aesthetic
- Chrome Storage API for local persistence
- Manifest V3 compliance

### Technical
- TypeScript with strict mode
- React 18 for sidebar UI
- Vite build tool
- Chrome Storage, Downloads, and Messaging APIs
- Service Worker for background automation
- Content Script for DOM injection
