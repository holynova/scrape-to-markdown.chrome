import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import { WeiboScraper } from './weibo';

console.log('Scrape-to-Markdown Content Script Loaded');

let weiboScraper: WeiboScraper | null = null;

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'SCRAPE_MARKDOWN') {
    (async () => {
      try {
        // We use a clone to avoid modifying the original DOM if Readability does so (it often does)
        const documentClone = document.cloneNode(true) as Document;
        const reader = new Readability(documentClone);
        const article = reader.parse();

        if (!article || !article.content) {
          sendResponse({ success: false, error: 'Could not parse content' });
          return;
        }

        const turndownService = new TurndownService({
          headingStyle: 'atx',
          codeBlockStyle: 'fenced'
        });
        
        // Basic configuration to remove scripts/styles if Turndown doesn't automatically
        turndownService.remove('script');
        turndownService.remove('style');

        const markdown = turndownService.turndown(article.content);

        sendResponse({ 
          success: true, 
          data: {
            title: article.title,
            markdown: markdown,
            excerpt: article.excerpt,
            siteName: article.siteName
          } 
        });
      } catch (error) {
        console.error('Scrape failed:', error);
        sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    })();
    return true; // Keep channel open for async response
  }

  if (request.action === 'WEIBO_START') {
    if (!weiboScraper) {
       weiboScraper = new WeiboScraper(
          (data) => {
             // Send data back to Side Panel
             chrome.runtime.sendMessage({ action: 'WEIBO_DATA', data }).catch(() => {
                // Ignore error if sidepanel is closed, but maybe stop scraper?
                // For side panel, it should stay open.
             });
          },
          () => {
             chrome.runtime.sendMessage({ action: 'WEIBO_COMPLETE' }).catch(() => {});
          }
       );
    }
    weiboScraper.start(request.limit || 0);
    sendResponse({ success: true, message: 'Weibo scraper started' });
    return true;
  }

  if (request.action === 'WEIBO_STOP') {
    if (weiboScraper) {
       weiboScraper.stop();
    }
    sendResponse({ success: true, message: 'Weibo scraper stopped' });
    return true;
  }
});
