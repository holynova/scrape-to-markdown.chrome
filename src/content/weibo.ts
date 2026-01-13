export interface WeiboPost {
  id: string;
  author: string;
  content: string;
  publishTime: string;
  link?: string;
  isRetweet?: boolean;
}

export class WeiboScraper {
  private isRunning = false;
  private scrapedIds = new Set<string>();
  private limit = 0;
  private count = 0;
  private observer: MutationObserver | null = null;
  private scrollInterval: any = null;
  
  private lastScrollHeight = 0;
  private noHeightChangeCount = 0;

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
    this.lastScrollHeight = 0;
    this.noHeightChangeCount = 0;

    console.log('[WeiboScraper] Started with limit:', limit);

    // Initial scrape
    this.scrapeCurrentView();

    // Scroll Loop
    this.scrollInterval = setInterval(() => {
      if (!this.isRunning) return;
      
      const currentHeight = document.body.scrollHeight;
      if (currentHeight === this.lastScrollHeight) {
          this.noHeightChangeCount++;
          console.log(`[WeiboScraper] No height change (${this.noHeightChangeCount}/5)`);
      } else {
          this.noHeightChangeCount = 0;
          this.lastScrollHeight = currentHeight;
      }

      if (this.noHeightChangeCount >= 5) {
          console.log('[WeiboScraper] Reached bottom or loading stuck. Stopping.');
          this.stop();
          return;
      }

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
        // Reset height check counter if we see new nodes (content is loading)
        this.noHeightChangeCount = 0;
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
      let publishTime = '';
      let timeEl: HTMLElement | null = null;

      // Strategy 1: User specified strict selector (a tag with class starting with/containing "_time" and has title)
      const specificTimeEl = card.querySelector('a[class*="_time"]');
      
      if (specificTimeEl) {
         console.log('[WeiboDebug] Found Element with class containing "_time":', specificTimeEl.className);
         console.log('[WeiboDebug] Element Title attribute:', specificTimeEl.getAttribute('title'));
      } else {
         console.log('[WeiboDebug] No Element found with class containing "_time" in this card.');
      }

      if (specificTimeEl && specificTimeEl.hasAttribute('title')) {
          publishTime = specificTimeEl.getAttribute('title') || '';
          timeEl = specificTimeEl as HTMLElement;
          console.log('[WeiboDebug] Strategy 1 (Specific Class) Selected Time:', publishTime);
      }

      // Strategy 2: Header 'time' attribute
      if (!publishTime) {
          const header = card.querySelector('header');
          publishTime = header?.getAttribute('time') || '';
          if (publishTime) console.log('[WeiboDebug] Strategy 2 (Header Attribute) Selected Time:', publishTime);
      }

      // Strategy 3: Generic selectors fallback
      if (!publishTime) {
         timeEl = card.querySelector('a[class*="time"], .from a, .head-info .time, .created_at');
         if (timeEl) {
            publishTime = timeEl.getAttribute('title') || timeEl.innerText || '';
            console.log('[WeiboDebug] Strategy 3 (Generic) Selected Time:', publishTime);
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

      // --- Retweet Detection ---
      // Check for contenttype="original" on the content wrapper or card
      // If contenttype exists and is NOT 'original', it is likely a retweet (or if it has a forward indicator)
      let isRetweet = false;
      const contentNode = card.querySelector('[contenttype]');
      if (contentNode) {
          const type = contentNode.getAttribute('contenttype');
          if (type && type !== 'original') {
              isRetweet = true;
          }
      } else {
          // Fallback for legacy UI or if attribute missing: check for forwarded content container
          if (card.querySelector('.feed_list_forwardContent, .wbpro-feed-repost')) {
              isRetweet = true;
          }
      }

      // Cleanup
      content = content.replace(/收起|展开/g, '').trim();
      if (!author) author = 'Unknown';
      if (!publishTime) publishTime = 'Unknown';

      const post: WeiboPost = {
        id: mid,
        author: author.trim(),
        content: content,
        publishTime: publishTime.trim(),
        link,
        isRetweet
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