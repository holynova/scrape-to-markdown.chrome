# Scrape to Markdown Chrome Extension

一个简洁的 Chrome 浏览器扩展，专注于将网页内容转化为 Markdown 格式，并提供针对微博的批量抓取功能。

## ✨ 主要功能

1.  **微博抓取 (Weibo Scraper)**:
    *   自动滚动加载用户主页。
    *   批量抓取原创微博内容。
    *   支持按关键词筛选、按时间排序。
    *   支持仅导出原创微博（过滤转发）。
    *   自动过滤已删除的微博。
    *   一键导出为 JSON 或 Markdown。
2.  **网页转 Markdown (Page to Markdown)**:
    *   提取当前网页正文，去除广告和无关元素。
    *   一键复制或下载为 `.md` 文件。

## 🛠️ 安装说明

1.  下载 Release 页面中的 `extension.zip` 并解压，或 `git clone` 本仓库并运行 `npm run build` 生成 `dist` 目录。
2.  打开 Chrome 浏览器，访问 `chrome://extensions/`。
3.  开启右上角的 **"开发者模式" (Developer mode)**。
4.  点击 **"加载已解压的扩展程序" (Load unpacked)**，选择本项目下的 `dist` 文件夹。

## 💻 开发构建

```bash
# 安装依赖
npm install

# 开发模式 (监听文件变化)
npm run dev

# 生产构建
npm run build
```

## 📝 技术栈

*   React 19 + TypeScript
*   Vite + @crxjs/vite-plugin
*   TailwindCSS + ShadcnUI
*   @mozilla/readability + Turndown