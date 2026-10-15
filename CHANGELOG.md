# ZAPI Flow — Changelog

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
