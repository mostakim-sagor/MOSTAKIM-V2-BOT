"use strict";

const axios = require("axios");
const fs    = require("fs");
const path  = require("path");

const _origLog = console.log;
console.log = () => {};
const { downloadVideo } = require("sagor-video-downloader");
console.log = _origLog;

module.exports.config = {
  name:            "autodown",
  version:         "3.0.0",
  hasPermssion:    0,
  credits:         "SAGOR",
  description:     "Auto-detect & download videos from any platform. Also works as /autodown <url>",
  commandCategory: "media",
  usages:          "autodown <video url>",
  cooldowns:       5,
};

const MAX_SIZE_MB = 25;
const CACHE_DIR   = path.join(process.cwd(), "tmp");
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

// ── Platform detectors ────────────────────────────────────────────────────────
const PLATFORMS = [
  { name: "TikTok",    re: /tiktok\.com|vm\.tiktok|vt\.tiktok/i },
  { name: "YouTube",   re: /youtu\.be|youtube\.com\/(?:watch|shorts|embed|live)/i },
  { name: "Facebook",  re: /facebook\.com|fb\.watch/i },
  { name: "Instagram", re: /instagram\.com\/(?:p|reel|tv|stories)\//i },
  { name: "Twitter",   re: /(?:twitter|x)\.com\/\S+\/status\//i },
  { name: "Pinterest", re: /pinterest\.com\/pin\/|pin\.it\//i },
];

const LINK_RE = /(https?:\/\/[^\s<>"]+)/g;

function detectPlatform(url) {
  for (const p of PLATFORMS) if (p.re.test(url)) return p.name;
  return null;
}

// ── TikTok: tikwm (no watermark) → nayan fallback ────────────────────────────
async function downloadTikTok(url, outPath) {
  const apis = [
    async () => {
      const r = await axios.post(
        "https://www.tikwm.com/api/",
        new URLSearchParams({ url, hd: "1" }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0" }, timeout: 20000 }
      );
      const d = r.data;
      if (d.code !== 0 || !d.data) throw new Error(d.msg || "tikwm failed");
      const videoUrl = d.data.hdplay || d.data.play;
      if (!videoUrl) throw new Error("no URL");
      return { videoUrl, title: d.data.title || "TikTok Video" };
    },
    async () => {
      const r = await axios.get(
        "https://nayan-video-downloader.vercel.app/alldown?url=" + encodeURIComponent(url),
        { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 25000 }
      );
      const d = r.data;
      if (!d.status || !d.data) throw new Error("no data");
      const videoUrl = d.data.high || d.data.low;
      if (!videoUrl) throw new Error("no URL");
      return { videoUrl, title: d.data.title || "TikTok Video" };
    }
  ];
  for (const fn of apis) {
    try {
      const { videoUrl, title } = await fn();
      const vr = await axios.get(videoUrl, {
        responseType: "arraybuffer", timeout: 90000,
        headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://www.tiktok.com/" }
      });
      fs.writeFileSync(outPath, Buffer.from(vr.data));
      return { title };
    } catch {}
  }
  throw new Error("All TikTok APIs failed");
}

// ── YouTube: ytdl-core → nayan API fallback ───────────────────────────────────
async function downloadYouTube(url, outPath) {
  try {
    const ytdl    = require("@distube/ytdl-core");
    const info    = await ytdl.getInfo(url);
    const title   = info.videoDetails.title || "Video";
    const formats = ytdl.filterFormats(info.formats, "videoandaudio");
    const mp4 = formats.filter(f => f.container === "mp4")
      .sort((a, b) => (parseInt(b.qualityLabel) || 0) - (parseInt(a.qualityLabel) || 0));
    const best = mp4[0] || formats[0];
    if (!best) throw new Error("no format");
    await new Promise((res, rej) => {
      const w = fs.createWriteStream(outPath);
      const s = ytdl.downloadFromInfo(info, { format: best });
      s.pipe(w);
      s.on("error", rej);
      w.on("finish", res);
      w.on("error", rej);
    });
    return { title };
  } catch {}

  // Fallback: nayan API
  const r = await axios.get(
    "https://nayan-video-downloader.vercel.app/alldown?url=" + encodeURIComponent(url),
    { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 25000 }
  );
  const d = r.data;
  if (!d.status || !d.data) throw new Error("YouTube API failed");
  const videoUrl = d.data.high || d.data.low;
  if (!videoUrl) throw new Error("no URL");
  const vr = await axios.get(videoUrl, { responseType: "arraybuffer", timeout: 90000, headers: { "User-Agent": "Mozilla/5.0" } });
  fs.writeFileSync(outPath, Buffer.from(vr.data));
  return { title: d.data.title || "YouTube Video" };
}

// ── Facebook: nayan → fdownloader fallback ────────────────────────────────────
async function downloadFacebook(url, outPath) {
  const apis = [
    async () => {
      const r = await axios.get(
        "https://nayan-video-downloader.vercel.app/alldown?url=" + encodeURIComponent(url),
        { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 35000 }
      );
      const d = r.data;
      if (!d.status || !d.data) throw new Error("no data");
      const videoUrl = d.data.high || d.data.low;
      if (!videoUrl) throw new Error("no URL");
      return videoUrl;
    },
    async () => {
      const r = await axios.post(
        "https://fdownloader.net/api/ajaxSearch",
        new URLSearchParams({ q: url, lang: "en" }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0", "Referer": "https://fdownloader.net/" }, timeout: 20000 }
      );
      const html = r.data?.data || "";
      const m = html.match(/href="(https:\/\/[^"]+\.mp4[^"]*)"/i)
             || html.match(/href="(https:\/\/[^"]+)"[^>]*>(?:HD|SD|720|360)/i);
      if (!m) throw new Error("no link");
      return m[1].replace(/&amp;/g, "&");
    }
  ];
  for (const fn of apis) {
    try {
      const videoUrl = await fn();
      const vr = await axios.get(videoUrl, { responseType: "arraybuffer", timeout: 90000, headers: { "User-Agent": "Mozilla/5.0" } });
      fs.writeFileSync(outPath, Buffer.from(vr.data));
      return { title: "Facebook Video" };
    } catch {}
  }
  throw new Error("All Facebook APIs failed");
}

// ── Instagram: snapsave → snapinsta → saveig → OGP fallback ──────────────────
async function downloadInstagram(url, outPath) {
  // Helper: extract mp4 link from HTML
  function extractMp4(html) {
    const mp4 = html.match(/https?:\/\/[^"'\s<>\\]+\.mp4[^"'\s<>\\]*/g) || [];
    const clean = mp4.map(u => u.replace(/\\u0026/g, "&").replace(/&amp;/g, "&").replace(/\\/g, ""));
    return clean[0] || null;
  }

  const apis = [
    // 1. snapsave.app
    async () => {
      const r = await axios.post(
        "https://snapsave.app/action.php",
        new URLSearchParams({ url, lang: "en", v: "v2" }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://snapsave.app/",
            "Origin": "https://snapsave.app"
          },
          timeout: 25000
        }
      );
      const html = typeof r.data === "string" ? r.data : JSON.stringify(r.data);
      const link = extractMp4(html);
      if (!link) throw new Error("snapsave: no mp4");
      return link;
    },
    // 2. snapinsta.app
    async () => {
      const r = await axios.post(
        "https://snapinsta.app/api",
        new URLSearchParams({ url, lang: "en" }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://snapinsta.app/",
            "Origin": "https://snapinsta.app"
          },
          timeout: 20000
        }
      );
      const html = typeof r.data === "string" ? r.data : JSON.stringify(r.data);
      const link = extractMp4(html);
      if (!link) throw new Error("snapinsta: no mp4");
      return link;
    },
    // 3. saveig.app
    async () => {
      const r = await axios.get(
        "https://saveig.app/api?url=" + encodeURIComponent(url),
        {
          headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://saveig.app/" },
          timeout: 20000
        }
      );
      const d = r.data;
      const results = d?.results_number > 0 && d?.url_list;
      if (!results || !d.url_list[0]) throw new Error("saveig: no url");
      const item = d.url_list[0];
      const link = item.url || item.thumbnail;
      if (!link) throw new Error("saveig: empty url");
      return link;
    },
    // 4. IG downloader API (insta.com style)
    async () => {
      const r = await axios.post(
        "https://www.instafinsta.com/wp-json/aio-dl/video-data/",
        new URLSearchParams({ url }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://www.instafinsta.com/"
          },
          timeout: 20000
        }
      );
      const d = r.data;
      const medias = d?.medias || [];
      const mp4item = medias.find(m => m.url && m.url.includes(".mp4"));
      if (!mp4item) throw new Error("instafinsta: no mp4");
      return mp4item.url;
    },
    // 5. OGP scrape fallback
    async () => {
      const agents = [
        "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
      ];
      for (const ua of agents) {
        try {
          const r = await axios.get(url, {
            headers: { "User-Agent": ua, "Accept": "text/html,application/xhtml+xml" },
            timeout: 15000, maxRedirects: 5
          });
          const html = r.data || "";
          const m = html.match(/<meta[^>]+property=["']og:video(?::secure_url|:url)?["'][^>]+content=["']([^"']+)["']/i)
                 || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video(?::secure_url|:url)?["']/i);
          if (m?.[1]) return m[1].replace(/&amp;/g, "&");
        } catch {}
      }
      throw new Error("OGP: no video");
    }
  ];

  for (const fn of apis) {
    try {
      const videoUrl = await fn();
      const vr = await axios.get(videoUrl, {
        responseType: "arraybuffer",
        timeout: 90000,
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Referer": "https://www.instagram.com/"
        }
      });
      if (!vr.data || vr.data.byteLength < 5000) throw new Error("empty file");
      fs.writeFileSync(outPath, Buffer.from(vr.data));
      return { title: "Instagram Video" };
    } catch {}
  }
  throw new Error("All Instagram APIs failed");
}

// ── Twitter/X: nayan ─────────────────────────────────────────────────────────
async function downloadTwitter(url, outPath) {
  const r = await axios.get(
    "https://nayan-video-downloader.vercel.app/alldown?url=" + encodeURIComponent(url),
    { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 25000 }
  );
  const d = r.data;
  if (!d.status || !d.data) throw new Error("Twitter API failed");
  const videoUrl = d.data.high || d.data.low;
  if (!videoUrl) throw new Error("no URL");
  const vr = await axios.get(videoUrl, { responseType: "arraybuffer", timeout: 90000, headers: { "User-Agent": "Mozilla/5.0" } });
  fs.writeFileSync(outPath, Buffer.from(vr.data));
  return { title: d.data.title || "Twitter Video" };
}

// ── Pinterest: nayan → pintdownloader fallback ────────────────────────────────
async function downloadPinterest(url, outPath) {
  const apis = [
    async () => {
      const r = await axios.get(
        "https://nayan-video-downloader.vercel.app/alldown?url=" + encodeURIComponent(url),
        { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 25000 }
      );
      const d = r.data;
      if (!d.status || !d.data) throw new Error("no data");
      const mediaUrl = d.data.high || d.data.low || d.data.url;
      if (!mediaUrl || mediaUrl.includes("unsplash")) throw new Error("no Pinterest URL");
      return mediaUrl;
    },
    async () => {
      const r = await axios.post(
        "https://pintdownloader.com/",
        new URLSearchParams({ url }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0", "Referer": "https://pintdownloader.com/" }, timeout: 20000, maxRedirects: 10 }
      );
      const html = r.data || "";
      const mp4  = html.match(/https?:\/\/[^"'\s]*v1\.pinimg\.com[^"'\s]*\.mp4[^"'\s]*/);
      const jpg  = html.match(/https?:\/\/[^"'\s]*(?:i|v\d*)\.pinimg\.com[^"'\s]*\.(?:jpg|jpeg|png)[^"'\s]*/);
      const link = mp4?.[0] || jpg?.[0];
      if (!link) throw new Error("no link");
      return link.replace(/&amp;/g, "&");
    }
  ];
  for (const fn of apis) {
    try {
      const mediaUrl = await fn();
      const vr = await axios.get(mediaUrl, {
        responseType: "arraybuffer", timeout: 60000,
        headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://www.pinterest.com/" }
      });
      fs.writeFileSync(outPath, Buffer.from(vr.data));
      return { title: "Pinterest Media" };
    } catch {}
  }
  throw new Error("All Pinterest APIs failed");
}

// ── sagor-video-downloader fallback (for unknown platforms) ───────────────────
async function downloadSagor(url, outPath) {
  const result = await downloadVideo(url);
  const filePath = result?.filePath;
  if (!filePath || !fs.existsSync(filePath)) throw new Error("sagor: no file");
  fs.copyFileSync(filePath, outPath);
  try { fs.unlinkSync(filePath); } catch {}
  return { title: result?.title || "Video" };
}

// ── Dispatch by platform ──────────────────────────────────────────────────────
async function downloadByPlatform(platform, url, outPath) {
  switch (platform) {
    case "TikTok":    return await downloadTikTok(url, outPath);
    case "YouTube":   return await downloadYouTube(url, outPath);
    case "Facebook":  return await downloadFacebook(url, outPath);
    case "Instagram": return await downloadInstagram(url, outPath);
    case "Twitter":   return await downloadTwitter(url, outPath);
    case "Pinterest": return await downloadPinterest(url, outPath);
    default:          return await downloadSagor(url, outPath);
  }
}

// ── Core: download + validate + send ─────────────────────────────────────────
async function downloadAndSend(api, url, platform, threadID, messageID) {
  const outPath = path.join(CACHE_DIR, `autodown_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.mp4`);
  let meta = { title: "Video" };
  try {
    meta = await downloadByPlatform(platform || "unknown", url, outPath);

    if (!fs.existsSync(outPath)) throw new Error("File not found after download");

    const sizeMB = fs.statSync(outPath).size / (1024 * 1024);
    if (sizeMB < 0.01) { fs.unlinkSync(outPath); throw new Error("Downloaded file is empty (link may be private or expired)"); }
    if (sizeMB > MAX_SIZE_MB) { fs.unlinkSync(outPath); throw new Error(`File too large (${sizeMB.toFixed(1)} MB). Max: ${MAX_SIZE_MB} MB`); }

    const label = platform ? `📌 ${platform}` : "📥 Video";
    const caption =
      `📥 𝗩𝗜𝗗𝗘𝗢 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗\n` +
      `━━━━━━━━━━━━━━━\n` +
      `${label}\n` +
      `🎬 ${String(meta.title || "Video").slice(0, 80)}\n` +
      `📦 ${sizeMB.toFixed(2)} MB\n` +
      `━━━━━━━━━━━━━━━\n` +
      `⚡ MOSTAKIM V2 BOT`;

    await new Promise((resolve, reject) =>
      api.sendMessage(
        { body: caption, attachment: fs.createReadStream(outPath) },
        threadID,
        (err) => { try { fs.unlinkSync(outPath); } catch {} err ? reject(err) : resolve(); }
      )
    );
    return { ok: true };
  } catch (err) {
    try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch {}
    return { ok: false, error: err.message || "Unknown error" };
  }
}

// ── Cooldown store (per thread) ───────────────────────────────────────────────
const cooldowns = new Map();
const COOLDOWN_MS = 15000;

// ── handleEvent: auto-detect links in every message ──────────────────────────
module.exports.handleEvent = async function ({ api, event }) {
  try {
    const { threadID, messageID, body, senderID, type } = event;
    if (type !== "message" && type !== "message_reply") return;
    if (!body) return;

    // Skip bot's own messages
    try { if (String(senderID) === String(api.getCurrentUserID())) return; } catch {}

    // Skip prefix commands
    const prefix = (global.config && global.config.PREFIX) || "/";
    if (body.trim().startsWith(prefix)) return;

    // Find all links
    const rawMatches = body.match(LINK_RE);
    if (!rawMatches) return;

    // Only process known video platform links
    const videoLinks = [...new Set(rawMatches)].filter(u => detectPlatform(u));
    if (videoLinks.length === 0) return;

    // Cooldown per thread
    const now = Date.now();
    if (now - (cooldowns.get(threadID) || 0) < COOLDOWN_MS) return;
    cooldowns.set(threadID, now);

    api.setMessageReaction("⏳", messageID, () => {}, true);

    let successCount = 0;
    let failCount    = 0;

    for (const url of videoLinks) {
      const platform = detectPlatform(url);
      const result   = await downloadAndSend(api, url, platform, threadID, messageID);
      if (result.ok) successCount++;
      else failCount++;
    }

    api.setMessageReaction(
      successCount > 0 && failCount === 0 ? "✅" : successCount > 0 ? "⚠️" : "❌",
      messageID, () => {}, true
    );

  } catch (e) {
    console.error("[autodown handleEvent]", e?.message);
  }
};

// ── run: manual /autodown <url> command ──────────────────────────────────────
module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, body } = event;

  const text = args.length > 0 ? args.join(" ") : (body || "");
  const rawMatches = text.match(LINK_RE);

  if (!rawMatches || rawMatches.length === 0) {
    return api.sendMessage(
      "📥 𝗔𝘂𝘁𝗼 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱𝗲𝗿\n" +
      "━━━━━━━━━━━━━━━\n" +
      "Usage: /autodown <link>\n\n" +
      "✅ Supported:\n" +
      "🎵 TikTok  ▶️ YouTube\n" +
      "📘 Facebook  📸 Instagram\n" +
      "🐦 Twitter/X  📌 Pinterest",
      threadID, messageID
    );
  }

  const uniqueLinks = [...new Set(rawMatches)];
  api.setMessageReaction("⏳", messageID, () => {}, true);

  let successCount = 0, failCount = 0;

  for (const url of uniqueLinks) {
    const platform = detectPlatform(url);
    const result   = await downloadAndSend(api, url, platform, threadID, messageID);
    if (result.ok) {
      successCount++;
    } else {
      failCount++;
      api.sendMessage(
        `❌ Download failed!\n🔗 ${url.slice(0, 60)}\n⚠️ ${result.error}\n\n💡 Link টি public হতে হবে।`,
        threadID, messageID
      );
    }
  }

  api.setMessageReaction(
    successCount > 0 && failCount === 0 ? "✅" : successCount > 0 ? "⚠️" : "❌",
    messageID, () => {}, true
  );
};
