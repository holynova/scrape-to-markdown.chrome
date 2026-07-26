# Privacy Practices

## Single Purpose

Help users export and download content from the active browser page or their signed-in AI service session in portable formats.

## Permission Justifications

- `sidePanel`: shows the extension's user interface beside the current browser tab.
- `activeTab`: reads the user-selected active tab only when the user starts a page conversion, image scan, or source-specific export.
- `scripting`: supports the page-content tooling included with the extension.
- `storage`: stores operational state for resumable Douban scraping and the user's side-panel language choice in Chrome local storage.
- `tabs`: reads the active tab, sends commands to the extension content script, and navigates the active tab between sequential Douban list pages after the user begins that workflow.
- `downloads`: saves user-requested ZIP or Markdown export files through Chrome's download manager.

## Host Permission Justifications

- `https://weibo.com/*`: reads Weibo profile content only after the user starts the Weibo exporter.
- `<all_urls>`: enables the user-requested Page to Markdown and Page Images tools on the active page, and allows content scripts to support the declared AI and social export features on their relevant sites.

## Remote Code

No remote executable code is loaded by the extension. The packaged extension bundles its scripts locally. It requests content, image files, and ChatGPT API responses only to carry out user-initiated exports.

## User Data

The extension can process page content, image URLs, Weibo and Douban content visible to the signed-in user, and ChatGPT conversation data or attachments selected by the user. This data is processed in the browser to create requested exports. Operational state for Douban scraping and the language preference is stored in Chrome local storage. The extension does not include analytics, advertising, payments, or a developer-operated backend.

## Data Transfers and Prohibited Uses

The extension does not sell user data, use it for creditworthiness or lending decisions, or transfer it to a developer-operated server. When a user exports content from ChatGPT, Gemini, Weibo, Douban, or a webpage, the extension communicates with that selected source as needed to retrieve the requested content and downloads the resulting file through Chrome.

## Limited Use

Not applicable as a certification decision. The extension does not use Google user data through a Google OAuth API. Any use of data obtained from a website is limited to the user-initiated export feature.

## Privacy Policy

https://holynova.github.io/scrape-to-markdown.chrome/privacy/
