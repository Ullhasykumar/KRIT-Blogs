import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  X, 
  ArrowLeft, 
  ArrowUp,
  Clock, 
  Github, 
  Mail, 
  Sun, 
  Moon, 
  Hash, 
  BookOpen, 
  Tag, 
  Terminal, 
  FileText,
  Bookmark,
  Link,
  Check,
  Facebook,
  Send,
  Linkedin,
  Archive,
  Home
} from 'lucide-react';
import { BlogPost, TableOfContentsItem } from './types';
import MarkdownRender from './components/MarkdownRender';

// Typewriter taglines for a handcrafted feel
const TYPING_TAGLINES = [
  "computer science student.",
  "machine learning researcher.",
  "minimalist system developer."
];

function formatArchiveDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, 'x'); // Wait, we can pad with nothing or use normal day digit
    // Let's use clean layout
    const dayStr = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    return `${dayStr} ${month}`;
  } catch (e) {
    return dateStr;
  }
}

function formatTagDetailDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  } catch (e) {
    return dateStr;
  }
}

function getYearFromDate(dateStr: string): string {
  try {
    return String(new Date(dateStr).getFullYear());
  } catch (e) {
    return 'Undated';
  }
}

export default function App() {
  // --- STATE ---
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [selectedPostSlug, setSelectedPostSlug] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('All');
  const [selectedTagDetail, setSelectedTagDetail] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  
  // Typewriter effect state
  const [taglineIdx, setTaglineIdx] = useState(0);
  const [currentText, setCurrentText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Table of Contents state
  const [activeTocId, setActiveTocId] = useState<string>('');
  
  // Subscription state
  const [emailValue, setEmailValue] = useState('');
  const [subStatus, setSubStatus] = useState<'idle' | 'success'>('idle');

  // --- RECENTLY VIEWED & BOOKMARKS PERSISTED STATES ---
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>([]);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [showBookmarksOnly, setShowBookmarksOnly] = useState<boolean>(false);
  const [currentNav, setCurrentNav] = useState<'feed' | 'archives' | 'tags'>('feed');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const rawRecent = localStorage.getItem('recently_viewed');
      if (rawRecent) {
        setRecentlyViewed(JSON.parse(rawRecent));
      }
    } catch (e) {
      console.warn("Failed to load recently viewed list", e);
    }

    try {
      const rawBookmarks = localStorage.getItem('bookmarked_posts');
      if (rawBookmarks) {
        setBookmarks(JSON.parse(rawBookmarks));
      }
    } catch (e) {
      console.warn("Failed to load bookmarks list", e);
    }
  }, []);

  // Update recently viewed whenever a blog post is selected
  useEffect(() => {
    if (selectedPostSlug) {
      setRecentlyViewed((prev) => {
        const filtered = prev.filter((slug) => slug !== selectedPostSlug);
        const nextRecent = [selectedPostSlug, ...filtered].slice(0, 3);
        localStorage.setItem('recently_viewed', JSON.stringify(nextRecent));
        return nextRecent;
      });
    }
  }, [selectedPostSlug]);

  // Toggle bookmark function
  const toggleBookmark = (slug: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation(); // Avoid triggering container navigation callbacks
    }
    setBookmarks((prev) => {
      const isBookmarked = prev.includes(slug);
      const nextBookmarks = isBookmarked
        ? prev.filter((s) => s !== slug)
        : [...prev, slug];
      localStorage.setItem('bookmarked_posts', JSON.stringify(nextBookmarks));
      return nextBookmarks;
    });
  };

  // Copy Link function
  const handleCopyLink = async (slug: string) => {
    try {
      const baseUrl = window.location.href.split('#')[0];
      const shareUrl = `${baseUrl}#${slug}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error) {
      console.error('Failed to copy link', error);
    }
  };

  // --- DYNAMIC MARKDOWN INGESTION ---
  useEffect(() => {
    // Ingest all markdown files under /src/content using Vite's eager import
    const markdownModules = (import.meta as any).glob('/src/content/*.md', { query: '?raw', eager: true });
    
    const parsed: BlogPost[] = Object.keys(markdownModules).map((filePath) => {
      const rawText = (markdownModules[filePath] as any).default || (markdownModules[filePath] as string);
      
      // Perform frontmatter parse
      const slug = filePath.split('/').pop()?.replace('.md', '') || '';
      const lines = rawText.split('\n');
      let frontmatterLines: string[] = [];
      let contentLines: string[] = [];
      let inFrontmatter = false;
      let hasStarted = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (i === 0 && line.trim() === '---') {
          inFrontmatter = true;
          hasStarted = true;
          continue;
        }
        if (inFrontmatter && line.trim() === '---') {
          inFrontmatter = false;
          continue;
        }
        if (inFrontmatter) {
          frontmatterLines.push(line);
        } else {
          // Keep lines after frontmatter
          if (hasStarted || line.trim() !== '---') {
            contentLines.push(line);
          }
        }
      }

      const metadata: Record<string, string> = {};
      frontmatterLines.forEach(line => {
        const splitIdx = line.indexOf(':');
        if (splitIdx > -1) {
          const key = line.slice(0, splitIdx).trim();
          let val = line.slice(splitIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          metadata[key] = val;
        }
      });

      // Handle tag parsing
      let tags: string[] = [];
      if (metadata.tags) {
        if (metadata.tags.startsWith('[') && metadata.tags.endsWith(']')) {
          tags = metadata.tags.slice(1, -1).split(',').map(t => t.trim().replace(/^['"]|['"]$/g, ''));
        } else {
          tags = metadata.tags.split(',').map(t => t.trim());
        }
      }

      return {
        slug,
        title: metadata.title || 'Untitled Post',
        date: metadata.date || 'Undated',
        excerpt: metadata.excerpt || '',
        tags,
        readingTime: metadata.readingTime || '3 min read',
        content: contentLines.join('\n').trim(),
      };
    });

    // Sort by date descending
    const sorted = parsed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setPosts(sorted);
  }, []);

  // --- HASH ROUTING INTEGRATION ---
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash) {
        // Find if hash is a valid post slug
        setSelectedPostSlug(hash);
        // Scroll post reader to top
        window.scrollTo({ top: 0, behavior: 'instant' });
      } else {
        setSelectedPostSlug('');
      }
    };

    // Initialize on load
    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [posts]);

  // --- THEME ENGINE ---
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
    const initialTheme = savedTheme || 'light';
    setTheme(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('theme', nextTheme);
  };

  // --- HUMAN-RHYTHM TYPEWRITER ENGINE ---
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const activeWord = TYPING_TAGLINES[taglineIdx];
    
    const tick = () => {
      if (!isDeleting) {
        setCurrentText(activeWord.slice(0, currentText.length + 1));
        if (currentText === activeWord) {
          // Pause at full word
          timer = setTimeout(() => setIsDeleting(true), 2500);
          return;
        }
      } else {
        setCurrentText(activeWord.slice(0, currentText.length - 1));
        if (currentText === '') {
          setIsDeleting(false);
          setTaglineIdx((prev) => (prev + 1) % TYPING_TAGLINES.length);
          return;
        }
      }
      
      // Handwritten rhythm: slightly slower typing, fast deleting
      const typingSpeed = isDeleting ? 40 : 80 + Math.random() * 40;
      timer = setTimeout(tick, typingSpeed);
    };

    timer = setTimeout(tick, 200);
    return () => clearTimeout(timer);
  }, [currentText, isDeleting, taglineIdx]);

  // --- INTERSECTION OBSERVER FOR ACTIVE SECTION TOC ---
  useEffect(() => {
    if (!selectedPostSlug) return;

    const handleScroll = () => {
      const headings = document.getElementsByTagName('h2');
      let currentActiveId = '';
      
      for (let i = 0; i < headings.length; i++) {
        const rect = headings[i].getBoundingClientRect();
        // Section is active if it is near the top of viewport (offset 120px)
        if (rect.top <= 120) {
          currentActiveId = headings[i].id;
        }
      }
      setActiveTocId(currentActiveId);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [selectedPostSlug]);

  // --- POST QUERY FILTERING ---
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    posts.forEach(post => {
      post.tags.forEach(t => tagsSet.add(t));
    });
    return ['All', ...Array.from(tagsSet)];
  }, [posts]);

  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      const matchesTag = selectedTag === 'All' || post.tags.includes(selectedTag);
      const matchesBookmark = !showBookmarksOnly || bookmarks.includes(post.slug);
      const matchesQuery = !searchQuery || 
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesTag && matchesBookmark && matchesQuery;
    });
  }, [posts, selectedTag, searchQuery, showBookmarksOnly, bookmarks]);

  const activePost = useMemo(() => {
    return posts.find(p => p.slug === selectedPostSlug);
  }, [posts, selectedPostSlug]);

  // Scroll to position observer for the individual blog reader template
  useEffect(() => {
    if (!activePost) {
      setShowScrollTop(false);
      return;
    }

    const handleScroll = () => {
      // Check if user has scrolled past one viewport height (window.innerHeight)
      if (window.scrollY > window.innerHeight) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Run once initially to catch any pre-existing scroll state on selection
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [activePost]);

  const tagsWithCounts = useMemo(() => {
    const counts: { [key: string]: number } = {};
    posts.forEach(post => {
      post.tags.forEach(t => {
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    const sortedTags = Object.keys(counts).sort((a, b) => a.localeCompare(b));
    return sortedTags.map(name => ({
      name,
      count: counts[name]
    }));
  }, [posts]);

  const postsByYear = useMemo(() => {
    const groups: { [key: string]: BlogPost[] } = {};
    posts.forEach(post => {
      const year = getYearFromDate(post.date);
      if (!groups[year]) {
        groups[year] = [];
      }
      groups[year].push(post);
    });
    // Sort years descending
    const sortedYears = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    return sortedYears.map(year => ({
      year,
      posts: groups[year].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }));
  }, [posts]);

  // Dynamic Table of Contents builder
  const tableOfContents = useMemo<TableOfContentsItem[]>(() => {
    if (!activePost) return [];
    
    // Scan markdown lines for H2 headings
    const regex = /^##\s+(.*)$/gm;
    const items: TableOfContentsItem[] = [];
    let match;
    
    // Create deep copy to scan
    const text = activePost.content;
    while ((match = regex.exec(text)) !== null) {
      const headingText = match[1].trim();
      const id = headingText
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      items.push({
        id,
        text: headingText,
        level: 2
      });
    }
    return items;
  }, [activePost]);

  // Handle newsletter submits
  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailValue.trim()) return;
    setSubStatus('success');
    setEmailValue('');
    setTimeout(() => {
      setSubStatus('idle');
    }, 4000);
  };

  // Safe navigation helpers
  const selectPost = (slug: string) => {
    window.location.hash = slug;
  };

  const clearPost = () => {
    window.location.hash = '';
  };

  return (
    <div className="min-h-screen flex flex-col selection:bg-neutral-800 selection:text-neutral-100 dark:selection:bg-neutral-100 dark:selection:text-neutral-900">
      
      {/* Dynamic Scrolling Indicator for Active Articles */}
      {activePost && (
        <ReadingProgressBar />
      )}

      {/* Main Framework Grid Layout: Extremely clean, asymmetrical layout */}
      <div className={`flex-1 w-full ${activePost ? 'max-w-7xl mx-auto p-6 md:p-12' : 'max-w-full asymmetric-grid'}`}>
        
        {/* ========================================================= */}
        {/* LEFT COLUMN: FIXED EDITORIAL DASHBOARD                    */}
        {/* ========================================================= */}
        {!activePost && (
          <aside className="lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto custom-border-right flex flex-col p-6 md:p-8 justify-between bg-(--bg-surface) transition-colors duration-300">
            
            <div className="space-y-8">
              {/* Minimal Prompt Box & Theme Toggle Header */}
              <div className="flex items-center justify-between">
                <div 
                  onClick={clearPost}
                  className="font-mono text-xs cursor-pointer hover:text-neutral-400 font-medium flex items-center gap-1.5 border border-(--border) px-2.5 py-1 rounded bg-(--bg-base)"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>UK://LOG</span>
                </div>
                
                {/* Eye-friendly Theme Toggle */}
                <button
                  onClick={toggleTheme}
                  className="p-1.5 rounded border border-(--border) hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors duration-200"
                  title={theme === 'dark' ? "Switch to daylight reading" : "Switch to midnight reading"}
                >
                  {theme === 'dark' ? (
                    <Sun className="w-4 h-4 text-amber-100/80" />
                  ) : (
                    <Moon className="w-4 h-4 text-stone-700/80" />
                  )}
                </button>
              </div>

              {/* Author Identification */}
              <div>
                <h1 className="font-serif text-3xl font-regular italic tracking-tight leading-none mb-1 text-(--text-primary)">
                  Ullhas Kumar
                </h1>
                <p className="font-mono text-xs text-(--text-secondary) uppercase tracking-wider mb-3">
                  Computer Science & Eng.
                </p>
                
                {/* Custom Typewriter text that acts as biological introduction */}
                <div className="h-10 text-sm font-sans text-(--text-secondary) leading-relaxed">
                  <span className="opacity-75">I'm a </span>
                  <span className="font-medium text-(--text-primary) caret-blink">{currentText}</span>
                </div>
              </div>

              <hr className="border-t border-dashed border-(--border)" />

              {/* Dynamic Blog Filters & Controls (Only shows list-controls if no active post, simplifies navigation) */}
              <div className="space-y-6">
                <div>
                  <span className="font-mono text-[10px] text-(--text-muted) uppercase tracking-widest block mb-2">
                    // Real-time Search
                  </span>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <Search className="w-4 h-4 text-(--text-secondary) opacity-60" />
                    </span>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentNav('feed');
                        setShowBookmarksOnly(false);
                        setSelectedTag('All');
                        setSelectedTagDetail(null);
                        if (selectedPostSlug) clearPost();
                      }}
                      placeholder="Search titles, tags, text..."
                      className="w-full bg-(--bg-base) text-sm text-(--text-primary) pl-9 pr-8 py-2 rounded border border-(--border) focus:outline-none focus:border-neutral-400 transition-all font-sans placeholder:opacity-60"
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-(--text-secondary) hover:text-(--text-primary)"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Visual Navigation Menu Block */}
                <div className="space-y-1.5 border-t border-b border-dashed border-(--border) py-4">
                  <span className="font-mono text-[10px] text-(--text-muted) uppercase tracking-widest block mb-2">
                    // Navigation
                  </span>
                  
                  {/* HOME */}
                  <button
                    onClick={() => {
                      setCurrentNav('feed');
                      setSelectedTag('All');
                      setShowBookmarksOnly(false);
                      setSelectedTagDetail(null);
                      if (selectedPostSlug) clearPost();
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-xs font-mono transition-all duration-200 cursor-pointer ${
                      currentNav === 'feed' && !showBookmarksOnly
                        ? 'bg-neutral-800 text-neutral-100 dark:bg-neutral-100 dark:text-neutral-900 font-medium'
                        : 'text-(--text-secondary) hover:bg-neutral-100/60 dark:hover:bg-neutral-900/60 hover:text-(--text-primary)'
                    }`}
                  >
                    <Home className="w-3.5 h-3.5" />
                    <span>HOME</span>
                  </button>

                  {/* BOOKMARKS */}
                  <button
                    onClick={() => {
                      setCurrentNav('feed');
                      setShowBookmarksOnly(true);
                      setSelectedTagDetail(null);
                      if (selectedPostSlug) clearPost();
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-xs font-mono transition-all duration-200 cursor-pointer ${
                      currentNav === 'feed' && showBookmarksOnly
                        ? 'bg-neutral-800 text-neutral-100 dark:bg-neutral-100 dark:text-neutral-900 font-medium'
                        : 'text-(--text-secondary) hover:bg-neutral-100/60 dark:hover:bg-neutral-900/60 hover:text-(--text-primary)'
                    }`}
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    <div className="flex items-center justify-between w-full">
                      <span>BOOKMARKS</span>
                      <span className="text-[10px] font-mono opacity-80">({bookmarks.length})</span>
                    </div>
                  </button>

                  {/* TAGS */}
                  <button
                    onClick={() => {
                      setCurrentNav('tags');
                      setShowBookmarksOnly(false);
                      setSelectedTagDetail(null);
                      if (selectedPostSlug) clearPost();
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-xs font-mono transition-all duration-200 cursor-pointer ${
                      currentNav === 'tags'
                        ? 'bg-neutral-800 text-neutral-100 dark:bg-neutral-100 dark:text-neutral-900 font-medium'
                        : 'text-(--text-secondary) hover:bg-neutral-100/60 dark:hover:bg-neutral-900/60 hover:text-(--text-primary)'
                    }`}
                  >
                    <Tag className="w-3.5 h-3.5" />
                    <span>TAGS</span>
                  </button>

                  {/* ARCHIVES */}
                  <button
                    onClick={() => {
                      setCurrentNav('archives');
                      setShowBookmarksOnly(false);
                      setSelectedTagDetail(null);
                      if (selectedPostSlug) clearPost();
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-xs font-mono transition-all duration-200 cursor-pointer ${
                      currentNav === 'archives'
                        ? 'bg-neutral-800 text-neutral-100 dark:bg-neutral-100 dark:text-neutral-900 font-medium'
                        : 'text-(--text-secondary) hover:bg-neutral-100/60 dark:hover:bg-neutral-900/60 hover:text-(--text-primary)'
                    }`}
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>ARCHIVES</span>
                  </button>
                </div>


              </div>
            </div>

            {/* Clean Muted Footer Log with Social Assets */}
            <div className="mt-8 pt-6 border-t border-dashed border-(--border) space-y-4">
              <div className="flex items-center gap-4 text-(--text-secondary)">
                <a 
                  href="https://github.com" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-(--text-primary) transition-colors flex items-center gap-1.5 text-xs font-mono"
                >
                  <Github className="w-4 h-4" />
                  <span>github</span>
                </a>
                <a 
                  href="mailto:ullhasykumar@gmail.com" 
                  className="hover:text-(--text-primary) transition-colors flex items-center gap-1.5 text-xs font-mono"
                >
                  <Mail className="w-4 h-4" />
                  <span>email</span>
                </a>
              </div>
              
              <p className="font-mono text-[10px] text-(--text-muted) leading-normal">
                Designed for readability. No flashy scripts, trackers, or dark patterns. Built with Markdown.
              </p>
            </div>
          </aside>
        )}

        {/* ========================================================= */}
        {/* RIGHT COLUMN: CONTENT WORKSPACE & ACTIVE POST DESK        */}
        {/* ========================================================= */}
        <main className={activePost ? "flex flex-col min-h-screen transition-colors duration-300" : "p-6 md:p-12 lg:p-16 flex flex-col min-h-screen transition-colors duration-300"}>
          
          {activePost ? (
            // --- DETAILED INDIVIDUAL BLOG POST READING VIEW ---
            <div className="animate-fade-in space-y-8 flex-1 max-w-4xl mx-auto w-full">
              
              {/* Back Button and Metadata Bar with Close indicator */}
              <div className="flex items-center justify-between border-b pb-6 border-(--border)">
                <button
                  onClick={clearPost}
                  className="group flex items-center gap-2 text-sm font-sans font-medium text-(--text-primary) bg-(--bg-surface) border border-(--border) hover:border-(--border-hover) hover:bg-(--border) px-4 py-2 rounded-md transition-all cursor-pointer shadow-sm select-none"
                >
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                  <span>Go Back to Index</span>
                </button>

                 <div className="flex items-center gap-4 font-mono text-xs text-(--text-secondary)">
                  {/* Bookmark Button in Reader View */}
                  <button
                    onClick={() => toggleBookmark(activePost.slug)}
                    className={`p-1 px-2.5 rounded border transition-colors flex items-center gap-1.5 cursor-pointer ${
                      bookmarks.includes(activePost.slug)
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                        : 'border-(--border) hover:bg-neutral-100 dark:hover:bg-neutral-900'
                    }`}
                  >
                    <Bookmark className={`w-3.5 h-3.5 ${bookmarks.includes(activePost.slug) ? 'fill-current' : ''}`} />
                    <span className="text-[10px] uppercase">
                      {bookmarks.includes(activePost.slug) ? 'Saved' : 'Save'}
                    </span>
                  </button>

                  <button
                    onClick={toggleTheme}
                    className="p-1 px-2.5 rounded border border-(--border) hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                    <span className="text-[10px] uppercase">theme</span>
                  </button>
                  <span>{activePost.date}</span>
                </div>
              </div>

              {/* Two-Column Writing Presentation (Sticky Outlines on the side) */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                
                {/* Main Prose Content Column */}
                <article className="lg:col-span-3 space-y-6">
                  {/* Dynamic Post Headline */}
                  <div>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {activePost.tags.map(t => (
                        <button
                          key={t}
                          onClick={() => {
                            setCurrentNav('tags');
                            setSelectedTagDetail(t);
                            clearPost();
                          }}
                          className="text-[10px] font-mono tracking-wider text-(--text-secondary) bg-neutral-200/40 hover:bg-neutral-200/70 dark:bg-neutral-800/40 dark:hover:bg-neutral-800/70 px-2.5 py-0.5 rounded cursor-pointer transition-all select-none"
                        >
                          #{t}
                        </button>
                      ))}
                    </div>
                    
                    <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-regular tracking-tight mb-4 text-(--text-primary) italic leading-tight">
                      {activePost.title}
                    </h1>
                    
                    <p className="text-lg text-(--text-secondary) font-sans font-light leading-relaxed mb-6">
                      {activePost.excerpt}
                    </p>
                  </div>

                  <hr className="border-t border-dashed border-(--border) my-6" />

                  {/* Rich Post Render Panel */}
                  <MarkdownRender content={activePost.content} />

                  {/* Share bar matching style exactly */}
                  <div className="flex items-center justify-end gap-3 pt-6 mt-12 border-t border-dashed border-(--border) text-xs font-sans text-(--text-secondary)">
                    <span className="font-mono text-[10px] text-(--text-muted) uppercase tracking-wider">Share:</span>
                    <div className="flex items-center gap-3">
                      {/* X */}
                      <a
                        href={`https://x.com/intent/tweet?url=${encodeURIComponent(window.location.href.split('#')[0] + '#' + activePost.slug)}&text=${encodeURIComponent(activePost.title)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 hover:text-(--text-primary) transition-colors"
                        title="Share on X"
                      >
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
                        </svg>
                      </a>
                      {/* Facebook */}
                      <a
                        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href.split('#')[0] + '#' + activePost.slug)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 hover:text-(--text-primary) transition-colors"
                        title="Share on Facebook"
                      >
                        <Facebook className="w-3.5 h-3.5" />
                      </a>
                      {/* Telegram */}
                      <a
                        href={`https://t.me/share/url?url=${encodeURIComponent(window.location.href.split('#')[0] + '#' + activePost.slug)}&text=${encodeURIComponent(activePost.title)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 hover:text-(--text-primary) transition-colors"
                        title="Share on Telegram"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </a>
                      {/* LinkedIn */}
                      <a
                        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href.split('#')[0] + '#' + activePost.slug)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 hover:text-(--text-primary) transition-colors"
                        title="Share on LinkedIn"
                      >
                        <Linkedin className="w-3.5 h-3.5" />
                      </a>
                      {/* Copy Link */}
                      <button
                        onClick={() => handleCopyLink(activePost.slug)}
                        className="p-1 hover:text-(--text-primary) transition-colors cursor-pointer relative"
                        title="Copy direct link"
                      >
                        {copiedLink ? (
                          <span className="flex items-center gap-1 text-emerald-500 font-mono text-[10px] animate-pulse">
                            <Check className="w-3.5 h-3.5" /> Copied
                          </span>
                        ) : (
                          <Link className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Separator Line between Blog End and Subscription segment */}
                  <hr className="border-t border-(--border) my-12" />

                  {/* End-Of-Article Subscription Segment */}
                  <div className="bg-(--bg-surface) border border-(--border) p-6 rounded-md shadow-sm">
                    <h3 className="font-serif text-xl italic text-(--text-primary) mb-2">
                      Join Ullhas' dispatch
                    </h3>
                    <p className="text-sm text-(--text-secondary) mb-4 leading-normal font-sans">
                      I occasionally send notes on Machine Learning implementations, paper digests, and raw engineering design straight to your box.
                    </p>
                    
                    {subStatus === 'success' ? (
                      <div className="text-sm font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-3 rounded border border-emerald-500/20">
                        ✓ Subscription registered. Welcome to the log.
                      </div>
                    ) : (
                      <form onSubmit={handleSubscribe} className="flex gap-2">
                        <input
                          type="email"
                          required
                          value={emailValue}
                          onChange={(e) => setEmailValue(e.target.value)}
                          placeholder="Your email address"
                          className="flex-1 text-sm bg-(--bg-base) text-(--text-primary) border border-(--border) px-3 py-2 rounded focus:outline-none focus:border-neutral-400 placeholder:opacity-50"
                        />
                        <button
                          type="submit"
                          className="bg-neutral-800 text-neutral-100 dark:bg-neutral-100 dark:text-neutral-900 px-4 py-2 text-xs font-mono font-medium rounded hover:opacity-90 transition-opacity"
                        >
                          SUBSCRIBE
                        </button>
                      </form>
                    )}
                  </div>

                  {/* Bottom Footer Navigation Bar */}
                  <div className="flex items-center justify-between border-t border-(--border) pt-8 mt-12">
                    <button
                      onClick={clearPost}
                      className="group flex items-center gap-2 text-sm font-sans font-medium text-(--text-primary) bg-(--bg-surface) border border-(--border) hover:border-(--border-hover) hover:bg-(--border) px-4 py-2 rounded-md transition-all cursor-pointer shadow-sm select-none"
                    >
                      <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                      <span>Go Back to Index</span>
                    </button>

                    <button
                      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                      className="group flex items-center gap-1.5 text-xs font-mono text-(--text-secondary) hover:text-(--text-primary) transition-colors cursor-pointer select-none"
                    >
                      <span>Back to Top</span>
                      <ArrowUp className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform" />
                    </button>
                  </div>
                </article>

                {/* Floating Interactive Table of Contents Outline (Visible only on Large screens) */}
                <aside className="hidden lg:block lg:col-span-1">
                  <div className="sticky top-8 space-y-4">
                    <span className="font-mono text-[10px] text-(--text-muted) uppercase tracking-widest block border-b border-(--border) pb-2">
                      Article Outline
                    </span>
                    {tableOfContents.length === 0 ? (
                      <p className="text-xs font-mono text-(--text-muted)">General notes</p>
                    ) : (
                      <nav className="space-y-2">
                        {tableOfContents.map((item) => {
                          const isActive = activeTocId === item.id;
                          return (
                            <a
                              key={item.id}
                              href={`#${item.id}`}
                              className={`block text-xs font-sans transition-all duration-200 border-l pl-3 leading-relaxed ${
                                isActive 
                                  ? 'text-(--text-primary) border-neutral-400 dark:border-neutral-500 font-medium translate-x-1' 
                                  : 'text-(--text-secondary) border-(--border) hover:text-(--text-primary)'
                              }`}
                            >
                              {item.text}
                            </a>
                          );
                        })}
                      </nav>
                    )}
                  </div>
                </aside>

              </div>
              
            </div>
          ) : currentNav === 'tags' ? (
            selectedTagDetail ? (
              // --- NESTED TAG DETAIL VIEW ---
              <div className="animate-fade-in space-y-8 flex-1 max-w-4xl xl:max-w-5xl w-full pb-16">
                
                {/* Breadcrumbs matching layout exactly */}
                <div className="flex items-center gap-1.5 text-sm font-sans text-neutral-400 dark:text-neutral-500">
                  <button 
                    onClick={() => {
                      setCurrentNav('feed');
                      setSelectedTagDetail(null);
                      if (selectedPostSlug) clearPost();
                    }}
                    className="hover:text-(--text-primary) transition-colors cursor-pointer select-none"
                  >
                    Home
                  </button>
                  <span className="text-neutral-300 dark:text-neutral-700 select-none">›</span>
                  <button 
                    onClick={() => {
                      setSelectedTagDetail(null);
                    }}
                    className="hover:text-(--text-primary) transition-colors cursor-pointer select-none"
                  >
                    Tags
                  </button>
                  <span className="text-neutral-300 dark:text-neutral-700 select-none">›</span>
                  <span className="text-(--text-secondary) font-medium select-none">{selectedTagDetail}</span>
                </div>

                {/* Header: Tag Title with Tag Icon & count info */}
                <div className="flex items-center gap-3 border-b pb-6 border-(--border)">
                  <Tag className="w-5 h-5 text-neutral-400 dark:text-neutral-500 flex-shrink-0" />
                  <h2 className="font-serif text-3xl italic font-regular tracking-tight text-(--text-primary) flex items-baseline gap-2">
                    <span>{selectedTagDetail}</span>
                    <span className="font-sans text-base text-neutral-400 dark:text-neutral-500 font-light select-none">
                      {posts.filter(p => p.tags.includes(selectedTagDetail)).length}
                    </span>
                  </h2>
                </div>

                {/* Blog Card Layout matching home layout exactly */}
                <div className="space-y-6 max-w-3xl pt-4">
                  {posts
                    .filter(post => post.tags.includes(selectedTagDetail))
                    .map((post) => (
                      <div 
                        key={post.slug}
                        onClick={() => selectPost(post.slug)}
                        className="group cursor-pointer p-6 md:p-8 rounded-md border border-(--border) bg-(--bg-surface) hover:border-(--border-hover) hover:bg-neutral-100/10 dark:hover:bg-neutral-900/10 transition-all duration-300 relative overflow-hidden"
                      >
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 font-mono text-xs text-(--text-secondary)">
                              <span>{post.date}</span>
                              <span className="text-(--text-muted)">•</span>
                              <div className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                <span>{post.readingTime}</span>
                              </div>
                            </div>

                            {/* Quick bookmark toggle */}
                            <button
                              onClick={(e) => toggleBookmark(post.slug, e)}
                              className={`p-1.5 rounded border transition-colors flex items-center justify-center cursor-pointer ${
                                bookmarks.includes(post.slug)
                                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                  : 'border-transparent hover:border-(--border) text-(--text-secondary) hover:text-(--text-primary)'
                              }`}
                              title={bookmarks.includes(post.slug) ? "Remove bookmark" : "Bookmark article"}
                            >
                              <Bookmark className={`w-3.5 h-3.5 ${bookmarks.includes(post.slug) ? 'fill-current' : ''}`} />
                            </button>
                          </div>

                          <h3 className="font-serif text-2xl md:text-3xl font-regular leading-tight italic text-(--text-primary) tracking-tight group-hover:underline decoration-neutral-400 decoration-1">
                            {post.title}
                          </h3>

                          <p className="text-sm md:text-base text-(--text-secondary) font-sans leading-relaxed line-clamp-3">
                            {post.excerpt}
                          </p>

                          <div className="flex flex-wrap gap-1.5 pt-2" onClick={(e) => e.stopPropagation()}>
                            {post.tags.map(t => (
                              <button
                                key={t}
                                onClick={() => {
                                  setCurrentNav('tags');
                                  setSelectedTagDetail(t);
                                  if (selectedPostSlug) clearPost();
                                }}
                                className="text-[10px] font-mono text-(--text-secondary) bg-(--bg-base) hover:bg-neutral-100 hover:text-(--text-primary) dark:hover:bg-neutral-900 border border-(--border) px-2 py-0.5 rounded transition-colors cursor-pointer select-none"
                              >
                                #{t.toLowerCase()}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>

              </div>
            ) : (
              // --- TAGS PANEL SUMMARY VIEW ---
              <div className="animate-fade-in space-y-12 flex-1 max-w-4xl xl:max-w-5xl w-full pb-16">
                
                {/* Header Title Banner */}
                <div className="flex flex-col md:flex-row md:items-baseline md:justify-between border-b pb-4 border-(--border)">
                  <h2 className="font-serif text-3xl italic font-regular tracking-tight text-(--text-primary)">
                    Tags
                  </h2>
                  <span className="font-mono text-xs text-(--text-secondary) mt-1 md:mt-0">
                    {tagsWithCounts.length} active tags
                  </span>
                </div>

                {/* Dynamic tag capsules/pills matching style exactly */}
                <div className="flex flex-wrap gap-2.5 py-4 max-w-3xl">
                  {tagsWithCounts.map((tagObj) => (
                    <button
                      key={tagObj.name}
                      onClick={() => {
                        setSelectedTagDetail(tagObj.name);
                      }}
                      className="group flex items-center gap-2 border border-neutral-200 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600 px-4 py-2 rounded-full text-slate-800 dark:text-neutral-200 bg-neutral-100/10 hover:bg-neutral-100/20 dark:bg-neutral-900/10 dark:hover:bg-neutral-900/20 transition-all font-sans text-sm font-medium cursor-pointer shadow-sm select-none"
                    >
                      <span>{tagObj.name}</span>
                      <span className="font-mono text-xs text-neutral-400 dark:text-neutral-500 ml-1 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors">
                        {tagObj.count}
                      </span>
                    </button>
                  ))}
                </div>

              </div>
            )
          ) : currentNav === 'archives' ? (
            // --- ARCHIVES TIMELINE VIEW ---
            <div className="animate-fade-in space-y-12 flex-1 max-w-4xl xl:max-w-5xl w-full pb-16">
              
              {/* Header Title Banner */}
              <div className="flex flex-col md:flex-row md:items-baseline md:justify-between border-b pb-4 border-(--border)">
                <h2 className="font-serif text-3xl italic font-regular tracking-tight text-(--text-primary)">
                  Archives
                </h2>
                <span className="font-mono text-xs text-(--text-secondary) mt-1 md:mt-0">
                  {posts.length} {posts.length === 1 ? 'entry' : 'entries'} on the timeline
                </span>
              </div>

              {/* Dynamic Scrollable Vertical Timeline */}
              <div className="relative space-y-12 py-4">
                
                {/* Responsive vertical line */}
                <div className="absolute left-[20px] sm:left-[108px] top-4 bottom-4 w-[1px] bg-neutral-200 dark:bg-neutral-800/80 pointer-events-none" />

                {postsByYear.map((group) => (
                  <div key={group.year} className="space-y-6">
                    {/* Year Row */}
                    <div className="relative flex items-center pl-[44px] sm:pl-[128px] py-1">
                      {/* Large node dot centered on the line */}
                      <div className="absolute left-[20px] sm:left-[108px] -translate-x-1/2 w-4 h-4 rounded-full bg-(--bg-base) border-2 border-neutral-400 dark:border-neutral-500 z-10 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500" />
                      </div>
                      <h3 className="font-mono text-xl font-bold tracking-tight text-(--text-primary)">
                        {group.year}
                      </h3>
                    </div>

                    {/* Posts within Year */}
                    <div className="space-y-4">
                      {group.posts.map((post) => (
                        <div 
                          key={post.slug} 
                          onClick={() => selectPost(post.slug)}
                          className="relative flex flex-col sm:flex-row sm:items-center pl-[44px] sm:pl-0 sm:gap-x-10 py-2.5 group cursor-pointer hover:translate-x-0.5 transition-all"
                        >
                          {/* Timeline bullet dot centered on the line */}
                          <div className="absolute left-[20px] sm:left-[108px] -translate-x-1/2 w-2 h-2 rounded-full bg-neutral-300 dark:bg-neutral-700 border border-(--bg-base) group-hover:bg-(--accent) group-hover:scale-125 transition-all z-10" />

                          {/* Left Column: Date. Fits neatly to the left of the line on sm+, or stacks on mobile */}
                          <div className="sm:w-[88px] sm:text-right font-mono text-xs text-(--text-secondary) group-hover:text-(--text-primary) mb-1 sm:mb-0">
                            {formatArchiveDate(post.date)}
                          </div>

                          {/* Right Column: Title */}
                          <div className="font-serif text-base sm:text-lg italic text-(--text-primary) tracking-tight group-hover:underline underline-offset-4 decoration-neutral-400/50 line-clamp-2 md:line-clamp-1">
                            {post.title}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

            </div>
          ) : (
            // --- MAIN FEED: LIST OF ALL AVAILABLE BLOG ARTICLES ---
            <div className="animate-fade-in space-y-12 flex-1 max-w-4xl xl:max-w-5xl w-full">
              
              {/* Filter Headline Banner */}
              <div className="flex flex-col md:flex-row md:items-baseline md:justify-between border-b pb-4 border-(--border)">
                <h2 className="font-serif text-3xl italic font-regular tracking-tight text-(--text-primary)">
                  {showBookmarksOnly 
                    ? 'Bookmarked Logs' 
                    : selectedTag === 'All' 
                      ? 'Complete Log' 
                      : `Topics matching ${selectedTag}`}
                </h2>
                <span className="font-mono text-xs text-(--text-secondary) mt-1 md:mt-0">
                  {filteredPosts.length} {filteredPosts.length === 1 ? 'entry' : 'entries'} available
                </span>
              </div>

              {/* Recently Viewed Panel */}
              {recentlyViewed.length > 0 && !showBookmarksOnly && (
                <div className="space-y-3 pb-2 animate-fade-in">
                  <span className="font-mono text-[10px] text-(--text-muted) uppercase tracking-widest block">
                    // Continue Reading (Recently Viewed)
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {recentlyViewed.map(slug => {
                      const post = posts.find(p => p.slug === slug);
                      if (!post) return null;
                      return (
                        <div 
                          key={slug}
                          onClick={() => selectPost(slug)}
                          className="group cursor-pointer p-4 rounded-md border border-(--border) bg-(--bg-surface) hover:border-(--border-hover) transition-all duration-200"
                        >
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-mono text-(--text-muted)">{post.date}</span>
                            <h4 className="font-serif text-sm font-regular italic text-(--text-primary) tracking-tight group-hover:underline line-clamp-1">
                              {post.title}
                            </h4>
                            <p className="text-[11px] text-(--text-secondary) font-sans line-clamp-2 leading-relaxed">
                              {post.excerpt}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Asymmetrical Grid of Posts Card Layout */}
              {filteredPosts.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-(--border) rounded-md bg-neutral-100/10 dark:bg-neutral-900/10">
                  <span className="font-mono text-xs text-(--text-secondary) block mb-2">NO POSTS MATCH QUERY</span>
                  <button 
                    onClick={() => { setSearchQuery(''); setSelectedTag('All'); }}
                    className="text-xs font-mono text-(--text-primary) underline"
                  >
                    Reset all filters
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredPosts.map((post) => (
                    <div 
                      key={post.slug}
                      onClick={() => selectPost(post.slug)}
                      className="group cursor-pointer p-6 md:p-8 rounded-md border border-(--border) bg-(--bg-surface) hover:border-(--border-hover) hover:bg-neutral-100/10 dark:hover:bg-neutral-900/10 transition-all duration-300 relative overflow-hidden"
                    >
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 font-mono text-xs text-(--text-secondary)">
                            <span>{post.date}</span>
                            <span className="text-(--text-muted)">•</span>
                            <div className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              <span>{post.readingTime}</span>
                            </div>
                          </div>

                          {/* Quick bookmark toggle */}
                          <button
                            onClick={(e) => toggleBookmark(post.slug, e)}
                            className={`p-1.5 rounded border transition-colors flex items-center justify-center cursor-pointer ${
                              bookmarks.includes(post.slug)
                                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                : 'border-transparent hover:border-(--border) text-(--text-secondary) hover:text-(--text-primary)'
                            }`}
                            title={bookmarks.includes(post.slug) ? "Remove bookmark" : "Bookmark article"}
                          >
                            <Bookmark className={`w-3.5 h-3.5 ${bookmarks.includes(post.slug) ? 'fill-current' : ''}`} />
                          </button>
                        </div>

                        <h3 className="font-serif text-2xl md:text-3xl font-regular leading-tight italic text-(--text-primary) tracking-tight group-hover:underline decoration-neutral-400 decoration-1">
                          {post.title}
                        </h3>

                        <p className="text-sm md:text-base text-(--text-secondary) font-sans leading-relaxed line-clamp-3">
                          {post.excerpt}
                        </p>

                        <div className="flex flex-wrap gap-1.5 pt-2" onClick={(e) => e.stopPropagation()}>
                          {post.tags.map(t => (
                            <button
                              key={t}
                              onClick={() => {
                                setCurrentNav('tags');
                                setSelectedTagDetail(t);
                                if (selectedPostSlug) clearPost();
                              }}
                              className="text-[10px] font-mono text-(--text-secondary) bg-(--bg-base) hover:bg-neutral-100 hover:text-(--text-primary) dark:hover:bg-neutral-900 border border-(--border) px-2 py-0.5 rounded transition-colors cursor-pointer select-none"
                            >
                              #{t.toLowerCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Handcrafted Activity Strip (Now Learning ticker) */}
              <div className="pt-8 mt-12 border-t border-(--border)">
                <span className="font-mono text-[10px] text-(--text-muted) uppercase tracking-widest block mb-4">
                  // CURRENT DISCIPLINE & FOCUS
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs text-(--text-secondary)">
                  <div className="border border-(--border) p-4 rounded bg-neutral-100/20 dark:bg-neutral-900/20">
                    <span className="text-(--text-muted) block mb-1">01 / ENGINES</span>
                    <span className="text-(--text-primary)">Transformer Dimensions & PyTorch Optimizers</span>
                  </div>
                  <div className="border border-(--border) p-4 rounded bg-neutral-100/20 dark:bg-neutral-900/20">
                    <span className="text-(--text-muted) block mb-1">02 / CORE THEORIES</span>
                    <span className="text-(--text-primary)">Information Entropy & Information Bottlenecks</span>
                  </div>
                  <div className="border border-(--border) p-4 rounded bg-neutral-100/20 dark:bg-neutral-900/20">
                    <span className="text-(--text-muted) block mb-1">03 / HANDWRITTEN REPOS</span>
                    <span className="text-(--text-primary)">Custom JS Parsers & Self-Hosted Engine Stacks</span>
                  </div>
                </div>
              </div>

            </div>
          )}

        </main>
      </div>

      {/* Floating Scroll to Top Action Button */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-50 p-2.5 rounded-full border border-(--border) bg-(--bg-surface) text-(--text-primary) shadow-sm hover:border-(--border-hover) hover:bg-(--border) transition-all duration-350 md:bottom-8 md:right-8 cursor-pointer select-none group focus:outline-none animate-fade-in"
          aria-label="Scroll to top"
          title="Scroll back to top"
        >
          <ArrowUp className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
        </button>
      )}
    </div>
  );
}

/**
 * Scroll reading line indicator. Done pure-react style for extreme 
 * compatibility without heavy bundles or layout issues.
 */
function ReadingProgressBar() {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleProgress = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight > 0) {
        const pct = (window.scrollY / scrollHeight) * 100;
        setScrollProgress(pct);
      }
    };

    window.addEventListener('scroll', handleProgress);
    return () => window.removeEventListener('scroll', handleProgress);
  }, []);

  return (
    <div className="fixed top-0 left-0 w-full h-[3px] bg-neutral-200/20 dark:bg-neutral-800/20 z-50">
      <div 
        className="h-full bg-neutral-400 dark:bg-neutral-500 transition-all duration-75"
        style={{ width: `${scrollProgress}%` }}
      />
    </div>
  );
}
