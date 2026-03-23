import React, { useState } from 'react';
import {
  Youtube,
  TrendingUp, Zap, BrainCircuit, Settings,
  Search, BarChart3, AlertCircle, ExternalLink,
  ChevronRight, RefreshCw, CheckCircle2, Loader2,
  Lightbulb, Target, ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
// GoogleGenAI import removed for security (moved to server)

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface ContentItem {
  id: string;
  platform: 'YouTube';
  handle: string;
  accountName: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  date: string;
  url: string;
  thumbnail?: string;
  viralMultiplier: number;
  baselineAvg: number;
  // Deep analysis fields (optional)
  sentiment?: string;
  psychologyType?: 'FOMO' | 'FUD' | 'Panic' | 'Rational' | 'Hype' | 'Educational';
  thumbnailAnalysis?: string;
  suggestedHooks?: string[];
  suggestedScript?: string;
}

interface PlatformPattern {
  platform: string;
  insight: string;
}

interface Recommendation {
  title: string;
  detail: string;
  urgency: 'yüksek' | 'orta' | 'düşük';
}

interface AIAnalysis {
  themes: string[];
  psychology: string;
  sentimentRadar: {
    fomo: number;
    fud: number;
    rational: number;
    panic: number;
  };
  platformPatterns: PlatformPattern[];
  recommendations: Recommendation[];
  contentGaps: string[];
  viralFormula: string;
  thumbnailTrends: string;
  selcoinStrategy?: {
    doneWell: string[];
    missing: string[];
    improvements: {
      thumbnails: string;
      titles: string;
      seo: string;
      transcripts: string;
    };
    actionPlan: string[];
  };
}

interface ChannelStatus {
  handle: string;
  name: string;
  status: 'pending' | 'loading' | 'done' | 'error';
  count: number;
  error?: string;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const COMPETITORS = {
  YouTube: [
    { name: "Selcoin (Ana Hesap)", handle: "Selcoin" },
    { name: "Atilla Yeşilada",   handle: "ATILLAYESILADA" },
    { name: "Murat Muratoğlu",   handle: "MuratMuratoglu" },
    { name: "Özgür Demirtaş",    handle: "Prof.Dr.OzgurDemirtas" },
    { name: "Selçuk Geçer",      handle: "selcukgecer" },
    { name: "Coin Mühendisi",    handle: "CoinMuhendisi" },
    { name: "Alp Işık",          handle: "alp_is_ik" },
    { name: "Mert Başaran",      handle: "MertBasaran" },
    { name: "Ekonomi Ekranı",    handle: "EkonomiEkrani" },
    { name: "Kripto Kemal",      handle: "KriptoKemal" },
    { name: "Beste Naz Süllü",   handle: "BesteNazSullu" },
    { name: "Midas Plus",        handle: "midasplus" },
    { name: "Cihat E. Çiçek",    handle: "CihatECicek" },
    { name: "Tuncay Turşucu",    handle: "tuncay-tursucu" },
    { name: "Haluk Tatar",       handle: "HalukTatar" },
    { name: "İntegral Forex TV", handle: "IntegralForexTV" },
    { name: "Mesele Ekonomi",    handle: "MeseleEkonomi" },
    { name: "Coin Bureau",       handle: "CoinBureau" },
    { name: "Altcoin Daily",     handle: "AltcoinDaily" },
    { name: "Benjamin Cowen",    handle: "intothecryptoverse" },
    { name: "The Crypto Lark",   handle: "TheCryptoLark" },
    { name: "Ivan On Tech",      handle: "IvanOnTech" },
    { name: "Işık Ökte",         handle: "isikokte" },
    { name: "Strategy Turkey",   handle: "StrategyTurkey" },
    { name: "Fatih Tonguç",      handle: "FatihTonguc" },
    { name: "Finans Sohbet",     handle: "FinansSohbet" },
    { name: "Barış Özcan",       handle: "barisozcan" },
    { name: "The Moon",          handle: "TheMoon" },
    { name: "99Bitcoins",        handle: "99Bitcoins" },
    { name: "InvestAnswers",     handle: "InvestAnswers" },
    { name: "Kitco News",        handle: "kitconews" },
  ],
};

const TIME_DAYS = { weekly: 7, biweekly: 14, monthly: 30 };

const PLATFORM_COLORS: Record<string, string> = {
  YouTube: 'text-red-500 bg-red-500/10',
};

// ─── APP ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [allData, setAllData] = useState<ContentItem[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ytStatuses, setYtStatuses] = useState<ChannelStatus[]>([]);
  const [phase, setPhase] = useState<'idle' | 'youtube' | 'ai' | 'done'>('idle');
  const [deepLoading, setDeepLoading] = useState<string | null>(null);
  const [marketContext, setMarketContext] = useState<string | null>(null);

  const fetchMarketContext = async () => {
    try {
      const res = await fetch('/api/analyze/ai/market');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Market context error');
      setMarketContext(data.text || null);
      return data.text;
    } catch (err) {
      console.error('Market context error:', err);
      return null;
    }
  };

  const deepAnalyzeItem = async (item: ContentItem) => {
    setDeepLoading(item.id);
    try {
      const res = await fetch('/api/analyze/ai/deep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item })
      });
      const analysis = await res.json();
      if (!res.ok) throw new Error(analysis.error || 'Deep analysis error');
      
      setAllData(prev => prev.map(d => d.id === item.id ? { ...d, ...analysis } : d));
    } catch (err) {
      console.error('Deep analysis error:', err);
    } finally {
      setDeepLoading(null);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const getErrorMsg = (data: any, fallback: string) => {
    if (!data?.error) return fallback;
    if (typeof data.error === 'string') return data.error;
    if (typeof data.error === 'object') {
      return data.error.message || JSON.stringify(data.error);
    }
    return String(data.error);
  };

  async function fetchYouTube(handle: string, name: string, days: number): Promise<ContentItem[]> {
    setYtStatuses(prev => prev.map(s => s.handle === handle ? { ...s, status: 'loading' } : s));
    try {
      const res = await fetch(`/api/analyze/youtube?handle=${encodeURIComponent(handle)}&days=${days}`);
      const data = await res.json();
      if (!res.ok) throw new Error(getErrorMsg(data, 'YouTube API hatası'));
      const items: ContentItem[] = Array.isArray(data) ? data : [];
      setYtStatuses(prev => prev.map(s => s.handle === handle ? { ...s, status: 'done', count: items.length } : s));
      return items;
    } catch (err: any) {
      setYtStatuses(prev => prev.map(s => s.handle === handle ? { ...s, status: 'error', error: err.message } : s));
      return [];
    }
  }

  // ── Main Analysis ──────────────────────────────────────────────────────────

  const runAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    setAiAnalysis(null);
    setAllData([]);
    setPhase('youtube');
    const days = TIME_DAYS[timeRange];

    // Init statuses
    const initStatuses: ChannelStatus[] = COMPETITORS.YouTube.map(c => ({
      handle: c.handle, name: c.name, status: 'pending', count: 0,
    }));
    setYtStatuses(initStatuses);

    try {
      // ── Market Context ──────────────────────────────────────────────────
      setPhase('ai');
      const context = await fetchMarketContext();

      // ── YouTube: paralel, 5'li batch ──────────────────────────────────────
      setPhase('youtube');
      const YT_BATCH = 5;
      const ytList = COMPETITORS.YouTube;
      for (let i = 0; i < ytList.length; i += YT_BATCH) {
        const batch = ytList.slice(i, i + YT_BATCH);
        const results = await Promise.all(batch.map(c => fetchYouTube(c.handle, c.name, days)));
        for (const items of results) {
          if (items && items.length > 0) {
            setAllData(prev => {
              const newData = [...prev, ...items];
              // Tekilleştirme (ID bazlı)
              const unique = Array.from(new Map(newData.map(item => [item.id + item.platform, item])).values());
              return unique as ContentItem[];
            });
          }
        }
      }

      // ── Gemini AI analizi ─────────────────────────────────────────────────
      setPhase('ai');
      // State'den güncel veriyi alarak analiz yap
      setAllData(currentData => {
        const viral = currentData.filter(i => i.viralMultiplier >= 1.5);
        if (viral.length > 0) {
          runAiGlobalAnalysis(viral);
        }
        return currentData;
      });

      setPhase('done');
    } catch (err: any) {
      setError('Analiz hatası: ' + err.message);
      setPhase('done');
    } finally {
      setIsLoading(false);
    }
  };

  const runAiGlobalAnalysis = async (viralItems: ContentItem[]) => {
    try {
      const top25 = [...viralItems]
        .sort((a, b) => b.viralMultiplier - a.viralMultiplier)
        .slice(0, 25)
        .map((i) => ({
          platform: i.platform,
          handle: i.handle,
          title: String(i.title).slice(0, 120),
          views: i.views,
          likes: i.likes,
          viralX: +Number(i.viralMultiplier).toFixed(2),
          date: String(i.date).slice(0, 10),
        }));

      const res = await fetch('/api/analyze/ai/global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viralItems: top25, marketContext })
      });
      const analysis = await res.json();
      if (!res.ok) throw new Error(analysis.error || 'Global analysis error');
      
      setAiAnalysis(analysis);
    } catch (aiErr: any) {
      console.error('Gemini hatası:', aiErr.message);
      setError(prev => prev ? prev + '\nAI: ' + aiErr.message : 'AI: ' + aiErr.message);
    }
  };

  // ── Filtered & sorted data ─────────────────────────────────────────────────
  // Viral puanı 1.0'dan küçük olanları frontend tarafında da filtrele (garanti olsun)
  const viralOnly = allData.filter(d => d.viralMultiplier >= 1.0);
  const sortedData = [...viralOnly].sort((a, b) => b.viralMultiplier - a.viralMultiplier);

  const ytDone = ytStatuses.filter(s => s.status === 'done' || s.status === 'error').length;
  const ytTotal = ytStatuses.length;

  const urgencyColor = (u: string) =>
    u === 'yüksek' ? 'text-red-400 border-red-500/30 bg-red-500/5'
    : u === 'orta' ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/5'
    : 'text-slate-400 border-white/10 bg-white/5';

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-200 font-sans selection:bg-emerald-500/30">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <div className="fixed top-0 left-0 w-80 h-full bg-[#0f0f12] border-r border-white/5 p-6 z-50 hidden lg:flex flex-col overflow-y-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Zap className="text-black w-6 h-6 fill-current" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">İstihbarat v3</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">Rakip Analiz Sistemi</p>
          </div>
        </div>

        {/* Sistem Durumu */}
        <section className="mb-6">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            <Settings className="w-3 h-3" /> Analiz Durumu
          </label>

          {/* YouTube progress */}
          {ytTotal > 0 && (
            <div className="mb-3 p-3 bg-white/5 rounded-xl border border-white/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Youtube className="w-3 h-3 text-red-500" /> YouTube
                </span>
                <span className="text-[10px] font-bold text-emerald-400">{ytDone}/{ytTotal}</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-emerald-500 rounded-full"
                  animate={{ width: `${(ytDone / ytTotal) * 100}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
              {/* Error list */}
              {ytStatuses.filter(s => s.status === 'error').map(s => (
                <p key={s.handle} className="text-[10px] text-red-400 mt-1 truncate" title={s.error}>
                  ✗ {s.name}
                </p>
              ))}
            </div>
          )}

          {/* Phase label */}
          {phase !== 'idle' && phase !== 'done' && (
            <p className="text-[11px] text-blue-400 mt-2 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              {phase === 'youtube' ? 'YouTube kanalları taranıyor...'
               : 'AI analiz ediyor...'}
            </p>
          )}
          {phase === 'done' && (
            <p className="text-[11px] text-emerald-400 mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Analiz tamamlandı
            </p>
          )}
        </section>

        {/* Run button */}
        <button
          onClick={runAnalysis}
          disabled={isLoading}
          className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-500/10 mb-6"
        >
          {isLoading
            ? <><RefreshCw className="w-5 h-5 animate-spin" /> Analiz Ediliyor...</>
            : <><TrendingUp className="w-5 h-5" /> Analizi Başlat</>}
        </button>

        <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl mb-4">
          <p className="text-[11px] text-emerald-500/70 leading-relaxed">
            <strong>Viral Formül:</strong> İzlenme ÷ Son-15-Video-Ort.<br />
            1.5x→Yükselişte · 3x→Viral · 5x→Mega Viral
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-400 leading-relaxed whitespace-pre-line">{error}</p>
          </div>
        )}
      </div>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <main className="lg:ml-80 p-6 lg:p-10">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h2 className="text-3xl font-bold text-white mb-1">Pazar İstihbaratı</h2>
            <p className="text-slate-400 text-sm">Gerçek veriye dayalı viral içerik analizi • {allData.length} içerik</p>
          </div>

          <div className="flex flex-wrap gap-3">
            {/* Zaman */}
            <div className="flex bg-[#0f0f12] p-1 rounded-xl border border-white/5">
              {(['weekly', 'biweekly', 'monthly'] as const).map(t => (
                <button key={t} onClick={() => setTimeRange(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    timeRange === t ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}>
                  {t === 'weekly' ? 'Haftalık' : t === 'biweekly' ? '2 Haftalık' : 'Aylık'}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Stats row */}
        {allData.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Toplam İçerik',  value: allData.length, icon: BarChart3 },
              { label: 'Viral (≥3x)',     value: allData.filter(i=>i.viralMultiplier>=3).length, icon: TrendingUp },
              { label: 'Yükselişte (≥1.5x)', value: allData.filter(i=>i.viralMultiplier>=1.5&&i.viralMultiplier<3).length, icon: ArrowUpRight },
              { label: 'Platform',        value: 'YouTube', icon: Zap },
            ].map(s => (
              <div key={s.label} className="bg-[#0f0f12] border border-white/5 rounded-2xl p-4">
                <s.icon className="w-4 h-4 text-emerald-500 mb-2" />
                <div className="text-2xl font-black text-white">{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

          {/* ── İçerik Feed ─────────────────────────────────────────────── */}
          <div className="xl:col-span-2 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-500" /> Viral Akış
              </h3>
              <span className="text-xs text-slate-500">{sortedData.length} içerik</span>
            </div>

            <AnimatePresence mode="popLayout">
              {sortedData.length > 0 ? (
                sortedData.map(item => (
                  <motion.div
                    key={item.id + item.platform}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="group bg-[#0f0f12] border border-white/5 rounded-2xl p-5 hover:border-emerald-500/30 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3 overflow-hidden">
                        {item.thumbnail && (
                          <div className="relative shrink-0">
                            <img
                              src={item.thumbnail}
                              alt=""
                              className="w-16 h-12 object-cover rounded-lg border border-white/10"
                              referrerPolicy="no-referrer"
                            />
                            <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-md flex items-center justify-center border border-[#0a0a0c] ${PLATFORM_COLORS[item.platform]}`}>
                              <Youtube className="w-3 h-3" />
                            </div>
                          </div>
                        )}
                        {!item.thumbnail && (
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${PLATFORM_COLORS[item.platform]}`}>
                            <Youtube className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className="font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-2 text-sm">
                            {item.title}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            @{item.handle} • {new Date(item.date).toLocaleDateString('tr-TR')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-2xl font-black ${
                          item.viralMultiplier >= 5 ? 'text-red-400' :
                          item.viralMultiplier >= 3 ? 'text-emerald-400' :
                          item.viralMultiplier >= 1.5 ? 'text-yellow-400' :
                          'text-slate-500'}`}>
                          {item.viralMultiplier.toFixed(1)}x
                        </div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Viral</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 py-3 border-y border-white/5 mb-3">
                      {[
                        { label: 'İzlenme', value: item.views },
                        { label: 'Beğeni',    value: item.likes },
                        { label: 'Ortalama', value: Math.round(item.baselineAvg) },
                      ].map(s => (
                        <div key={s.label} className="text-center">
                          <div className="text-sm font-bold text-white">{s.value.toLocaleString('tr-TR')}</div>
                          <div className="text-[10px] text-slate-500 uppercase">{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Formül */}
                    <div className="text-[10px] text-slate-600 mb-3 font-mono">
                      Viral = {item.views.toLocaleString('tr-TR')} ÷ {Math.round(item.baselineAvg).toLocaleString('tr-TR')} = {item.viralMultiplier.toFixed(2)}x
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        {item.viralMultiplier >= 5 && (
                          <span className="px-2 py-0.5 bg-red-500/10 text-red-400 text-[10px] font-bold rounded uppercase">Mega Viral</span>
                        )}
                        {item.viralMultiplier >= 3 && item.viralMultiplier < 5 && (
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded uppercase">Viral</span>
                        )}
                        {item.viralMultiplier >= 1.5 && item.viralMultiplier < 3 && (
                          <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 text-[10px] font-bold rounded uppercase">Yükselişte</span>
                        )}
                        {item.psychologyType && (
                          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] font-bold rounded uppercase">{item.psychologyType}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => deepAnalyzeItem(item)}
                          disabled={deepLoading === item.id}
                          className="flex items-center gap-1 text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors disabled:opacity-50"
                        >
                          {deepLoading === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <BrainCircuit className="w-3 h-3" />}
                          Derin Analiz
                        </button>
                        <a
                          href={item.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white transition-colors"
                        >
                          Aç <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    {/* Deep Analysis Results */}
                    {item.sentiment && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-4 pt-4 border-t border-white/5 space-y-4"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                              <Zap className="w-3 h-3 text-yellow-500" /> Duygu & Psikoloji
                            </h5>
                            <p className="text-xs text-slate-300 leading-relaxed">{item.sentiment}</p>
                          </div>
                          <div className="space-y-2">
                            <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                              <Youtube className="w-3 h-3 text-red-500" /> Thumbnail Analizi
                            </h5>
                            <p className="text-xs text-slate-300 leading-relaxed">{item.thumbnailAnalysis}</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                            <Lightbulb className="w-3 h-3 text-emerald-500" /> Selcoin İçin Kancalar (Hooks)
                          </h5>
                          <div className="grid grid-cols-1 gap-2">
                            {item.suggestedHooks?.map((hook, idx) => (
                              <div key={idx} className="p-2 bg-emerald-500/5 border border-emerald-500/10 rounded-lg text-xs text-emerald-400 italic">
                                "{hook}"
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                            <BarChart3 className="w-3 h-3 text-blue-500" /> Video Senaryo Taslağı
                          </h5>
                          <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-400 leading-relaxed whitespace-pre-line">
                            {item.suggestedScript}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                ))
              ) : (
                <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-3xl text-slate-600">
                  {isLoading
                    ? <><Loader2 className="w-10 h-10 mb-3 animate-spin opacity-30" /><p className="text-sm">Veriler geliyor...</p></>
                    : <><Search className="w-10 h-10 mb-3 opacity-20" /><p className="text-sm">Analizi başlatın.</p></>}
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* ── AI Analiz Paneli ─────────────────────────────────────────── */}
          <div className="space-y-6">
            <div className="sticky top-10 space-y-6">

              {/* AI Strateji */}
              <section className="bg-[#0f0f12] border border-white/5 rounded-3xl p-6 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full -mr-16 -mt-16" />

                <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-5">
                  <BrainCircuit className="w-5 h-5 text-emerald-500" /> AI Strateji Masası
                </h3>

                {aiAnalysis ? (
                  <div className="space-y-6">

                    {/* Piyasa Bağlamı */}
                    {marketContext && (
                      <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                        <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                          <Search className="w-3 h-3" /> Güncel Piyasa Nabzı
                        </h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-3 hover:line-clamp-none transition-all cursor-pointer">
                          {marketContext}
                        </p>
                      </div>
                    )}

                    {/* Selcoin Stratejisi */}
                    {aiAnalysis.selcoinStrategy && (
                      <div className="space-y-6 pt-6 border-t border-white/5">
                        <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                          <Target className="w-4 h-4" /> Selcoin Özel Stratejisi
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                          <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                            <h5 className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-2">Neler İyi Yapılmış?</h5>
                            <ul className="space-y-1.5">
                              {aiAnalysis.selcoinStrategy.doneWell.map((item, i) => (
                                <li key={i} className="text-[11px] text-slate-300 flex gap-2">
                                  <span className="text-emerald-500">✓</span> {item}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl">
                            <h5 className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-2">Neler Eksik?</h5>
                            <ul className="space-y-1.5">
                              {aiAnalysis.selcoinStrategy.missing.map((item, i) => (
                                <li key={i} className="text-[11px] text-slate-300 flex gap-2">
                                  <span className="text-red-500">!</span> {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">İyileştirme Alanları</h5>
                          <div className="space-y-2">
                            {[
                              { label: 'Thumbnails', value: aiAnalysis.selcoinStrategy.improvements.thumbnails },
                              { label: 'Başlıklar', value: aiAnalysis.selcoinStrategy.improvements.titles },
                              { label: 'SEO', value: aiAnalysis.selcoinStrategy.improvements.seo },
                              { label: 'Transkript', value: aiAnalysis.selcoinStrategy.improvements.transcripts },
                            ].map(imp => (
                              <div key={imp.label} className="p-3 bg-white/5 rounded-xl border border-white/5">
                                <div className="text-[10px] font-bold text-slate-400 mb-1 uppercase">{imp.label}</div>
                                <div className="text-[11px] text-slate-300 leading-relaxed">{imp.value}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="p-5 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border border-white/10 rounded-3xl">
                          <h5 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-yellow-500" /> Selcoin Neler Yapabilir?
                          </h5>
                          <div className="space-y-3">
                            {aiAnalysis.selcoinStrategy.actionPlan.map((action, i) => (
                              <div key={i} className="flex gap-3">
                                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px] font-bold text-emerald-400 shrink-0">
                                  {i + 1}
                                </div>
                                <p className="text-[11px] text-slate-300 leading-relaxed">{action}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Viral Formülü */}
                    {aiAnalysis.viralFormula && (
                      <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                        <p className="text-xs text-emerald-400 leading-relaxed italic">"{aiAnalysis.viralFormula}"</p>
                      </div>
                    )}

                    {/* Temalar */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Dönem Temaları</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {aiAnalysis.themes?.map((t, i) => (
                          <span key={i} className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-slate-300">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Psikoloji */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Kitle Psikolojisi</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">{aiAnalysis.psychology}</p>
                    </div>

                    {/* Sentiment Radar */}
                    {aiAnalysis.sentimentRadar && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Psikoloji Radarı</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: 'FOMO', value: aiAnalysis.sentimentRadar.fomo, color: 'bg-emerald-500' },
                            { label: 'FUD', value: aiAnalysis.sentimentRadar.fud, color: 'bg-red-500' },
                            { label: 'Rasyonel', value: aiAnalysis.sentimentRadar.rational, color: 'bg-blue-500' },
                            { label: 'Panik', value: aiAnalysis.sentimentRadar.panic, color: 'bg-orange-500' },
                          ].map(s => (
                            <div key={s.label} className="bg-white/5 p-2 rounded-lg border border-white/5">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-bold text-slate-400">{s.label}</span>
                                <span className="text-[10px] font-bold text-white">%{s.value}</span>
                              </div>
                              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${s.value}%` }}
                                  className={`h-full ${s.color}`}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Thumbnail Trends */}
                    {aiAnalysis.thumbnailTrends && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                          <Youtube className="w-3 h-3" /> Thumbnail Trendleri
                        </h4>
                        <p className="text-xs text-slate-400 leading-relaxed italic">"{aiAnalysis.thumbnailTrends}"</p>
                      </div>
                    )}

                    {/* Platform Örüntüleri */}
                    {aiAnalysis.platformPatterns?.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Platform Örüntüleri</h4>
                        <div className="space-y-2">
                          {aiAnalysis.platformPatterns.map((p, i) => (
                            <div key={i} className="flex gap-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded self-start mt-0.5 shrink-0 ${PLATFORM_COLORS[p.platform] || 'text-slate-400 bg-white/5'}`}>
                                {p.platform}
                              </span>
                              <p className="text-xs text-slate-400 leading-relaxed">{p.insight}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* İçerik Boşlukları */}
                    {aiAnalysis.contentGaps?.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                          <Lightbulb className="w-3 h-3" /> Fırsat Konuları
                        </h4>
                        <ul className="space-y-1">
                          {aiAnalysis.contentGaps.map((g, i) => (
                            <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                              <span className="text-emerald-500 mt-0.5">›</span> {g}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Tavsiyeler */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1">
                        <Target className="w-3 h-3" /> Tavsiyeler
                      </h4>
                      <div className="space-y-2">
                        {aiAnalysis.recommendations?.map((rec, i) => (
                          <div key={i} className={`p-3 border rounded-xl transition-all ${urgencyColor(rec.urgency)}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <ChevronRight className="w-3 h-3 shrink-0" />
                              <h5 className="text-xs font-bold text-white">{rec.title}</h5>
                              <span className={`ml-auto text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${urgencyColor(rec.urgency)}`}>
                                {rec.urgency}
                              </span>
                            </div>
                            <p className="text-[11px] leading-relaxed ml-5 text-slate-400">{rec.detail}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center space-y-3">
                    {isLoading && phase === 'ai'
                      ? <>
                          <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mx-auto" />
                          <p className="text-sm text-slate-500">AI analiz ediyor...</p>
                        </>
                      : <>
                          <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mx-auto">
                            <Zap className="w-7 h-7 text-slate-700" />
                          </div>
                          <p className="text-xs text-slate-500 px-6">
                            Viral içerikler tespit edildiğinde AI stratejik analiz üretir.
                          </p>
                        </>}
                  </div>
                )}
              </section>

              {/* Metodoloji notu */}
              <section className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4">
                <h4 className="text-xs font-bold text-emerald-400 mb-1">Veri Kaynakları</h4>
                <p className="text-[11px] text-emerald-500/60 leading-relaxed">
                  YouTube: resmi Data API v3 — gerçek izlenme/beğeni/yorum.<br />
                  AI Analiz: Google Gemini 1.5 Pro — stratejik içerik yorumlama.
                </p>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
