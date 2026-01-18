# Scrape to Markdown Chrome Extension

A versatile Chrome extension for content scraping, format conversion, and batch image downloading.

一个多功能 Chrome 扩展，用于内容抓取、格式转换和批量图片下载。

---

## ✨ Features / 功能

| Feature | Description |
|---------|-------------|
| **Weibo Scraper** | Batch scrape original posts from Weibo user profiles with keyword filtering and export to JSON/Markdown. |
| **微博抓取** | 批量抓取微博用户主页的原创微博，支持关键词筛选，导出为 JSON/Markdown。 |
| **Page to Markdown** | Convert any webpage content to clean Markdown format with one click. |
| **网页转 Markdown** | 一键将任意网页内容转换为干净的 Markdown 格式。 |
| **Gemini Saver** | Download all AI-generated images from Gemini MyStuff page as a ZIP file. |
| **Gemini 图片下载** | 将 Gemini MyStuff 页面的所有 AI 生成图片打包下载为 ZIP 文件。 |
| **Page Images** | Scan and download all images from any webpage with size filtering. |
| **页面图片下载** | 扫描任意网页的所有图片，支持按尺寸筛选后批量下载。 |

---

## 🛠️ Installation / 安装

### From Release / 从发布版安装
1. Download `scrape-to-markdown-vX.X.X.zip` from [Releases](https://github.com/holynova/scrape-to-markdown.chrome/releases)
2. Unzip and load the folder in `chrome://extensions/` with Developer Mode enabled

### From Source / 从源码构建
```bash
git clone https://github.com/holynova/scrape-to-markdown.chrome.git
cd scrape-to-markdown.chrome
npm install
npm run build
# Load the `dist` folder in chrome://extensions/
```

---

## 💻 Development / 开发

```bash
npm install      # Install dependencies / 安装依赖
npm run dev      # Development mode / 开发模式
npm run build    # Production build / 生产构建
```

---

## 📝 Tech Stack / 技术栈

- React 19 + TypeScript
- Vite + @crxjs/vite-plugin
- TailwindCSS
- JSZip (for image packaging / 用于图片打包)
- @mozilla/readability + Turndown