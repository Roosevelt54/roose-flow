# Task 14: Manual Testing Checklist - Chrome Extension Load & UI Verification

**Date:** 2026-09-05  
**Extension Path:** `dist/`  
**Target Site:** https://labs.google.com/fx/tools/flow

---

## Pre-Testing Setup

- [ ] 1. Open Chrome (or Chromium-based browser)
- [ ] 2. Navigate to `chrome://extensions/`
- [ ] 3. Toggle "Developer mode" ON (top-right corner, toggle switch)
- [ ] 4. Click "Load unpacked" button
- [ ] 5. Select the `dist/` folder from this project
- [ ] **Expected:** Extension loads with icon in top toolbar; no errors in console

---

## UI & Sidebar Verification

- [ ] 6. **Sidebar Appearance Test**
  - Navigate to https://labs.google.com/fx/tools/flow
  - Wait 2-3 seconds for page to fully load
  - **Expected Result:** Dark-themed sidebar appears on right side (400px wide)
  - Screenshot: Capture full page with sidebar visible on right edge
  - Verify: Sidebar contains "Flow Automation" header and prompt list area

- [ ] 7. **Add Prompt via Text Input**
  - In sidebar, locate text input field at top
  - Type test prompt: "Generate a marketing email for SaaS product"
  - Click "Add" or press Enter
  - **Expected:** Prompt appears in list below input field
  - Screenshot: Show new prompt in the list

- [ ] 8. **File Import Test**
  - Create sample test file: `test_prompts.txt` with these lines:
    ```
    Summarize key points from technical documentation
    Create unit test cases for Python function
    ```
  - In sidebar, click "Import Prompts" or file upload icon
  - Select the test file
  - **Expected:** Two new prompts imported and added to list
  - Screenshot: Show imported prompts in sidebar list

- [ ] 9. **Remove Prompt Test**
  - Hover over any prompt in the list
  - Click delete/trash icon (if visible) or right-click context menu
  - **Expected:** Prompt removed from list; list updates immediately
  - Screenshot: Confirm prompt deletion

- [ ] 10. **Drag-Drop Reordering Test**
  - Ensure at least 3 prompts in the list
  - Drag first prompt to position 3
  - Drag second prompt to position 1
  - **Expected:** Prompts reorder smoothly; new order persists
  - Screenshot: Show reordered list

---

## Settings Panel & Persistence

- [ ] 11. **Settings Panel Test**
  - In sidebar, locate Settings icon (gear icon or "Settings" button)
  - Click to open settings panel
  - **Expected:** Panel shows toggles/options (e.g., "Auto-generate", "Dark Mode")
  - Toggle each option ON/OFF
  - Change any numerical settings (delay values, retry count, etc.)
  - Screenshot: Capture settings panel with changes

- [ ] 12. **Persistence Test**
  - After adjusting settings, close the settings panel
  - Close and fully reload the page (Ctrl+Shift+R for hard refresh)
  - Open sidebar again
  - **Expected:** All settings changes persist across reload
  - Verify: Prompts list still contains all items in correct order
  - Screenshot: Show settings retained after reload

---

## Button Functionality

- [ ] 13. **Generation Controls Test**
  - In sidebar, locate "START GENERATION" button
  - Click it
  - **Expected:** Button changes to show "Running..." or loading spinner
  - Screenshot: Capture running state

  - After 2-3 seconds, click "STOP" button (if visible)
  - **Expected:** Button changes to show "Stopped" or returns to initial state
  - Console check: Open DevTools (F12) → Console tab
  - **Expected:** No JavaScript errors or exceptions logged

---

## Final Verification Checklist

- [ ] All 13 tests completed without critical errors
- [ ] Console (DevTools F12) shows no red errors
- [ ] Sidebar renders at 400px width with dark theme
- [ ] Settings persist across page reload
- [ ] Prompt list operations (add/remove/reorder) all work smoothly
- [ ] Ready for commit

---

## Commit Command (Ready to Run)

Once all tests pass, run:

```bash
git add -A
git commit -m "test: verify extension loads and ui functions correctly"
git push
```

Or in PowerShell:
```powershell
git add -A ; git commit -m 'test: verify extension loads and ui functions correctly' ; git push
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Sidebar doesn't appear | Reload page, check manifest.json is valid, verify content-script injected (F12 → Sources → Content Scripts) |
| Settings don't persist | Check localStorage in DevTools Application tab; verify no quota exceeded |
| Prompts list empty after reload | Verify IndexedDB or localStorage initialized; check permissions in manifest.json |
| Console errors | Enable "Pause on exceptions" in DevTools → Sources, reload, and inspect stack trace |
| Extension icon grayed out | Check manifest.json for errors, reload extension from chrome://extensions |

---

## Next Steps After Commit

- [ ] Push to GitHub/main branch
- [ ] Archive this checklist or mark as completed
- [ ] Begin Task 15 (if applicable)
