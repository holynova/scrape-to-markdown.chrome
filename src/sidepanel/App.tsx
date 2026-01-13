import { useState, useEffect, useMemo } from 'react'
import { FileText, MessagesSquare, Youtube, Copy, Download, Loader2, AlertCircle, Play, Square, ArrowUpDown, Search, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WeiboPost } from '@/types'

// --- Tabs Components ---
const Tabs = ({ children }: { children: React.ReactNode }) => {
  return <div className="flex border-b bg-muted/20 shrink-0">{children}</div>
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
  return (
    <button
      onClick={() => onClick(id)}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors hover:text-primary hover:bg-muted/40",
        active === id
          ? "border-b-2 border-primary text-primary bg-background"
          : "text-muted-foreground border-b-2 border-transparent"
      )}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  )
}

// --- Feature Views ---

const WeiboView = () => {
  const [isScraping, setIsScraping] = useState(false);
  const [limit, setLimit] = useState(0);
  const [posts, setPosts] = useState<WeiboPost[]>([]);
  const [filterKeyword, setFilterKeyword] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

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
    } catch (e) {
      console.error(e);
      alert('Failed to start. Ensure you are on a Weibo page and refresh it.');
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
    }
  };

  const filteredPosts = useMemo(() => {
    let res = posts.filter(p => 
      p.content.toLowerCase().includes(filterKeyword.toLowerCase()) || 
      p.author.toLowerCase().includes(filterKeyword.toLowerCase())
    );
    
    // Assuming scraped order is roughly 'newest' first (top of page down)
    if (sortOrder === 'oldest') {
      res = [...res].reverse();
    }
    return res;
  }, [posts, filterKeyword, sortOrder]);

  const progress = limit > 0 ? Math.min((posts.length / limit) * 100, 100) : 0;

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(posts, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weibo_export_${new Date().toISOString()}.json`;
    a.click();
  };

  const exportMarkdown = () => {
    const md = posts.map(p => `### ${p.author} (${p.publishTime})\n\n${p.content}\n\n[Link](${p.link || '#'})`).join('\n\n---\n\n');
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

          {/* Progress */}
          {limit > 0 && (
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
               <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          )}
       </div>

       {/* Toolbar */}
       <div className="px-4 py-2 border-b bg-card/50 flex gap-2 items-center text-sm shrink-0">
          <div className="relative flex-1">
             <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
             <input 
               placeholder="Filter..." 
               value={filterKeyword}
               onChange={(e) => setFilterKeyword(e.target.value)}
               className="w-full pl-8 pr-2 py-1.5 rounded-md border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
             />
          </div>
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
          <div className="text-xs text-muted-foreground text-center mb-2">
             {filteredPosts.length} items {isScraping && '(Scraping...)'}
          </div>
          {filteredPosts.map(post => (
             <div key={post.id} className="bg-card border rounded-lg p-3 text-sm shadow-sm space-y-2">
                <div className="flex justify-between items-start">
                   <span className="font-semibold text-primary">{post.author}</span>
                   <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{post.publishTime}</span>
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
      </Tabs>

      <main className="flex-1 overflow-hidden flex flex-col bg-muted/10">
        {activeTab === 'weibo' && <WeiboView />}
        {activeTab === 'markdown' && <MarkdownView />}
        {activeTab === 'youtube' && <YoutubeView />}
      </main>
    </div>
  )
}

export default App