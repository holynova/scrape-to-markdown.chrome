# Chrome Web Store screenshots

The three PNG files in this directory are 1280×800 Chrome Web Store screenshots.
They present genuine extension side-panel captures already maintained in `docs/assets/`, framed in a store-ready landscape canvas:

- `01-markdown-export-1280x800.png` — Markdown export.
- `02-image-handling-1280x800.png` — image handling.
- `03-ai-image-descriptions-1280x800.png` — optional AI image descriptions.

## Release limitation

These screenshots do not show the v1.1.7 ChatGPT conversation-export tab. Browser automation is not permitted to open `chrome://extensions` in this environment, so the built artifact could not be installed for a current UI capture. Before submitting the update, replace or add a screenshot showing the ChatGPT tab after manually loading `dist` as an unpacked extension and verifying the feature in Chrome.
