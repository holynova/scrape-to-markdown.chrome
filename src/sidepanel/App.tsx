import React, { useState, useEffect, useMemo } from 'react'
import { FileText, MessagesSquare, Youtube, Copy, Download, Loader2, AlertCircle, Play, Square, ArrowUpDown, Search, Trash2, Image, Book, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WeiboPost, DoubanItem } from '@/types'

export interface DoubanTask {
  id: string;
  name: string;
  url: string;
  status: 'idle' | 'running' | 'done';
  type: 'book' | 'movie';
  subStatus: 'wish' | 'collect';
}

// --- Tabs Components ---
const Tabs = ({ children }: { children: React.ReactNode }) => {
  return <div className="grid grid-cols-2 gap-2 p-3 border-b bg-muted/20 shrink-0">{children}</div>
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

const formatBuildTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  const formatter = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  });

  return formatter.format(date);
}

// --- Feature Views ---

const AiImagesView = () => {
  const [status, setStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error', message?: string, progress?: number }>({ type: 'idle' });
  const [logs, setLogs] = useState<{ time: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }[]>([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const [activeSource, setActiveSource] = useState<'gemini' | 'chatgpt' | null>(null);
  const [selectedSource, setSelectedSource] = useState<'gemini' | 'chatgpt'>('gemini');
  const [maxImages, setMaxImages] = useState('');
  const [task, setTask] = useState<{
    source: 'gemini' | 'chatgpt';
    limit?: number;
    found?: number;
    downloaded?: number;
    total?: number;
    state: 'idle' | 'extracting' | 'downloading' | 'complete' | 'error';
  }>({ source: 'gemini', state: 'idle' });

  const sourceConfig = {
    gemini: {
      label: 'Gemini',
      pageLabel: 'Gemini MyStuff',
      pageUrl: 'https://gemini.google.com/mystuff',
      action: 'EXTRACT_GEMINI_IMAGES',
      host: 'gemini.google.com',
    },
    chatgpt: {
      label: 'ChatGPT',
      pageLabel: 'ChatGPT Images',
      pageUrl: 'https://chatgpt.com/images',
      action: 'EXTRACT_CHATGPT_IMAGES',
      host: 'chatgpt.com',
    },
  };

  const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString([], { hour12: false });
    setLogs(current => [...current.slice(-99), { time, message, type }]);
  };

  // Listen for progress updates from background script
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;

    const listener = (message: any) => {
      console.log('[Sidepanel] Received message:', message);
      if (!activeSource) return;

      if (message.action === 'DOWNLOAD_PROGRESS') {
        const progressText = typeof message.message === 'string' ? message.message : '';
        const downloadMatch = progressText.match(/Downloading images: (\d+)\/(\d+)/);
        setStatus({
          type: 'loading',
          message: message.message,
          progress: message.progress
        });
        if (downloadMatch) {
          setTask(current => ({
            ...current,
            state: 'downloading',
            downloaded: Number(downloadMatch[1]),
            total: Number(downloadMatch[2]),
          }));
        }
        addLog(`${message.progress ?? '-'}% - ${message.message}`);
      } else if (message.action === 'DOWNLOAD_COMPLETE') {
        setStatus({ type: 'success', message: message.message });
        setTask(current => ({ ...current, state: 'complete' }));
        addLog(message.message, 'success');
        setActiveSource(null);
      } else if (message.action === 'DOWNLOAD_ERROR') {
        setStatus({ type: 'error', message: message.message });
        setTask(current => ({ ...current, state: 'error' }));
        addLog(message.message, 'error');
        setActiveSource(null);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [activeSource]);

  const handleDownload = async () => {
    const source = selectedSource;
    const config = sourceConfig[source];
    const sourceName = config.label;
    setLogs([]);
    setLogsOpen(true);
    setActiveSource(source);
    setTask({ source, state: 'extracting' });
    addLog(`Starting ${sourceName} image download`);
    setStatus({ type: 'loading', message: 'Extracting images...' });
    try {
      const imageLimit = maxImages.trim() ? Number(maxImages) : undefined;
      if (imageLimit !== undefined && (!Number.isFinite(imageLimit) || imageLimit <= 0)) {
        throw new Error('Max images must be a positive number.');
      }

      setTask({ source, limit: imageLimit ? Math.floor(imageLimit) : undefined, state: 'extracting' });
      addLog(imageLimit ? `Max images: ${Math.floor(imageLimit)}` : 'Max images: unlimited');
      addLog('Reading active browser tab');
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('[AI Images] Active tab:', tab);
      
      if (!tab.id) throw new Error("No active tab found");
      if (!tab.url) throw new Error("Tab URL is undefined");
      addLog(`Active page: ${tab.url}`);
      
      if (!tab.url.includes(config.host)) {
        throw new Error(`Please navigate to ${config.pageUrl} first. Current URL: ${tab.url}`);
      }

      addLog(`Requesting original image URLs from ${sourceName}`);
      console.log(`[AI Images] Sending ${config.action} to tab:`, tab.id);
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: config.action,
        maxImages: imageLimit ? Math.floor(imageLimit) : undefined
      });
      console.log('[AI Images] Response:', response);
      
      if (response && response.success) {
        addLog(`Found ${response.count} image URLs. Starting ZIP download.`);
        setTask(current => ({ ...current, found: response.count, total: response.count, state: 'downloading' }));
        setStatus({ type: 'loading', message: `Found ${response.count} images. Starting download...` });
      } else {
        const errorDetail = response ? JSON.stringify(response) : 'No response from content script';
        addLog(`Image extraction failed: ${response?.error || errorDetail}`, 'error');
        setActiveSource(null);
        setTask(current => ({ ...current, state: 'error' }));
        setStatus({ type: 'error', message: `Error: ${response?.error || errorDetail}` });
      }
    } catch (err: any) {
      console.error('[AI Images] Error:', err);
      addLog(`Error: ${err.message || String(err)}`, 'error');
      setActiveSource(null);
      setTask(current => ({ ...current, state: 'error' }));
      setStatus({ type: 'error', message: `Error: ${err.message || String(err)}` });
    }
  };

  const selectedConfig = sourceConfig[selectedSource];
  const taskSourceLabel = sourceConfig[task.source].label;
  const taskLimit = task.limit ? `${task.limit}` : 'All';
  const taskProgress = task.downloaded !== undefined && task.total ? `${task.downloaded} of ${task.total}` : task.found ? `${task.found} found` : 'Waiting';
  const taskStateLabel = {
    idle: 'Idle',
    extracting: 'Extracting',
    downloading: 'Downloading',
    complete: 'Complete',
    error: 'Error',
  }[task.state];

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Image className="w-5 h-5 text-primary" />
        AI Image Saver
      </h2>

      <div className="p-4 border rounded-lg bg-card text-card-foreground shadow-sm space-y-4">
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Source</div>
          <div className="grid grid-cols-2 gap-1 rounded-md border bg-muted/30 p-1">
            {(['gemini', 'chatgpt'] as const).map(source => (
              <button
                key={source}
                type="button"
                onClick={() => {
                  setSelectedSource(source);
                  setTask(current => current.state === 'idle' ? { source, state: 'idle' } : current);
                }}
                disabled={status.type === 'loading'}
                className={cn(
                  "px-3 py-2 text-xs font-medium rounded transition-colors",
                  selectedSource === source
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {sourceConfig[source].label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Page</span>
          <a href={selectedConfig.pageUrl} target="_blank" rel="noreferrer" className="font-medium text-primary underline">
            {selectedConfig.pageLabel}
          </a>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="ai-max-images">
            Limit
          </label>
          <input
            id="ai-max-images"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={maxImages}
            onChange={(event) => setMaxImages(event.target.value)}
            placeholder="All"
            disabled={status.type === 'loading'}
            className="w-full px-3 py-2 border rounded text-sm bg-background disabled:opacity-50"
          />
        </div>

        <button
          onClick={handleDownload}
          disabled={status.type === 'loading'}
          className="w-full px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {status.type === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {status.type === 'loading' ? 'Processing...' : `Download ${selectedConfig.label} Images`}
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

        {task.state !== 'idle' && (
          <div className="grid grid-cols-2 gap-2 rounded-md border bg-background p-3 text-xs">
            <div>
              <div className="text-muted-foreground">Source</div>
              <div className="font-medium">{taskSourceLabel}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Limit</div>
              <div className="font-medium">{taskLimit}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Status</div>
              <div className="font-medium">{taskStateLabel}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Progress</div>
              <div className="font-medium">{taskProgress}</div>
            </div>
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

        <div className="border rounded-md overflow-hidden bg-background">
          <button
            type="button"
            onClick={() => setLogsOpen(open => !open)}
            className="w-full px-3 py-2 text-xs font-medium flex items-center justify-between hover:bg-muted/60 transition-colors"
          >
            <span className="flex items-center gap-2">
              {logsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              Logs
            </span>
            <span className="text-muted-foreground">{logs.length} entries</span>
          </button>

          {logsOpen && (
            <div className="max-h-48 overflow-auto border-t bg-[#111827] text-xs font-mono p-2 space-y-1">
              {logs.length === 0 ? (
                <div className="text-gray-400">No logs yet.</div>
              ) : logs.map((log, index) => (
                <div
                  key={`${log.time}-${index}`}
                  className={cn(
                    "flex gap-2 leading-relaxed",
                    log.type === 'success' && "text-green-300",
                    log.type === 'warning' && "text-yellow-300",
                    log.type === 'error' && "text-red-300",
                    log.type === 'info' && "text-gray-200",
                  )}
                >
                  <span className="text-gray-500 shrink-0">[{log.time}]</span>
                  <span className="break-words">{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
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
    if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;

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
  const [hideEmptyContent, setHideEmptyContent] = useState(true);
  const [hideImagesOnly, setHideImagesOnly] = useState(false);
  const [hideVideosOnly, setHideVideosOnly] = useState(false);

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
    let res = [...posts];
    
    if (hideEmptyContent) {
      res = res.filter(p => p.content && p.content.trim() !== '');
    }

    res = res.filter(p => {
        const content = p.content || '';
        // Exclude deleted posts
        if (content.includes('此微博已被作者删除')) return false;
        if (content.includes('该微博因违反《微博社区公约》的相关规定，已被删除')) return false;

        return content.toLowerCase().includes(filterKeyword.toLowerCase()) ||
          p.author.toLowerCase().includes(filterKeyword.toLowerCase());
      });

    if (showOriginalOnly) {
      res = res.filter(p => !p.isRetweet);
    }

    if (hideImagesOnly) {
      // Filter out posts that have images but almost no text
      res = res.filter(p => !(p.hasImages && (!p.content || p.content.trim().length < 2 || p.content === '分享图片')));
    }

    if (hideVideosOnly) {
      // Filter out posts that have videos but almost no text
      res = res.filter(p => !(p.hasVideos && (!p.content || p.content.trim().length < 2)));
    }

    if (sortOrder === 'oldest') {
      res = [...res].reverse();
    }
    return res;
  }, [posts, filterKeyword, sortOrder, showOriginalOnly, hideEmptyContent, hideImagesOnly, hideVideosOnly]);

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

        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground select-none">
          <input
            type="checkbox"
            checked={hideEmptyContent}
            onChange={(e) => setHideEmptyContent(e.target.checked)}
            className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5"
          />
          No Empty
        </label>

        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground select-none">
          <input
            type="checkbox"
            checked={hideImagesOnly}
            onChange={(e) => setHideImagesOnly(e.target.checked)}
            className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5"
          />
          No Img-Only
        </label>

        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground select-none">
          <input
            type="checkbox"
            checked={hideVideosOnly}
            onChange={(e) => setHideVideosOnly(e.target.checked)}
            className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5"
          />
          No Vid-Only
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

const DoubanView = () => {
  const [username, setUsername] = useState('renjiananhuo');
  const [isScraping, setIsScraping] = useState(false);
  const [limit, setLimit] = useState(0);
  const [items, setItems] = useState<DoubanItem[]>([]);
  const [filterKeyword, setFilterKeyword] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'book-wish' | 'book-collect' | 'movie-wish' | 'movie-collect'>('book-collect');

  // Sequential task state
  const [tasks, setTasks] = useState<DoubanTask[]>([
    { id: 'book-wish', name: 'Book Wish', url: 'https://book.douban.com/people/{user}/wish', status: 'idle', type: 'book', subStatus: 'wish' },
    { id: 'book-collect', name: 'Book Read', url: 'https://book.douban.com/people/{user}/collect', status: 'idle', type: 'book', subStatus: 'collect' },
    { id: 'movie-wish', name: 'Movie Wish', url: 'https://movie.douban.com/people/{user}/wish', status: 'idle', type: 'movie', subStatus: 'wish' },
    { id: 'movie-collect', name: 'Movie Watched', url: 'https://movie.douban.com/people/{user}/collect', status: 'idle', type: 'movie', subStatus: 'collect' }
  ]);
  const [isSequential, setIsSequential] = useState(false);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(-1);

  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState('0m 0s');

  const [logs, setLogs] = useState<{ time: string, msg: string }[]>([]);
  const logsEndRef = React.useRef<HTMLDivElement>(null);
  const stopRequestedRef = React.useRef(false);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

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

  // Read stored state on mount
  useEffect(() => {
    chrome.storage.local.get([
      'isScrapingDouban',
      'doubanStartTime',
      'doubanTasks',
      'doubanSequential',
      'doubanCurrentTaskIndex',
      'doubanUsername'
    ]).then(data => {
      if (data.isScrapingDouban) {
        setIsScraping(true);
        setStartTime((data.doubanStartTime as number) || Date.now());
        if (data.doubanTasks) setTasks(data.doubanTasks as any[]);
        if (data.doubanSequential) setIsSequential(true);
        if (data.doubanCurrentTaskIndex !== undefined) setCurrentTaskIndex(data.doubanCurrentTaskIndex as number);
        if (data.doubanUsername) setUsername(data.doubanUsername as string);
      }
    });

    const listener = (message: any) => {
      if (message.action === 'DOUBAN_DATA') {
        setItems(prev => {
          const newItems = message.data.filter((p: DoubanItem) => !prev.some(existing => existing.id === p.id));
          if (newItems.length === 0) return prev;
          return [...prev, ...newItems];
        });
      }
      if (message.action === 'DOUBAN_COMPLETE') {
        handleTaskComplete();
      }
      if (message.action === 'DOUBAN_LOG') {
        const time = new Date().toLocaleTimeString([], { hour12: false });
        setLogs(prev => [...prev.slice(-99), { time, msg: message.msg }]);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Using a ref to access latest state inside listeners/handlers without dependency cycles
  const stateRef = React.useRef({ isSequential, currentTaskIndex, tasks, username, limit });
  useEffect(() => {
    stateRef.current = { isSequential, currentTaskIndex, tasks, username, limit };
  }, [isSequential, currentTaskIndex, tasks, username, limit]);

  const handleTaskComplete = async () => {
    if (stopRequestedRef.current) return;

    const { isSequential, currentTaskIndex, tasks, username, limit } = stateRef.current;

    if (isSequential && currentTaskIndex >= 0 && currentTaskIndex < tasks.length) {
      // Mark current as done
      const updatedTasks = [...tasks];
      updatedTasks[currentTaskIndex].status = 'done';
      setTasks(updatedTasks);
      chrome.storage.local.set({ doubanTasks: updatedTasks });

      const nextIndex = currentTaskIndex + 1;
      if (nextIndex < tasks.length) {
        // Move to next
        setCurrentTaskIndex(nextIndex);
        chrome.storage.local.set({ doubanCurrentTaskIndex: nextIndex });

        // Start next task
        updatedTasks[nextIndex].status = 'running';
        setTasks(updatedTasks);
        chrome.storage.local.set({ doubanTasks: updatedTasks });

        setActiveSubTab(updatedTasks[nextIndex].id as any);
        startSpecificTask(updatedTasks[nextIndex].url.replace('{user}', username), limit);
      } else {
        // All done
        finishScraping();
      }
    } else {
      // Single task mode finish
      if (currentTaskIndex >= 0) {
        const updatedTasks = [...tasks];
        updatedTasks[currentTaskIndex].status = 'done';
        setTasks(updatedTasks);
      }
      finishScraping();
    }
  };

  const finishScraping = () => {
    setIsScraping(false);
    setIsSequential(false);
    setCurrentTaskIndex(-1);
    chrome.storage.local.set({
      isScrapingDouban: false,
      doubanSequential: false,
      doubanCurrentTaskIndex: -1
    });
    chrome.storage.local.remove(['doubanStartTime', 'doubanTasks', 'doubanScrapedCount']);
  };

  const startSpecificTask = async (targetUrl: string, limitVal: number) => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) return;

      await chrome.storage.local.set({
        isScrapingDouban: true,
        doubanLimit: Math.max(0, Math.floor(limitVal || 0)),
        doubanScrapedCount: 0
      });

      // The content script reads storage on page load, so write state before navigation.
      await chrome.tabs.update(tab.id, { url: targetUrl });

    } catch (e: any) {
      console.error('Navigation failed', e);
      finishScraping();
    }
  };

  const handleStartCurrent = async () => {
    if (!username) return alert('Please enter a username');
    stopRequestedRef.current = false;

    // Find index of active tab
    const idx = tasks.findIndex(t => t.id === activeSubTab);
    const task = tasks[idx];

    const updatedTasks = tasks.map((t): DoubanTask => ({ ...t, status: 'idle' }));
    updatedTasks[idx].status = 'running';
    setTasks(updatedTasks);
    setCurrentTaskIndex(idx);
    setIsSequential(false);

    setIsScraping(true);
    const now = Date.now();
    setStartTime(now);
    setElapsed('0m 0s');

    chrome.storage.local.set({
      doubanStartTime: now,
      doubanTasks: updatedTasks,
      doubanSequential: false,
      doubanCurrentTaskIndex: idx,
      doubanUsername: username
    });

    const url = task.url.replace('{user}', username);
    await startSpecificTask(url, limit);
  };

  const handleStartAll = async () => {
    if (!username) return alert('Please enter a username');
    stopRequestedRef.current = false;

    const updatedTasks = tasks.map((t, i) => ({ ...t, status: i === 0 ? 'running' as const : 'idle' as const }));
    setTasks(updatedTasks);
    setCurrentTaskIndex(0);
    setIsSequential(true);
    setActiveSubTab(tasks[0].id as any);

    setIsScraping(true);
    const now = Date.now();
    setStartTime(now);
    setElapsed('0m 0s');

    chrome.storage.local.set({
      doubanStartTime: now,
      doubanTasks: updatedTasks,
      doubanSequential: true,
      doubanCurrentTaskIndex: 0,
      doubanUsername: username
    });

    const url = updatedTasks[0].url.replace('{user}', username);
    await startSpecificTask(url, limit);
  };

  const handleStop = async () => {
    stopRequestedRef.current = true;
    await chrome.storage.local.set({
      isScrapingDouban: false,
      doubanSequential: false,
      doubanCurrentTaskIndex: -1
    });
    await chrome.storage.local.remove(['doubanScrapedCount']);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, { action: 'DOUBAN_STOP' });
      }
    } catch (e) {
      // Ignore
    } finally {
      const updatedTasks = [...tasks];
      if (currentTaskIndex >= 0 && updatedTasks[currentTaskIndex]) {
        updatedTasks[currentTaskIndex].status = 'idle';
        setTasks(updatedTasks);
      }
      finishScraping();
    }
  };

  const clearData = () => {
    if (confirm('Clear all scraped data?')) {
      setItems([]);
      setElapsed('0m 0s');
      setStartTime(null);
      setLogs([]);
      setTasks(tasks.map(t => ({ ...t, status: 'idle' as const })));
    }
  };

  const currentTabTask = tasks.find(t => t.id === activeSubTab)!;

  const filteredItems = useMemo(() => {
    return items
      .filter(b => b.type === currentTabTask.type && b.status === currentTabTask.subStatus)
      .filter(b =>
        b.title.toLowerCase().includes(filterKeyword.toLowerCase()) ||
        b.comment.toLowerCase().includes(filterKeyword.toLowerCase())
      );
  }, [items, filterKeyword, currentTabTask]);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(filteredItems, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `douban_${activeSubTab}_${new Date().toISOString()}.json`;
    a.click();
  };

  const exportMarkdown = () => {
    const md = filteredItems.map(b => `### [${b.title}](${b.link || '#'})\n\n**Rating**: ${b.rating} | **Date**: ${b.readDate}\n\n${b.comment}`).join('\n\n---\n\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `douban_${activeSubTab}_${new Date().toISOString()}.md`;
    a.click();
  };

  return (
    <div className="flex flex-col h-full bg-muted/10">
      <div className="p-4 bg-card border-b space-y-3 shrink-0">

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              placeholder="Douban Username (e.g. renjiananhuo)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isScraping}
              className="w-full px-3 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
          </div>
          <div className="flex items-center gap-2 bg-muted rounded-md px-3 py-1.5 border shrink-0">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Limit:</span>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              disabled={isScraping}
              className="w-12 bg-transparent text-sm text-right focus:outline-none disabled:opacity-50"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isScraping ? (
            <>
              <button
                onClick={handleStartCurrent}
                className="flex-1 flex items-center justify-center gap-2 bg-secondary text-secondary-foreground px-3 py-2 text-sm rounded-md hover:bg-secondary/80 transition-colors"
              >
                <Play className="w-3.5 h-3.5" /> Start Current
              </button>
              <button
                onClick={handleStartAll}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground px-3 py-2 text-sm rounded-md hover:bg-primary/90 transition-colors"
              >
                <Play className="w-3.5 h-3.5" /> Start All
              </button>
            </>
          ) : (
            <button
              onClick={handleStop}
              className="w-full flex items-center justify-center gap-2 bg-destructive text-destructive-foreground px-4 py-2 text-sm rounded-md hover:bg-destructive/90 transition-colors"
            >
              <Square className="w-4 h-4 fill-current" /> Stop {isSequential ? 'Sequential' : ''} Scraping
            </button>
          )}
        </div>

        {/* Status Display */}
        <div className="flex justify-between items-center text-xs pt-1 border-t">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-primary font-medium">
              {currentTabTask.name}: <span className="font-bold">{filteredItems.length}</span>
            </span>
            <span className="flex items-center gap-1 text-muted-foreground border-l pl-3">
              Total Scraped: <span>{items.length}</span>
            </span>
          </div>
          <span className="text-muted-foreground">Time: <span className="font-mono">{elapsed}</span></span>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex border-b bg-card text-xs shrink-0 overflow-x-auto">
        {tasks.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveSubTab(t.id as any)}
            className={cn(
              "flex-1 py-2 px-1 text-center border-b-2 whitespace-nowrap transition-colors flex items-center justify-center gap-1.5",
              activeSubTab === t.id ? "border-primary text-primary font-medium bg-primary/5" : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            {t.name}
            {t.status === 'running' && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
            {t.status === 'done' && <div className="w-1.5 h-1.5 rounded-full bg-green-500" title="Completed" />}
          </button>
        ))}
      </div>

      <div className="px-4 py-2 border-b bg-card/50 flex flex-wrap gap-2 items-center text-sm shrink-0">
        <div className="relative flex-1 min-w-[120px]">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder={`Filter ${currentTabTask.name}...`}
            value={filterKeyword}
            onChange={(e) => setFilterKeyword(e.target.value)}
            className="w-full pl-8 pr-2 py-1.5 rounded-md border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          onClick={clearData}
          className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-muted-foreground"
          title="Clear Data"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {filteredItems.map(item => (
          <div key={item.id} className="bg-card border rounded-lg p-3 text-sm shadow-sm space-y-2 relative">
            <div className="absolute right-3 top-3 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {item.type === 'book' ? 'Book' : 'Movie'}
            </div>
            <div className="flex justify-between items-start pr-12">
              <a href={item.link} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline leading-tight">{item.title}</a>
            </div>
            <div className="flex items-center gap-3">
              {item.rating && <div className="text-xs font-medium text-amber-500">{item.rating}</div>}
              <span className="text-xs text-muted-foreground">{item.readDate}</span>
            </div>
            {item.comment && <p className="text-card-foreground leading-relaxed italic border-l-2 pl-2 border-muted-foreground/30 mt-2">
              "{item.comment}"
            </p>}
          </div>
        ))}
        {items.filter(b => b.type === currentTabTask.type && b.status === currentTabTask.subStatus).length === 0 && (
          <div className="text-center py-10 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
            No data for {currentTabTask.name}. <br />
            {!isScraping && <span className="text-xs mt-2 block">Enter a username and start scraping to populate.</span>}
            {isScraping && currentTabTask.status === 'running' && <span className="text-xs mt-2 block flex items-center justify-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Scraping...</span>}
          </div>
        )}
      </div>

      {filteredItems.length > 0 && (
        <div className="p-3 border-t bg-card shrink-0 grid grid-cols-2 gap-2">
          <button onClick={exportJSON} className="flex items-center justify-center gap-2 px-3 py-2 text-xs border rounded hover:bg-muted transition-colors">
            <Download className="w-3.5 h-3.5" /> JSON ({filteredItems.length})
          </button>
          <button onClick={exportMarkdown} className="flex items-center justify-center gap-2 px-3 py-2 text-xs border rounded hover:bg-muted transition-colors">
            <FileText className="w-3.5 h-3.5" /> Markdown ({filteredItems.length})
          </button>
        </div>
      )}

      {/* Scrolling Logs Panel */}
      <div className="h-32 bg-[#1e1e1e] text-green-400 font-mono text-[10px] p-2 overflow-y-auto shrink-0 border-t flex flex-col gap-1 items-start leading-tight">
        {logs.length === 0 && <span className="text-muted-foreground italic">System Idle. Logs will appear here during scraping...</span>}
        {logs.map((log, i) => (
          <div key={i} className="flex gap-2 w-full">
            <span className="text-gray-500 shrink-0">[{log.time}]</span>
            <span className="break-words">{log.msg}</span>
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  )
}

const MarkdownView = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ title: string, markdown: string, excerpt?: string } | null>(null);
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

const getInitialTabFromUrl = (url?: string) => {
  if (!url) return 'images';
  try {
    const hostname = new URL(url).hostname;
    if (hostname.includes('weibo.com')) return 'weibo';
    if (hostname.includes('douban.com')) return 'douban';
    if (hostname.includes('gemini.google.com') || hostname.includes('chatgpt.com')) return 'gemini';
  } catch {
    return 'images';
  }
  return 'images';
}

function App() {
  const [activeTab, setActiveTab] = useState('images')

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.tabs?.query) {
      setActiveTab('images');
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true })
      .then(([tab]) => setActiveTab(getInitialTabFromUrl(tab?.url)))
      .catch(() => setActiveTab('images'));
  }, []);

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
        <TabTrigger id="douban" active={activeTab} onClick={setActiveTab} icon={Book}>
          Douban
        </TabTrigger>
        <TabTrigger id="markdown" active={activeTab} onClick={setActiveTab} icon={FileText}>
          Markdown
        </TabTrigger>
        <TabTrigger id="gemini" active={activeTab} onClick={setActiveTab} icon={Image}>
          AI Images
        </TabTrigger>
        <TabTrigger id="images" active={activeTab} onClick={setActiveTab} icon={Download}>
          Images
        </TabTrigger>
      </Tabs>

      <main className="flex-1 overflow-hidden flex flex-col bg-muted/10">
        {activeTab === 'weibo' && <WeiboView />}
        {activeTab === 'douban' && <DoubanView />}
        {activeTab === 'markdown' && <MarkdownView />}
        {activeTab === 'youtube' && <YoutubeView />}
        {activeTab === 'gemini' && <AiImagesView />}
        {activeTab === 'images' && <PageImagesView />}
      </main>

      {/* Build version footer */}
      <footer
        className="px-4 py-1 border-t bg-muted/20 text-xs text-muted-foreground text-center shrink-0"
        title={`Build timestamp: ${__BUILD_TIMESTAMP__}`}
      >
        构建时间: {formatBuildTimestamp(__BUILD_TIMESTAMP__)}
      </footer>
    </div>
  )
}

// Declare global constant injected by Vite
declare const __BUILD_TIMESTAMP__: string;

export default App
