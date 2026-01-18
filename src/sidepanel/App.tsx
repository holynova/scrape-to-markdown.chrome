import { useState, useEffect, useMemo } from 'react'
import { FileText, MessagesSquare, Youtube, Copy, Download, Loader2, AlertCircle, Play, Square, ArrowUpDown, Search, Trash2, Image } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WeiboPost } from '@/types'

// --- Tabs Components ---
const Tabs = ({ children }: { children: React.ReactNode }) => {
  return <div className="grid grid-cols-3 gap-2 p-3 border-b bg-muted/20 shrink-0">{children}</div>
}

const TabTrigger = ({ 
  id, 
  active, 
  onClick, 
  children, 
  icon: Icon 
}: { 
  id: string, 
  active: string, 
  onClick: (id: string) => void, 
  children: React.ReactNode, 
  icon?: any 
}) => {
  const isActive = active === id;
  return (
    <button
      onClick={() => onClick(id)}
      className={cn(
        "flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-md transition-all",
        "border hover:bg-muted/60",
        isActive
          ? "border-primary bg-primary/10 text-primary shadow-sm"
          : "border-border text-muted-foreground bg-background"
      )}
    >
      <div className={cn(
        "w-3 h-3 rounded-full border-2 flex items-center justify-center shrink-0",
        isActive ? "border-primary" : "border-muted-foreground/50"
      )}>
        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
      </div>
      {Icon && <Icon className="w-3 h-3 shrink-0" />}
      <span className="truncate">{children}</span>
    </button>
  )
}

// --- Feature Views ---

