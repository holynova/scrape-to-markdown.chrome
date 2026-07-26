# Chrome Web Store submission checklist — v1.1.7

## Release summary

- Release type: update from 1.1.6 to 1.1.7.
- Extension package: `packages/scrape-to-markdown-v1.1.7.zip`.
- Package SHA-256: `0fe8b0667422afbc69481bb923e82f7a54e95aa3248479862e89bb37561442a7`.
- Category: Productivity.
- Languages: English and Chinese.

## Upload inputs

- Upload `packages/scrape-to-markdown-v1.1.7.zip`.
- Use `assets/store-icon-128.png` as the store icon.
- Use `assets/promo-small-440x280.png` as the small promotional tile.
- Upload one to five screenshot files named `assets/screenshot-*.png`. Three ready-to-use 1280×800 files are included.
- Copy the listing fields from `listing.md`.
- Copy the permissions and data-handling explanations from `privacy.md`.

## Required account-holder actions

1. Enter `https://holynova.github.io/scrape-to-markdown.chrome/privacy/` in the Chrome Web Store Dashboard after confirming the public page is reachable.
2. Review the dashboard’s data-use, privacy, and Limited Use declarations against the final published build, and personally certify them. The prepared text is a factual draft, not legal advice or a certification on the publisher’s behalf.
3. Before submitting, manually load `dist` as an unpacked extension in Chrome and test the new ChatGPT conversation-export tab. Replace or add a screenshot of that tab after the test; see `screenshots/README.md`.
4. Review the final Chrome Web Store preview, pricing, distribution, contact email, and account-specific fields.

## Verified locally

- `npm run build` completed successfully.
- The packaged ZIP contains the Manifest V3 build.
- `audit_release.py dist release/chrome-web-store --previous-version 1.1.6` passed.

## Not performed

- No Chrome Web Store Dashboard was opened.
- No package was uploaded.
- No review submission was made.
- The privacy policy must be confirmed reachable at the canonical HTTPS URL before dashboard submission.
