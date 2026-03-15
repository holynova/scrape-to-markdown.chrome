import React, { useEffect, useState } from 'react';
import { ArrowRight, Download, FileText, Layers, Github, Star } from 'lucide-react';

export default function Intro() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden selection:bg-cyan-500/30">
      {/* Background Ambience */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/20 blur-[120px] animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-600/20 blur-[120px] animate-pulse-slow delay-1000"></div>
        <div className="absolute top-[40%] left-[60%] w-[20%] h-[20%] rounded-full bg-emerald-500/10 blur-[100px] animate-float"></div>
      </div>

      {/* Content Container */}
      <div className={`relative z-10 max-w-6xl mx-auto px-6 py-12 transition-all duration-1000 transform ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        
        {/* Navigation / Header */}
        <nav className="flex justify-between items-center mb-20 glass px-6 py-4 rounded-full">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-tr from-cyan-400 to-blue-600 rounded-lg shadow-lg shadow-cyan-500/30 flex items-center justify-center text-white font-bold">S</div>
            <span className="font-bold text-xl tracking-tight">Scrape to Markdown</span>
          </div>
          <div className="flex space-x-6 text-sm font-medium text-slate-300">
            <a href="https://github.com/holynova/scrape-to-markdown.chrome" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-2">
              <Github size={18} /> GitHub
            </a>
          </div>
        </nav>

        {/* Hero Section */}
        <header className="text-center mb-24 relative">
          <div className="inline-block mb-6 px-4 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-sm font-semibold tracking-wider uppercase backdrop-blur-md shadow-[0_0_15px_rgba(6,182,212,0.3)] animate-float">
            Version 1.0.0 Now Live
          </div>
          <h1 className="text-6xl md:text-7xl font-bold mb-6 tracking-tight leading-tight bg-clip-text text-transparent bg-gradient-to-wb from-white via-slate-200 to-slate-500 drop-shadow-lg">
            Turn the Web into <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 text-glow">Data.</span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            A powerful browser extension to scrape Weibo, YouTube, and more directly into clean, structured Markdown.
          </p>
          
          <div className="flex justify-center gap-4">
            <button className="group relative px-8 py-3 bg-white text-slate-900 font-bold rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(255,255,255,0.3)]">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-300 to-white opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <span className="relative flex items-center gap-2">
                Get Started <ArrowRight size={18} />
              </span>
            </button>
            <button className="px-8 py-3 glass rounded-full font-semibold hover:bg-white/10 transition-all flex items-center gap-2">
              <Star size={18} className="text-yellow-400" /> Star on GitHub
            </button>
          </div>
        </header>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-24">
          <FeatureCard 
            icon={<Layers className="text-purple-400" size={32} />}
            title="Smart Extraction"
            description="Automatically detects content types like Weibo posts or YouTube playlists and extracts structured data."
            delay="delay-100"
          />
          <FeatureCard 
            icon={<FileText className="text-cyan-400" size={32} />}
            title="Clean Markdown"
            description="Converts messy HTML into pristine Markdown, ready for your notes, LLMs, or documentation."
            delay="delay-200"
          />
          <FeatureCard 
            icon={<Download className="text-emerald-400" size={32} />}
            title="Batch Export"
            description="Export multiple items at once. Download images, JSON data, and Markdown files in one click."
            delay="delay-300"
          />
        </div>

        {/* Footer */}
        <footer className="text-center text-slate-500 text-sm border-t border-white/5 pt-8">
          <p>© {new Date().getFullYear()} Scrape to Markdown. Built for speed and simplicity.</p>
        </footer>

      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description, delay = "" }: { icon: React.ReactNode, title: string, description: string, delay?: string }) {
  return (
    <div className={`glass-card flex flex-col items-start ${delay}`}>
      <div className="p-3 rounded-xl bg-white/5 mb-4 border border-white/5 shadow-inner">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3 text-slate-100">{title}</h3>
      <p className="text-slate-400 leading-relaxed text-sm">
        {description}
      </p>
    </div>
  );
}
