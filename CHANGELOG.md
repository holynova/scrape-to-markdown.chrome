## 1.1.7 - 2026-07-19

- Add a ChatGPT conversation exporter with selection, optional images and attachments, plus ZIP downloads.
- Add English and Chinese UI support with a persistent language switcher.
- Improve export filtering and use seconds for request pacing controls.

## 1.1.6 - 2026-05-25

### Fixes
- Fix Douban stop behavior so sequential scraping does not continue after manual stop.
- Enforce Douban limit during current and sequential scraping.
- Make Douban navigation resume more reliable by saving scrape state before page navigation.

### Design
- Replace the extension icon with a green hand-grabbing-browser mark.

## 1.1.5 - 2026-05-24

### Features
- Add a simplified Chrome extension icon optimized for small toolbar sizes.
- Refine AI Image Saver into a source-driven task panel with task summary and clearer logs.
- Auto-select the initial side-panel tab based on the active website.

### Documentation
- Rewrite README with updated feature descriptions and screenshots.

## 1.1.4 - 2026-05-24

### Features
- Add ChatGPT original image downloads in AI Images.
- Add AI Images progress logs, build timestamp display, and max image limit.

### Performance
- Store images in ZIP without recompressing already-compressed image files.

### Fixes
- Keep MV3 background downloads compatible by avoiding unsupported object URL downloads.
