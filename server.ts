import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

// ─── TİPLER ──────────────────────────────────────────────────────────────────

interface RawPost {
  id: string;
  platform: string;
  handle: string;
  accountName: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  date: string;
  url: string;
  thumbnail?: string;
}

interface ContentItem extends RawPost {
  viralMultiplier: number;
  baselineAvg: number;
}

// ─── YARDIMCI FONKSİYONLAR ───────────────────────────────────────────────────

function getErrorMessage(err: any): string {
  if (!err) return "Bilinmeyen hata";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (typeof err === "object") {
    if (err.message) return String(err.message);
    if (err.error) {
      if (typeof err.error === "string") return err.error;
      if (typeof err.error === "object" && err.error.message) return String(err.error.message);
    }
    try {
      return JSON.stringify(err);
    } catch {
      return "Obje hatası";
    }
  }
  return String(err);
}

function calcViralScores(posts: RawPost[], cutoffDate: Date): ContentItem[] {
  const sorted = [...posts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const byKey = new Map<string, RawPost[]>();
  for (const p of sorted) {
    const key = `${p.platform.toLowerCase()}_${p.handle.toLowerCase()}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(p);
  }

  const result: ContentItem[] = [];

  for (const posts of byKey.values()) {
    const recent = posts.filter(p => new Date(p.date) >= cutoffDate);
    const older = posts.filter(p => new Date(p.date) < cutoffDate).slice(0, 20);
    const baselinePool = older.length >= 3 ? older : posts.slice(0, Math.min(20, posts.length));
    
    const baselineAvg = baselinePool.length > 0
      ? baselinePool.reduce((s, p) => s + (p.views > 0 ? p.views : p.likes), 0) / baselinePool.length
      : 0;

    for (const post of recent) {
      const metric = post.views > 0 ? post.views : post.likes;
      const multiplier = baselineAvg > 0 ? metric / baselineAvg : 1;
      
      if (multiplier >= 1.0) {
        result.push({
          ...post,
          baselineAvg: Math.round(baselineAvg),
          viralMultiplier: multiplier,
        });
      }
    }
  }

  return result.sort((a, b) => b.viralMultiplier - a.viralMultiplier);
}

// ─── SERVER START ────────────────────────────────────────────────────────────

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Middleware
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  // ─── API ROUTES ───────────────────────────────────────────────────────────
  
  // Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // YouTube Analysis
  app.get("/api/analyze/youtube", async (req, res) => {
    const { handle, days } = req.query as { handle: string; days: string };
    const apiKey = process.env.YOUTUBE_API_KEY;
    const daysNum = parseInt(days) || 7;

    if (!apiKey) return res.status(500).json({ error: "YOUTUBE_API_KEY eksik" });
    if (!handle) return res.status(400).json({ error: "handle parametresi gerekli" });

    try {
      const h = handle.replace(/^@/, "");
      let channelRes = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=contentDetails,snippet&forHandle=${h}&key=${apiKey}`
      );
      let channelData = await channelRes.json();

      if (!channelData.items?.length) {
        channelRes = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=contentDetails,snippet&forUsername=${h}&key=${apiKey}`
        );
        channelData = await channelRes.json();
      }

      if (channelData.error) throw new Error(getErrorMessage(channelData.error));
      if (!channelData.items?.length) return res.json([]);

      const uploadsId = channelData.items[0].contentDetails.relatedPlaylists.uploads;
      const channelTitle = channelData.items[0].snippet.title;

      const plRes = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${uploadsId}&maxResults=50&key=${apiKey}`
      );
      const plData = await plRes.json();
      if (plData.error) return res.json([]);
      if (!plData.items?.length) return res.json([]);

      const videoIds = plData.items.map((i: any) => i.contentDetails.videoId).filter(Boolean).join(",");
      if (!videoIds) return res.json([]);

      const statsRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds}&key=${apiKey}`
      );
      const statsData = await statsRes.json();
      if (!statsData.items) return res.json([]);

      const allVideos: RawPost[] = statsData.items.map((v: any) => ({
        id: v.id,
        platform: "YouTube",
        handle: h,
        accountName: channelTitle,
        title: v.snippet.title,
        views: parseInt(v.statistics.viewCount || "0"),
        likes: parseInt(v.statistics.likeCount || "0"),
        comments: parseInt(v.statistics.commentCount || "0"),
        date: v.snippet.publishedAt,
        url: `https://www.youtube.com/watch?v=${v.id}`,
        thumbnail: v.snippet.thumbnails?.high?.url || v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url,
      }));

      const cutoffDate = new Date(Date.now() - daysNum * 86400000);
      const scored = calcViralScores(allVideos, cutoffDate);
      res.json(scored);
    } catch (err: any) {
      const msg = getErrorMessage(err);
      console.error(`YouTube hatası (${handle}):`, msg);
      res.status(500).json({ error: msg });
    }
  });

  // ─── GEMINI AI ROUTES ─────────────────────────────────────────────────────

  // 1. Market Context Analysis
  app.get("/api/analyze/ai/market", async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY eksik" });

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: "Ekonomi, kripto para ve küresel piyasalarda son 24 saatte yaşanan en önemli 5 gelişmeyi özetle. Bu bilgiler içerik üreticileri için bağlam oluşturacak." }] }],
        config: {
          tools: [{ googleSearch: {} }]
        }
      });
      res.json({ text: response.text });
    } catch (err: any) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  // 2. Global Strategy Analysis
  app.post("/api/analyze/ai/global", async (req, res) => {
    const { viralItems, marketContext } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY eksik" });

    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Sen ekonomi/kripto/yatırım/birikim nişinde içerik strateji uzmanısın.
Bu uygulama doğrudan @Selcoin ekibi tarafından kullanılmaktadır.
Piyasa Bağlamı: ${marketContext || "Güncel piyasa verisi alınamadı."}

Aşağıda ${viralItems.length} adet GERÇEK viral içerik var.
"viralX" = mevcut izlenme / son-15-video-ortalaması (matematiksel viral çarpan).

${JSON.stringify(viralItems, null, 2)}

Bu verileri ve piyasa bağlamını analiz et.
ÖZELLİKLE @Selcoin kanalını (eğer verilerde varsa) diğer rakiplerle kıyasla.
Selcoin ekibine şu konularda spesifik feedback ver:
1. Selcoin neler yapmış (iyi olanlar)?
2. Neler yapılmamış (eksikler)?
3. Thumbnails, Başlıklar, SEO ve Transkript/Senaryo kalitesi için iyileştirme önerileri.
4. "Selcoin Neler Yapabilir?" başlığı altında 5 maddelik aksiyon planı.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          thinkingConfig: { thinkingBudget: 8192 },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              themes: { type: Type.ARRAY, items: { type: Type.STRING } },
              psychology: { type: Type.STRING },
              sentimentRadar: {
                type: Type.OBJECT,
                properties: {
                  fomo: { type: Type.NUMBER },
                  fud: { type: Type.NUMBER },
                  rational: { type: Type.NUMBER },
                  panic: { type: Type.NUMBER }
                },
                required: ["fomo", "fud", "rational", "panic"]
              },
              platformPatterns: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    platform: { type: Type.STRING },
                    insight: { type: Type.STRING }
                  },
                  required: ["platform", "insight"]
                }
              },
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    detail: { type: Type.STRING },
                    urgency: { type: Type.STRING, enum: ["yüksek", "orta", "düşük"] }
                  },
                  required: ["title", "detail", "urgency"]
                }
              },
              contentGaps: { type: Type.ARRAY, items: { type: Type.STRING } },
              viralFormula: { type: Type.STRING },
              thumbnailTrends: { type: Type.STRING },
              selcoinStrategy: {
                type: Type.OBJECT,
                properties: {
                  doneWell: { type: Type.ARRAY, items: { type: Type.STRING } },
                  missing: { type: Type.ARRAY, items: { type: Type.STRING } },
                  improvements: {
                    type: Type.OBJECT,
                    properties: {
                      thumbnails: { type: Type.STRING },
                      titles: { type: Type.STRING },
                      seo: { type: Type.STRING },
                      transcripts: { type: Type.STRING }
                    },
                    required: ["thumbnails", "titles", "seo", "transcripts"]
                  },
                  actionPlan: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["doneWell", "missing", "improvements", "actionPlan"]
              }
            },
            required: [
              "themes", "psychology", "sentimentRadar", "platformPatterns", 
              "recommendations", "contentGaps", "viralFormula", "thumbnailTrends",
              "selcoinStrategy"
            ]
          }
        }
      });

      res.json(JSON.parse(response.text || "{}"));
    } catch (err: any) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  // 3. Deep Analysis for Single Item
  app.post("/api/analyze/ai/deep", async (req, res) => {
    const { item } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY eksik" });

    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Sen Selcoin (ekonomi/kripto kanalı) için içerik strateji uzmanısın.
Aşağıdaki viral içeriği derinlemesine analiz et ve Selcoin markasına uygun strateji üret.

İçerik Başlığı: ${item.title}
Platform: ${item.platform}
Hesap: ${item.accountName} (@${item.handle})
Viral Çarpanı: ${item.viralMultiplier}x`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          thinkingConfig: { thinkingBudget: 4000 },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sentiment: { type: Type.STRING, description: "İçeriğin yarattığı temel duygu ve kitle üzerindeki etkisi." },
              psychologyType: { 
                type: Type.STRING, 
                enum: ["FOMO", "FUD", "Panic", "Rational", "Hype", "Educational"],
                description: "İçeriğin temel psikolojik kategorisi."
              },
              thumbnailAnalysis: { type: Type.STRING, description: "Görsel/Thumbnail analizi." },
              suggestedHooks: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "Selcoin tarzında 3 adet vurucu giriş cümlesi."
              },
              suggestedScript: { type: Type.STRING, description: "30-60 saniyelik video senaryo taslağı." }
            },
            required: ["sentiment", "psychologyType", "thumbnailAnalysis", "suggestedHooks", "suggestedScript"]
          }
        }
      });

      res.json(JSON.parse(response.text || "{}"));
    } catch (err: any) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  // Catch-all for /api/* to ensure JSON response instead of falling through to Vite
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API endpoint ${req.method} ${req.url} not found` });
  });

  // ─── VITE / STATIC MIDDLEWARE ─────────────────────────────────────────────

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Start listening
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n✅ Sunucu: http://localhost:${PORT}`);
    console.log(`   YouTube API Key  : ${process.env.YOUTUBE_API_KEY ? "✓ TAMAM" : "✗ EKSİK"}`);
    console.log(`   Gemini API Key   : ${process.env.GEMINI_API_KEY  ? "✓ TAMAM" : "✗ EKSİK"}\n`);
  });
}

startServer();