const GeminiView = () => {
  const [status, setStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error', message?: string, progress?: number }>({ type: 'idle' });

  // Listen for progress updates from background script
  useEffect(() => {
    const listener = (message: any) => {
      console.log('[Sidepanel] Received message:', message);
      if (message.action === 'DOWNLOAD_PROGRESS') {
        setStatus({ 
          type: 'loading', 
          message: message.message,
          progress: message.progress 
        });
      } else if (message.action === 'DOWNLOAD_COMPLETE') {
        setStatus({ type: 'success', message: message.message });
      } else if (message.action === 'DOWNLOAD_ERROR') {
        setStatus({ type: 'error', message: message.message });
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const handleDownload = async () => {
    setStatus({ type: 'loading', message: 'Extracting images...' });
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('[Gemini] Active tab:', tab);
      
      if (!tab.id) throw new Error("No active tab found");
      if (!tab.url) throw new Error("Tab URL is undefined");
      
      // Check if we're on the right page
      if (!tab.url.includes('gemini.google.com')) {
        throw new Error(`Please navigate to gemini.google.com first. Current URL: ${tab.url}`);
      }

      console.log('[Gemini] Sending EXTRACT_GEMINI_IMAGES to tab:', tab.id);
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_GEMINI_IMAGES' });
      console.log('[Gemini] Response:', response);
      
      if (response && response.success) {
        setStatus({ type: 'loading', message: `Found ${response.count} images. Starting download...` });
      } else {
        const errorDetail = response ? JSON.stringify(response) : 'No response from content script';
        setStatus({ type: 'error', message: `Error: ${response?.error || errorDetail}` });
      }
    } catch (err: any) {
      console.error('[Gemini] Error:', err);
      setStatus({ type: 'error', message: `Error: ${err.message || String(err)}` });
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Image className="w-5 h-5 text-primary" />
        Gemini Saver
      </h2>
      
      <div className="p-4 border rounded-lg bg-card text-card-foreground shadow-sm space-y-4">
        <p className="text-sm text-muted-foreground">
          Navigate to your <a href="https://gemini.google.com/mystuff" target="_blank" rel="noreferrer" className="underline text-primary">Gemini/MyStuff</a> page and click below to download all full-resolution images.
        </p>
        
        <button 
          onClick={handleDownload}
          disabled={status.type === 'loading'}
          className="w-full px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {status.type === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {status.type === 'loading' ? 'Processing...' : 'Download All Images'}
        </button>

        {/* Progress bar */}
        {status.type === 'loading' && status.progress !== undefined && (
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300" 
              style={{ width: `${status.progress}%` }} 
            />
          </div>
        )}

        {status.type !== 'idle' && (
          <div className={cn(
            "p-3 rounded-md text-sm flex items-center gap-2",
            status.type === 'loading' && "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
            status.type === 'success' && "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
            status.type === 'error' && "bg-destructive/10 text-destructive",
          )}>
             {status.type === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
             {status.type === 'error' && <AlertCircle className="w-4 h-4" />}
             {status.message}
          </div>
        )}
      </div>
    </div>
  )
}

interface PageImage {
  url: string;
  width: number;
  height: number;
}

const PageImagesView = () => {
  const [status, setStatus] = useState<{ type: 'idle' | 'scanning' | 'loading' | 'success' | 'error', message?: string, progress?: number }>({ type: 'idle' });
  const [images, setImages] = useState<PageImage[]>([]);
  const [minWidth, setMinWidth] = useState(100);
  const [minHeight, setMinHeight] = useState(100);

  // Listen for progress updates from background script
  useEffect(() => {
    const listener = (message: any) => {
      console.log('[PageImages] Received message:', message);
      if (message.action === 'DOWNLOAD_PROGRESS') {
        setStatus({ 
          type: 'loading', 
          message: message.message,
          progress: message.progress 
        });
      } else if (message.action === 'DOWNLOAD_COMPLETE') {
        setStatus({ type: 'success', message: message.message });
      } else if (message.action === 'DOWNLOAD_ERROR') {
        setStatus({ type: 'error', message: message.message });
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  // Filter images by dimensions
  const filteredImages = useMemo(() => {
    return images.filter(img => img.width >= minWidth && img.height >= minHeight);
  }, [images, minWidth, minHeight]);

  const handleScan = async () => {
    setStatus({ type: 'scanning', message: 'Scanning page for images...' });
    setImages([]);
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('[PageImages] Active tab:', tab);
      
      if (!tab.id) throw new Error("No active tab found");
      if (!tab.url) throw new Error("Tab URL is undefined");
      
      // Check if it's a restricted page
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
        throw new Error("Cannot scan browser internal pages");
      }

      console.log('[PageImages] Sending EXTRACT_PAGE_IMAGES to:', tab.url);
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_PAGE_IMAGES' });
      console.log('[PageImages] Response:', response);
      
      if (response && response.success) {
        setImages(response.images);
        setStatus({ type: 'idle', message: `Found ${response.images.length} images` });
      } else {
        setStatus({ type: 'error', message: response?.error || 'No response from page' });
      }
    } catch (err: any) {
      console.error('[PageImages] Error:', err);
      // Provide more helpful error message
      let errorMsg = err.message || 'Failed to scan page';
      if (err.message?.includes('Could not establish connection') || err.message?.includes('Receiving end does not exist')) {
        errorMsg = 'Content script not loaded. Try refreshing the page.';
      }
      setStatus({ type: 'error', message: errorMsg });
    }
  };

  const handleDownload = async () => {
    if (filteredImages.length === 0) return;
    
    setStatus({ type: 'loading', message: `Preparing to download ${filteredImages.length} images...` });
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) throw new Error("No active tab");

      const urls = filteredImages.map(img => img.url);
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'DOWNLOAD_PAGE_IMAGES', urls });
      
      if (response && response.success) {
        setStatus({ type: 'loading', message: `Downloading ${response.count} images...` });
      } else {
        setStatus({ type: 'error', message: response?.error || 'Failed to start download' });
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Failed to download' });
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Image className="w-5 h-5 text-primary" />
        Page Images
      </h2>
      
      <div className="p-4 border rounded-lg bg-card text-card-foreground shadow-sm space-y-4">
        {/* Scan button */}
        <button 
          onClick={handleScan}
          disabled={status.type === 'scanning' || status.type === 'loading'}
          className="w-full px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {status.type === 'scanning' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {status.type === 'scanning' ? 'Scanning...' : 'Scan Page for Images'}
        </button>

        {/* Dimension filters */}
        {images.length > 0 && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Filter by minimum dimensions:
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">Min Width</label>
                <input
                  type="number"
                  value={minWidth}
                  onChange={(e) => setMinWidth(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border rounded text-sm bg-background"
                  min={0}
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">Min Height</label>
                <input
                  type="number"
                  value={minHeight}
                  onChange={(e) => setMinHeight(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border rounded text-sm bg-background"
                  min={0}
                />
              </div>
            </div>
            
            <div className="text-sm">
              <span className="font-medium">{filteredImages.length}</span>
              <span className="text-muted-foreground"> of {images.length} images match filter</span>
            </div>

            {/* Download button */}
            <button 
              onClick={handleDownload}
              disabled={status.type === 'loading' || filteredImages.length === 0}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {status.type === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {status.type === 'loading' ? 'Downloading...' : `Download ${filteredImages.length} Images`}
            </button>
          </div>
        )}

        {/* Progress bar */}
        {status.type === 'loading' && status.progress !== undefined && (
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300" 
              style={{ width: `${status.progress}%` }} 
            />
          </div>
        )}

        {/* Status message */}
        {status.message && (
          <div className={cn(
            "p-3 rounded-md text-sm flex items-center gap-2",
            status.type === 'scanning' && "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
            status.type === 'loading' && "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
            status.type === 'success' && "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
            status.type === 'error' && "bg-destructive/10 text-destructive",
          )}>
            {(status.type === 'scanning' || status.type === 'loading') && <Loader2 className="w-4 h-4 animate-spin" />}
            {status.type === 'error' && <AlertCircle className="w-4 h-4" />}
            {status.message}
          </div>
        )}
      </div>
    </div>
  )
}

const WeiboView = () => {
  const [isScraping, setIsScraping] = useState(false);
  const [limit, setLimit] = useState(0);
  const [posts, setPosts] = useState<WeiboPost[]>([]);
  const [filterKeyword, setFilterKeyword] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [showOriginalOnly, setShowOriginalOnly] = useState(false);
  
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState('0m 0s');

  useEffect(() => {
    let interval: any;
    if (isScraping && startTime) {
      interval = setInterval(() => {
        const now = Date.now();
        const diff = Math.floor((now - startTime) / 1000);
        const m = Math.floor(diff / 60);
        const s = diff % 60;
        setElapsed(`${m}m ${s}s`);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isScraping, startTime]);

  useEffect(() => {
    const listener = (message: any) => {
      if (message.action === 'WEIBO_DATA') {
        setPosts(prev => {
           const newItems = message.data.filter((p: WeiboPost) => !prev.some(existing => existing.id === p.id));
           if (newItems.length === 0) return prev;
           return [...prev, ...newItems];
        });
      }
      if (message.action === 'WEIBO_COMPLETE') {
        setIsScraping(false);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const handleStart = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) return;
      await chrome.tabs.sendMessage(tab.id, { action: 'WEIBO_START', limit });
      setIsScraping(true);
      setStartTime(Date.now());
      setElapsed('0m 0s');
    } catch (e: any) {
      console.error(e);
      alert(`Failed to start: ${e.message || e}. \n\nPlease refresh the Weibo page and try again.`);
    }
  };

  const handleStop = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) return;
      await chrome.tabs.sendMessage(tab.id, { action: 'WEIBO_STOP' });
      setIsScraping(false);
    } catch (e) {
      console.error(e);
    }
  };

  const clearData = () => {
    if (confirm('Clear all scraped data?')) {
      setPosts([]);
      setElapsed('0m 0s');
      setStartTime(null);
    }
  };

  const filteredPosts = useMemo(() => {
    let res = posts.filter(p => p.content && p.content.trim() !== '') // Filter out null/empty content
      .filter(p => {
        const content = p.content;
        // Exclude deleted posts
        if (content.includes('此微博已被作者删除')) return false;
        if (content.includes('该微博因违反《微博社区公约》的相关规定，已被删除')) return false;
        
        return content.toLowerCase().includes(filterKeyword.toLowerCase()) || 
               p.author.toLowerCase().includes(filterKeyword.toLowerCase());
      });
    
    if (showOriginalOnly) {
      res = res.filter(p => !p.isRetweet);
    }

    // Assuming scraped order is roughly 'newest' first (top of page down)
    if (sortOrder === 'oldest') {
      res = [...res].reverse();
    }
    return res;
  }, [posts, filterKeyword, sortOrder, showOriginalOnly]);

  const progress = limit > 0 ? Math.min((posts.length / limit) * 100, 100) : 0;

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(filteredPosts, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weibo_export_${new Date().toISOString()}.json`;
    a.click();
  };

  const exportMarkdown = () => {
    const md = filteredPosts.map(p => `### ${p.author} (${p.publishTime})\n\n${p.content}\n\n[Link](${p.link || '#'})`).join('\n\n---\n\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weibo_export_${new Date().toISOString()}.md`;
    a.click();
  };

  return (
    <div className="flex flex-col h-full bg-muted/10">
       {/* Controls */}
       <div className="p-4 bg-card border-b space-y-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex gap-2">
               {!isScraping ? (
                 <button 
                   onClick={handleStart}
                   className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
                 >
                   <Play className="w-4 h-4" /> Start
                 </button>
               ) : (
                 <button 
                   onClick={handleStop}
                   className="flex-1 flex items-center justify-center gap-2 bg-destructive text-destructive-foreground px-4 py-2 rounded-md hover:bg-destructive/90 transition-colors"
                 >
                   <Square className="w-4 h-4 fill-current" /> Stop
                 </button>
               )}
            </div>
            <div className="flex items-center gap-2 bg-muted rounded-md px-3 py-2 border">
               <span className="text-xs text-muted-foreground whitespace-nowrap">Limit:</span>
               <input 
                 type="number" 
                 value={limit} 
                 onChange={(e) => setLimit(Number(e.target.value))}
                 className="w-16 bg-transparent text-sm text-right focus:outline-none"
               />
            </div>
          </div>
          
          {/* Status Display */}
          <div className="flex justify-between items-center text-xs text-muted-foreground">
             <span>Scraped: <span className="font-medium text-foreground">{filteredPosts.length}</span> / {posts.length}</span>
             <span>Time: <span className="font-mono">{elapsed}</span></span>
          </div>

          {/* Progress */}
          {limit > 0 && (
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
               <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          )}
       </div>

       {/* Toolbar */}
       <div className="px-4 py-2 border-b bg-card/50 flex flex-wrap gap-2 items-center text-sm shrink-0">
          <div className="relative flex-1 min-w-[120px]">
             <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
             <input 
               placeholder="Filter..." 
               value={filterKeyword}
               onChange={(e) => setFilterKeyword(e.target.value)}
               className="w-full pl-8 pr-2 py-1.5 rounded-md border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
             />
          </div>
          
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground select-none">
            <input 
              type="checkbox"
              checked={showOriginalOnly}
              onChange={(e) => setShowOriginalOnly(e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5"
            />
            Original
          </label>

          <div className="h-4 w-px bg-border mx-1"></div>

          <button 
             onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
             className="p-1.5 hover:bg-muted rounded text-muted-foreground"
             title="Sort Order"
          >
             <ArrowUpDown className={cn("w-4 h-4", sortOrder === 'oldest' && "rotate-180")} />
          </button>
          <button 
             onClick={clearData}
             className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-muted-foreground"
             title="Clear Data"
          >
             <Trash2 className="w-4 h-4" />
          </button>
       </div>

       {/* List */}
       <div className="flex-1 overflow-auto p-4 space-y-3">
          {filteredPosts.map(post => (
             <div key={post.id} className="bg-card border rounded-lg p-3 text-sm shadow-sm space-y-2">
                <div className="flex justify-between items-start">
                   <span className="font-semibold text-primary">{post.publishTime}</span>
                </div>
                <p className="text-card-foreground leading-relaxed line-clamp-4 hover:line-clamp-none transition-all">
                   {post.content}
                </p>
             </div>
          ))}
          {posts.length === 0 && (
             <div className="text-center py-10 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                No data. Open a Weibo user page and click Start.
             </div>
          )}
       </div>

       {/* Footer */}
       {posts.length > 0 && (
         <div className="p-3 border-t bg-card shrink-0 grid grid-cols-2 gap-2">
            <button onClick={exportJSON} className="flex items-center justify-center gap-2 px-3 py-2 text-xs border rounded hover:bg-muted transition-colors">
               <Download className="w-3.5 h-3.5" /> JSON
            </button>
            <button onClick={exportMarkdown} className="flex items-center justify-center gap-2 px-3 py-2 text-xs border rounded hover:bg-muted transition-colors">
               <FileText className="w-3.5 h-3.5" /> Markdown
            </button>
         </div>
       )}
    </div>
  )
}

const MarkdownView = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{title: string, markdown: string, excerpt?: string} | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConvert = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) throw new Error("No active tab");

      if (tab.url?.startsWith("chrome://") || tab.url?.startsWith("edge://")) {
        throw new Error("Cannot run on browser system pages.");
      }
      
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'SCRAPE_MARKDOWN' });
      
      if (response && response.success) {
        setResult(response.data);
      } else {
        setError(response?.error || "Unknown error occurred. Ensure page is loaded.");
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to communicate with page. Try reloading the page.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(`# ${result.title}\n\n${result.markdown}`);
    }
  };

  const handleDownload = () => {
    if (result) {
      const blob = new Blob([`# ${result.title}\n\n${result.markdown}`], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${result.title.substring(0, 50).replace(/[^a-z0-9]/gi, '_')}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 space-y-4 shrink-0">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          Page to Markdown
          {loading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
        </h2>
        
        {error && (
           <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2">
             <AlertCircle className="w-4 h-4" />
             {error}
           </div>
        )}

        {!result && (
          <div className="p-4 border rounded-lg bg-card text-card-foreground shadow-sm space-y-3">
              <p className="text-sm text-muted-foreground">
                Convert the current main content to Markdown.
              </p>
              <button 
                onClick={handleConvert}
                disabled={loading}
                className="w-full px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 transition-all"
              >
                {loading ? 'Converting...' : 'Convert Current Page'}
              </button>
          </div>
        )}
      </div>

      {result && (
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 border-t bg-card">
          <div className="p-2 border-b bg-muted/10 flex items-center justify-between shrink-0">
             <div className="font-medium text-sm truncate max-w-[200px]" title={result.title}>
               {result.title}
             </div>
             <div className="flex gap-1">
                <button onClick={handleCopy} className="p-2 hover:bg-muted rounded text-muted-foreground hover:text-foreground" title="Copy">
                  <Copy className="w-4 h-4" />
                </button>
                <button onClick={handleDownload} className="p-2 hover:bg-muted rounded text-muted-foreground hover:text-foreground" title="Download">
                  <Download className="w-4 h-4" />
                </button>
                <button onClick={() => setResult(null)} className="px-3 py-1 text-xs hover:underline text-muted-foreground">
                   Reset
                </button>
             </div>
          </div>
          <div className="flex-1 overflow-auto p-4 text-sm font-mono whitespace-pre-wrap">
            {result.markdown}
          </div>
        </div>
      )}
    </div>
  )
}

const YoutubeView = () => (
  <div className="p-4 space-y-4">
    <h2 className="text-lg font-semibold">YouTube Scraper</h2>
    <div className="p-8 border-2 border-dashed rounded-lg text-center">
      <Youtube className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
      <p className="text-sm text-muted-foreground">Functionality coming soon...</p>
    </div>
  </div>
)

function App() {
  const [activeTab, setActiveTab] = useState('weibo')

  return (
    <div className="w-full h-screen bg-background text-foreground flex flex-col font-sans">
      {/* <header className="px-4 py-3 border-b flex items-center gap-2 bg-card shrink-0">
        <div className="w-6 h-6 bg-primary rounded-md flex items-center justify-center text-primary-foreground font-bold text-xs">
          S
        </div>
        <h1 className="font-bold tracking-tight text-sm">Scrape to Markdown</h1>
      </header> */}
      
      <Tabs>
        <TabTrigger id="weibo" active={activeTab} onClick={setActiveTab} icon={MessagesSquare}>
          Weibo
        </TabTrigger>
        <TabTrigger id="markdown" active={activeTab} onClick={setActiveTab} icon={FileText}>
          Markdown
        </TabTrigger>
        <TabTrigger id="youtube" active={activeTab} onClick={setActiveTab} icon={Youtube}>
          YT
        </TabTrigger>
        <TabTrigger id="gemini" active={activeTab} onClick={setActiveTab} icon={Image}>
          Gemini
        </TabTrigger>
        <TabTrigger id="images" active={activeTab} onClick={setActiveTab} icon={Download}>
          Images
        </TabTrigger>
      </Tabs>

      <main className="flex-1 overflow-hidden flex flex-col bg-muted/10">
        {activeTab === 'weibo' && <WeiboView />}
        {activeTab === 'markdown' && <MarkdownView />}
        {activeTab === 'youtube' && <YoutubeView />}
        {activeTab === 'gemini' && <GeminiView />}
        {activeTab === 'images' && <PageImagesView />}
      </main>
      
      {/* Build version footer */}
      <footer className="px-4 py-1 border-t bg-muted/20 text-xs text-muted-foreground text-center shrink-0">
        Build: {new Date(__BUILD_TIMESTAMP__).toLocaleString()}
      </footer>
    </div>
  )
}

// Declare global constant injected by Vite
declare const __BUILD_TIMESTAMP__: string;

export default App
