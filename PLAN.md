# 项目开发计划书：Scrape-to-Markdown Chrome 插件

## 1. 项目概述
开发一个基于 Chrome Side Panel（侧边栏）的浏览器插件，用于从微博抓取结构化数据，以及将通用网页的核心内容转换为 Markdown 格式。UI 风格简洁，避免蓝紫色调。

## 2. 技术栈
- **核心框架**: React + TypeScript
- **构建工具**: Vite
- **Chrome 插件适配**: @crxjs/vite-plugin (或者手动配置 Rollup 用于多入口构建)
- **样式**: TailwindCSS
- **UI 组件库**: ShadcnUI (Radix UI + Tailwind)
- **图标库**: Lucide React
- **核心逻辑库**:
  - `@mozilla/readability`: 提取网页正文
  - `turndown`: HTML 转 Markdown
  - `dompurify`: 安全清洗 HTML (可选，视情况而定)

## 3. 架构设计 (Manifest V3)

### 3.1 核心模块
- **Side Panel (`src/sidepanel`)**: 插件的主界面，常驻浏览器侧边栏。负责展示 UI、接收用户指令、显示进度和结果。
- **Content Scripts (`src/content`)**: 注入到目标页面（微博或任意文章页）。
  - **通用模块**: 负责运行 Readability 解析当前页面。
  - **微博模块**: 负责执行自动滚动、DOM 节点解析（提取作者、时间、内容）、监听 DOM 变化。
- **Background (`src/background`)**: 负责协调（如果需要跨域或长期保持状态），目前主要用于 Side Panel 的打开逻辑（如果在工具栏点击图标）。

### 3.2 数据流
1.  **用户** 在 Side Panel 点击“开始抓取”。
2.  **Side Panel** 发送消息给 **Content Script**。
3.  **Content Script** 执行 DOM 操作（滚动/解析）。
4.  **Content Script** 实时将进度或抓取到的数据通过 `runtime.sendMessage` 发回 **Side Panel**。
5.  **Side Panel** 更新 React State，渲染列表/Markdown预览。

## 4. UI/UX 设计规范
- **布局**: 使用 ShadcnUI `Tabs` 组件分为三个标签页：
  1.  **微博抓取** (Weibo)
  2.  **文章转MD** (Article to MD)
  3.  **YouTube** (Placeholder)
- **配色**: 使用中性色 (Slate/Gray) 或 暖色 (Orange/Amber) 作为主色调，严格避免蓝紫色。
- **反馈**: 
  - 微博抓取时显示 `Progress` 进度条。
  - 滚动到底部加载时显示“加载中...”状态。

## 5. 详细功能规划

### 5.1 通用页面核心内容 Markdown 抓取
- **输入**: 当前激活 Tab 的页面。
- **处理**: 
  - 使用 `Readability` 解析 `document` 对象。
  - 提取 `article.content` (HTML)。
  - 使用 `TurndownService` 将 HTML 转为 Markdown。
- **输出**: 在 Side Panel 显示 Markdown 预览，提供“复制到剪贴板”和“下载 .md 文件”按钮。

### 5.2 微博抓取功能
- **目标 URL**: `weibo.com/u/*`
- **交互流程**:
  1.  用户设置“停止条件”（例如：抓取 N 条）。
  2.  点击“开始”。
  3.  插件控制页面自动向下滚动。
  4.  监听网络请求或 MutationObserver 监测新微博加载。
  5.  解析每条微博卡片：
      - **作者**: 昵称
      - **时间**: 解析相对时间（"刚刚", "1小时前"）为绝对时间。
      - **内容**: 文本内容，包含转发引用。
  6.  **实时展示**: Side Panel 列表中动态增加新抓取的条目。
  7.  **后处理**:
      - **筛选**: 关键词过滤输入框。
      - **排序**: 按时间正序/倒序切换。
- **输出**: 
  - **List**: 简略卡片列表。
  - **JSON**: 原始数据预览/下载。
  - **Markdown**: 格式化后的文本预览/下载。

## 6. 开发步骤 (ToDo)

1.  **项目初始化**:
    - [ ] 使用 Vite 创建 React TS 项目。
    - [ ] 安装 TailwindCSS, PostCSS, Autoprefixer。
    - [ ] 配置 `@crxjs/vite-plugin` 以支持 Chrome Extension 开发 (Manifest V3)。
    - [ ] 初始化 ShadcnUI。

2.  **基础框架搭建**:
    - [ ] 配置 `manifest.json` (Side Panel, Permissions)。
    - [ ] 创建 Side Panel 入口与基础 Layout。
    - [ ] 实现 Tabs 切换框架。

3.  **功能开发 - 文章转 Markdown**:
    - [ ] 实现 Content Script 中的 Readability 解析逻辑。
    - [ ] 实现 HTML -> Markdown 转换逻辑。
    - [ ] Side Panel 与 Content Script 通信联调。
    - [ ] UI 展示与复制/下载功能。

4.  **功能开发 - 微博抓取**:
    - [ ] 分析微博 DOM 结构 (Content Script)。
    - [ ] 实现自动滚动机制。
    - [ ] 实现单条微博的数据提取解析器。
    - [ ] 实现 Side Panel 的数据接收与状态管理 (Zustand 或 Context)。
    - [ ] 实现停止条件控制 (N条)。
    - [ ] 实现筛选与排序逻辑。
    - [ ] 实现 JSON/Markdown 导出格式化。

5.  **UI 优化与测试**:
    - [ ] 调整配色，确保无蓝紫色。
    - [ ] 优化进度条动画与交互反馈。
    - [ ] 测试边界情况（空数据、非目标页面等）。

6.  **打包交付**:
    - [ ] `npm run build` 生成最终插件包。
