export interface WeiboPost {
  id: string;
  author: string;
  content: string;
  publishTime: string;
  link?: string;
}

export class WeiboScraper {
  private isRunning = false;
  private scrapedIds = new Set<string>();
  private limit = 0;
  private count = 0;
  private observer: MutationObserver | null = null;
  private scrollInterval: any = null;
  
  private onData: (data: WeiboPost[]) => void;
  private onFinish: () => void;

  constructor(
    onData: (data: WeiboPost[]) => void, 
    onFinish: () => void
  ) {
    this.onData = onData;
    this.onFinish = onFinish;
  }

  start(limit: number) {
    if (this.isRunning) return;
    
    this.limit = limit;
    this.isRunning = true;
    this.scrapedIds.clear();
    this.count = 0;

    console.log('[WeiboScraper] Started with limit:', limit);

    // Initial scrape
    this.scrapeCurrentView();

    // Scroll Loop
    this.scrollInterval = setInterval(() => {
      if (!this.isRunning) return;
      
      window.scrollTo(0, document.body.scrollHeight);
    }, 2500); // 2.5s for network load

    // Observer for new nodes
    this.observer = new MutationObserver((mutations) => {
      let shouldScrape = false;
      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          shouldScrape = true;
          break;
        }
      }
      if (shouldScrape) {
        this.scrapeCurrentView();
      }
    });
    
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  stop() {
    this.isRunning = false;
    if (this.scrollInterval) clearInterval(this.scrollInterval);
    if (this.observer) this.observer.disconnect();
    console.log('[WeiboScraper] Stopped. Total:', this.count);
    this.onFinish();
  }

  private scrapeCurrentView() {
    if (!this.isRunning) return;

    const newPosts: WeiboPost[] = [];
    
    // Attempt to find cards using multiple strategies
    let items = document.querySelectorAll('article');
    if (items.length === 0) {
       items = document.querySelectorAll('div[action-type="feed_list_item"]');
    }
    // Fallback: Use the content class which is very common in new Weibo
    if (items.length === 0) {
       items = document.querySelectorAll('.wbpro-feed-content');
    }

    items.forEach((node) => {
      if (this.limit > 0 && this.count >= this.limit) {
         this.stop();
         return;
      }

      let card = node as HTMLElement;
      // If we selected content div directly, try to find the container card
      if (node.classList.contains('wbpro-feed-content')) {
         // Usually wrapped in some layout div
         card = node.closest('div.vue-recycle-scroller__item-view') as HTMLElement 
                || node.parentElement?.parentElement as HTMLElement 
                || node.parentElement as HTMLElement;
      }

      // --- ID Extraction ---
      let mid = card.getAttribute('mid');
      
      // --- Content Extraction ---
      // 1. Try standard text classes
      // 2. Try the container itself if it's the content
      // 3. Look for nested text containers
      const contentEl = card.querySelector('.detail_text, .wbpro-feed-content, [class*="wbtext"]');
      let content = contentEl ? (contentEl as HTMLElement).innerText : '';
      
      // If we still don't have content, maybe the card *is* the content wrapper?
      if (!content && card.classList.contains('wbpro-feed-content')) {
          content = card.innerText;
      }

      // Basic validation
      if (!content && !mid) return;

      // Fallback ID generation
      if (!mid) {
         mid = this.hash(content + (new Date().getTime()));
      }

      if (this.scrapedIds.has(mid)) return;

      // --- Author Extraction ---
      // Strategy 1: Look for class containing "name" (e.g. _name_1b05f_122)
      let authorEl = card.querySelector('[class*="name"] span, .screen_name, .name');
      // Strategy 2: Look for avatar link which often has aria-label or title
      if (!authorEl) {
         authorEl = card.querySelector('header .woo-avatar-main, .face .img_wrapper');
      }
      
      let author = '';
      if (authorEl) {
         author = (authorEl as HTMLElement).innerText 
                  || (authorEl as HTMLElement).getAttribute('title') 
                  || (authorEl.parentElement?.getAttribute('aria-label')) // Check parent a tag
                  || '';
      }

      // --- Time Extraction ---
      // Strategy 1: Header 'time' attribute (very reliable in new UI)
      const header = card.querySelector('header');
      let publishTime = header?.getAttribute('time') || '';

      // Strategy 2: Link with class containing "time"
      let timeEl: HTMLElement | null = null;
      if (!publishTime) {
         timeEl = card.querySelector('a[class*="time"], .from a, .head-info .time, .created_at');
         if (timeEl) {
            publishTime = timeEl.innerText || timeEl.getAttribute('title') || '';
         }
      }

      // Link extraction
      let link = '';
      if (timeEl && timeEl.tagName === 'A') {
         link = timeEl.getAttribute('href') || '';
      } else if (mid) {
         // Construct link if we have mid (this is a guess, usually correct for user pages)
         // We might not have the user ID easily if not in the link, but let's try finding any link
         const linkEl = card.querySelector('a[class*="time"], a[href*="/status/"]');
         link = linkEl ? linkEl.getAttribute('href') || '' : '';
      }
      if (link && !link.startsWith('http')) link = 'https:' + link;

      // Cleanup
      content = content.replace(/收起|展开/g, '').trim();
      if (!author) author = 'Unknown';
      if (!publishTime) publishTime = 'Unknown';

      const post: WeiboPost = {
        id: mid,
        author: author.trim(),
        content: content,
        publishTime: publishTime.trim(),
        link
      };

      this.scrapedIds.add(mid);
      newPosts.push(post);
      this.count++;
    });

    if (newPosts.length > 0) {
      this.onData(newPosts);
    }
  }

  private hash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString();
  }
}