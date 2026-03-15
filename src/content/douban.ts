import type { DoubanItem } from '../types';

export class DoubanScraper {
  private isRunning = false;
  private intervalId: any = null;

  private onData: (data: DoubanItem[]) => void;
  private onLog: (msg: string) => void;
  private onFinish: () => void;

  constructor(
    onData: (data: DoubanItem[]) => void,
    onLog: (msg: string) => void,
    onFinish: () => void
  ) {
    this.onData = onData;
    this.onLog = onLog;
    this.onFinish = onFinish;
  }

  static async checkAndResume(
      onData: (data: DoubanItem[]) => void,
      onLog: (msg: string) => void,
      onFinish: () => void
  ) {
      const data = await chrome.storage.local.get(['isScrapingDouban', 'doubanLimit']);
      if (data.isScrapingDouban) {
         console.log('[DoubanScraper] Resuming scrape on page load...');
         const scraper = new DoubanScraper(onData, onLog, onFinish);
         scraper.start((data.doubanLimit as number) || 0, true);
         return scraper;
      }
      return null;
  }

  async start(limit: number, isResume = false) {
    if (this.isRunning) return;

    this.isRunning = true;

    if (!isResume) {
       await chrome.storage.local.set({ isScrapingDouban: true, doubanLimit: limit });
    }

    console.log('[DoubanScraper] Started');
    this.onLog(`[System] Started scraping on: ${window.location.href}`);

    // Initial delay to simulate human behavior
    setTimeout(() => {
        this.processPage();
    }, isResume ? 1500 + Math.random() * 1000 : 500);
  }

  async stop() {
    this.isRunning = false;
    if (this.intervalId) clearTimeout(this.intervalId);
    await chrome.storage.local.set({ isScrapingDouban: false });
    console.log('[DoubanScraper] Stopped.');
    this.onLog(`[System] Scraper stopped.`);
    this.onFinish();
  }

  private processPage() {
    if (!this.isRunning) return;

    this.scrapeCurrentView();

    if (!this.isRunning) return;

    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: 'smooth'
    });
    this.onLog(`[Action] Scrolled to bottom of page`);

    const nextBtn = document.querySelector('.paginator .next a') as HTMLAnchorElement;
    if (nextBtn) {
      console.log('[DoubanScraper] Found next page link. Going to click in a random delay.');
      this.onLog(`[Action] Found next page. Navigating...`);
      const delay = Math.random() * 2000 + 1500;
      this.intervalId = setTimeout(() => {
        if (!this.isRunning) return;
        nextBtn.click();
      }, delay);
    } else {
      console.log('[DoubanScraper] Reached bottom or no next page. Stopping.');
      this.onLog(`[System] Reached end of list.`);
      this.stop();
    }
  }

  private scrapeCurrentView() {
    if (!this.isRunning) return;

    const newItems: DoubanItem[] = [];
    const url = window.location.href;
    
    let type: 'book' | 'movie' = 'book';
    if (url.includes('movie.douban.com')) {
      type = 'movie';
    } else if (url.includes('music.douban.com')) {
      type = 'movie'; // Or create a 'music' type later. For now assume it falls into general items if added
    }

    let status: 'wish' | 'collect' = 'collect';
    if (url.includes('/wish')) {
      status = 'wish';
    } else if (url.includes('/do')) {
      status = 'collect'; // Treating 'doing' as collect or similar, but spec says just wish/collect
    }

    const items = document.querySelectorAll('li.subject-item, div.item');
    console.log(`[DoubanScraper] Found ${items.length} items on page.`);

    items.forEach((node) => {
      const card = node as HTMLElement;
      
      // Title extraction (movies often use .title a em)
      let titleEl = card.querySelector('.info h2 a, .info .title a em, .title a') as HTMLElement;
      let title = titleEl ? (titleEl.innerText || titleEl.textContent || '').replace(/\n| /g, '').trim() : '';
      
      // Link extraction
      let linkEl = card.querySelector('.info h2 a, .info .title a, .title a') as HTMLAnchorElement;
      let link = linkEl ? linkEl.href : '';

      let id = '';
      if (link) {
         const match = link.match(/subject\/(\d+)/);
         if (match) {
            id = match[1];
         }
      }
      if (!id) id = this.hash(title + (new Date().getTime()));

      let rating = '';
      const ratingEl = card.querySelector('.info .short-note [class^="rating"], .date [class^="rating"], span[class^="rating"]');
      if (ratingEl) {
         const classList = Array.from(ratingEl.classList);
         const ratingClass = classList.find(c => c.startsWith('rating') && c.endsWith('-t'));
         if (ratingClass) {
             const stars = ratingClass.replace('rating', '').replace('-t', '');
             rating = stars !== '0' ? `${stars}星` : '';
         }
      }

      let readDate = '';
      const dateEl = card.querySelector('.info .short-note .date, .date');
      if (dateEl) {
          readDate = dateEl.textContent || '';
          readDate = readDate.replace(/读过|看过|想看|想读/g, '').trim();
      }

      let comment = '';
      const commentEl = card.querySelector('.info .short-note p.comment, .comment, span.comment');
      if (commentEl) {
          comment = commentEl.textContent?.trim() || '';
      }

      const item: DoubanItem = { id, title, rating, readDate, comment, link, type, status };
      newItems.push(item);
      this.onLog(`[Extract] ${title} (${item.type})`);
    });

    if (newItems.length > 0) {
      this.onData(newItems);
    } else {
      this.onLog(`[Warning] Found 0 items on this page...`);
    }
  }

  private hash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return hash.toString();
  }
}
