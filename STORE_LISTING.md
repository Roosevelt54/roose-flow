# Chrome Web Store submission sheet

Ready-to-paste answers for the Developer Dashboard. Everything here matches the
code as shipped — if the code changes, re-check these before resubmitting.

Upload artefact: `releases/roose-flow-1.0.0.zip` (`npm run package`).

---

## Store listing

**Name**

```
Roose Flow
```

**Summary** (132 character limit)

```
Queue image prompts from a text file, generate them in batches, and save the results automatically.
```

**Description**

```
Roose Flow turns a list of prompts into a hands-off batch run.

Load a .txt file of numbered prompts, review the queue, and start. Roose Flow
enters each prompt in turn, waits for the render to finish, saves it, and moves
on to the next one.

FEATURES

• Import numbered prompts from a .txt file — multi-line prompts stay intact
• Review the queue before starting, and remove any prompt you don't want
• Add prompts by hand as well
• Resume from any prompt number, so an interrupted run costs you nothing
• Automatic retries when a generation fails, with the error caught in seconds
  rather than waiting out a timeout
• Automatic download of finished renders to a folder you choose
• Configurable random delay between generations
• Runs in Chrome's side panel, so refreshing the page won't interrupt a run

PRIVACY

No accounts, no servers, no tracking. Your prompts stay in memory on your own
machine and are discarded when you close the panel. Settings are stored locally.
Nothing is ever uploaded.

Roose Flow is an independent tool and is not affiliated with, endorsed by, or
sponsored by Google.
```

**Category:** Workflow & Planning
**Language:** English

---

## Privacy practices

**Single purpose**

```
Roose Flow has one purpose: to run a user-supplied list of image prompts as a
batch on flow.google.com, entering each prompt in turn and saving the resulting
render to the user's computer.
```

**Permission justifications**

| Permission | Justification |
| --- | --- |
| `storage` | Stores the user's own settings (download folder, delay range, auto-download toggle) locally, and holds the prompt queue in memory while the panel is open. |
| `downloads` | Saves each finished render to the folder the user chose. This is the extension's core output; without it the user would have to save every image by hand. |
| `sidePanel` | Renders the extension's interface — prompt queue, settings, and run controls — in Chrome's side panel. |
| `debugger` | Sends a single real mouse click on the Flow page's send button. The page ignores clicks produced by a page script, so a genuine click has to come through Chrome's debugger protocol. Attached only to the Flow tab, only while a batch is running, and detached when it stops. No page data is read through it. **Expect extra scrutiny at review for this permission.** |
| `https://flow.google.com/*` | The only site the extension operates on. Needed to type each prompt into the page's prompt box, submit it, and detect when the render has finished so the next prompt can start. |

**Remote code:** No. All code ships inside the uploaded package; nothing is
fetched or evaluated at runtime.

**Data usage:** answer *no* to every data-collection category — the extension
collects nothing — then certify:

- Not being sold to third parties
- Not being used or transferred for purposes unrelated to the item's single purpose
- Not being used or transferred to determine creditworthiness or for lending

**Privacy policy URL:** host `PRIVACY.md` publicly (GitHub Pages or a gist) and
paste that URL.

---

## Assets you still need to supply

These cannot be generated from the code:

- **Screenshots** — 1 to 5, at 1280×800 or 640×400. Show the side panel with a
  loaded queue, and the settings tab.
- **Small promo tile** — 440×280. Optional, but required to be featured.

The 128×128 store icon is `public/icons/icon-128.png`, produced by `npm run icons`.

---

## Before you submit

- [ ] Register the developer account (one-time 5 USD fee)
- [ ] Host `PRIVACY.md` and copy its URL
- [ ] Capture screenshots
- [ ] `npm run package`, then upload the zip
- [ ] Read Flow's current terms of service and satisfy yourself that automating
      it is permitted — see the note in `README.md`
