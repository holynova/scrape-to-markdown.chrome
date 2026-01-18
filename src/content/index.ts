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

  if (request.action === 'EXTRACT_GEMINI_IMAGES') {
    console.log('Extracting Gemini images...');
    const images = Array.from(document.querySelectorAll('img'));
    // Filter for likely content images (this might need tuning based on actual DOM)
    // For now, valid images usually start with https://lh3.googleusercontent.com/
    const imageUrls = images
      .map(img => img.src)
      // .filter(src => src.includes('googleusercontent.com') && !src.includes('favicon'));
    console.log("imageUrls",imageUrls);
    const uniqueUrls = new Set(imageUrls);
    const downloadList = Array.from(uniqueUrls).map(url => {
      // Transform to full size: Gemini uses format like =w320-h320-n-v1-rj
      // We replace everything after the last '=' with 's0' for full resolution
      // Match pattern: =<anything that's not = until end of string>
      
      let fullUrl = url;
      // Find the last = and replace everything after it with s0
      const lastEqIndex = url.lastIndexOf('=');
      if (lastEqIndex !== -1) {
        fullUrl = url.substring(0, lastEqIndex + 1) + 's0';
      } else {
        fullUrl = url + '=s0';
      }
      return fullUrl;
    });

    console.log(`Found ${downloadList.length} images.`);

    if (downloadList.length > 0) {
      chrome.runtime.sendMessage({ 
        action: 'DOWNLOAD_IMAGES', 
        urls: downloadList 
      });
      sendResponse({ success: true, count: downloadList.length });
    } else {
      sendResponse({ success: false, error: 'No images found' });
    }
    return true;
  }
});
