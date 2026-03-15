import type { DoubanBook } from '../types';

export class DoubanScraper {
  private isRunning = false;
  private intervalId: any = null;

  private onData: (data: DoubanBook[]) => void;
  private onFinish: () => void;

  constructor(
    onData: (data: DoubanBook[]) => void,
    onFinish: () => void
  ) {
    this.onData = onData;
    this.onFinish = onFinish;
  }

  static async checkAndResume(
      onData: (data: DoubanBook[]) => void,
      onFinish: () => void
  ) {
      const data = await chrome.storage.local.get(['isScrapingDouban', 'doubanLimit']);
      if (data.isScrapingDouban) {
         console.log('[DoubanScraper] Resuming scrape on page load...');
         const scraper = new DoubanScraper(onData, onFinish);
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
    this.onFinish();
  }

  private processPage() {
    if (!this.isRunning) return;

    // 1. Extract data
    this.scrapeCurrentView();

    if (!this.isRunning) return; // Might be stopped based on data sent, e.g limit reached via feedback (if we implemented it)

    // 2. Scroll to bottom
    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: 'smooth'
    });

    // 3. Find next and click
    const nextBtn = document.querySelector('.paginator .next a') as HTMLAnchorElement;
    if (nextBtn) {
      console.log('[DoubanScraper] Found next page link. Going to click in a random delay.');
      const delay = Math.random() * 2000 + 1500;
      this.intervalId = setTimeout(() => {
        if (!this.isRunning) return;
        nextBtn.click();
      }, delay);
    } else {
      console.log('[DoubanScraper] Reached bottom or no next page. Stopping.');
      this.stop();
    }
  }

  private scrapeCurrentView() {
    if (!this.isRunning) return;

    const newBooks: DoubanBook[] = [];
    const items = document.querySelectorAll('li.subject-item');
    console.log(`[DoubanScraper] Found ${items.length} items on page.`);

    items.forEach((node) => {
      const card = node as HTMLElement;
      const titleEl = card.querySelector('.info h2 a') as HTMLAnchorElement;
      let title = titleEl ? titleEl.innerText.replace(/\n| /g, '').trim() : '';
      let link = titleEl ? titleEl.href : '';

      let id = '';
      if (link) {
         const match = link.match(/subject\/(\d+)/);
         if (match) {
            id = match[1];
         }
      }
      if (!id) id = this.hash(title + (new Date().getTime()));

      let rating = '';
      const ratingEl = card.querySelector('.info .short-note [class^="rating"]');
      if (ratingEl) {
         const classList = Array.from(ratingEl.classList);
         const ratingClass = classList.find(c => c.startsWith('rating') && c.endsWith('-t'));
         if (ratingClass) {
             const stars = ratingClass.replace('rating', '').replace('-t', '');
             rating = stars !== '0' ? `${stars}星` : '';
         }
      }

      let readDate = '';
      const dateEl = card.querySelector('.info .short-note .date');
      if (dateEl) {
          readDate = dateEl.textContent || '';
          readDate = readDate.replace('读过', '').trim();
      }

      let comment = '';
      const commentEl = card.querySelector('.info .short-note p.comment');
      if (commentEl) {
          comment = commentEl.textContent?.trim() || '';
      }

      const book: DoubanBook = { id, title, rating, readDate, comment, link };
      newBooks.push(book);
    });

    if (newBooks.length > 0) {
      this.onData(newBooks);
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
