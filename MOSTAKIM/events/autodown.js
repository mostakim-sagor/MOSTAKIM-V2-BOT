const axios = require("axios");
const fs    = require("fs-extra");
const path  = require("path");

module.exports.config = {
  name:        "autodown",
  eventType:   ["message"],
  version:     "1.0.0",
  credits:     "MOSTAKIM",
  description: "Auto-detect YouTube/TikTok/Facebook link → download and send",
};

const CACHE_DIR = path.join(process.cwd(), "tmp");
fs.ensureDirSync(CACHE_DIR);
const MAX_MB = 50;

// ── URL Detectors ─────────────────────────────────────────────────
const PATTERNS = {
  youtube: /(?:https?:\/\/)?(?:m\.|www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)[\w\-]{6,}/i,
  tiktok:  /(?:https?:\/\/)?(?:www\.|vm\.|vt\.)?tiktok\.com\/[\w@\/\-?=%&.]+/i,
  facebook:/(?:https?:\/\/)?(?:www\.|m\.)?(?:facebook\.com\/(?:watch|reel|videos|share\/v)|fb\.watch)\/[\w\/\-?=%&.]+/i,
};

function detectUrl(body) {
  if (!body) return null;
  if (PATTERNS.youtube.test(body)) {
    const m = body.match(/(?:https?:\/\/)?(?:m\.|www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)[\w\-?=&%]+/i);
    return m ? { type: "youtube", url: m[0].startsWith("http") ? m[0] : "https://" + m[0] } : null;
  }
  if (PATTERNS.tiktok.test(body)) {
    const m = body.match(/(?:https?:\/\/)?(?:www\.|vm\.|vt\.)?tiktok\.com\/[\w@\/\-?=%&.]+/i);
    return m ? { type: "tiktok", url: m[0].startsWith("http") ? m[0] : "https://" + m[0] } : null;
  }
  if (PATTERNS.facebook.test(body)) {
    const m = body.match(/(?:https?:\/\/)?(?:www\.|m\.)?(?:facebook\.com\/(?:watch|reel|videos|share\/v)[^\s]*|fb\.watch\/[^\s]+)/i);
    return m ? { type: "facebook", url: m[0].startsWith("http") ? m[0] : "https://" + m[0] } : null;
  }
  return null;
}

// ── YouTube download ─────────────────────────────────────────────
async function downloadYouTube(url, outPath) {
  // Try ytdl-core first
  try {
    const ytdl = require("@distube/ytdl-core");
    const info  = await ytdl.getInfo(url);
    const title = info.videoDetails.title || "Video";
    const formats = ytdl.filterFormats(info.formats, "videoandaudio");
    const mp4 = formats.filter(f => f.container === "mp4").sort((a,b)=>(parseInt(b.qualityLabel)||0)-(parseInt(a.qualityLabel)||0));
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
    return { title, quality: best.qualityLabel || "SD" };
  } catch {}

  // Fallback API
  const res = await axios.get(
    "https://nayan-video-downloader.vercel.app/alldown?url=" + encodeURIComponent(url),
    { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 25000 }
  );
  const d = res.data;
  if (!d.status || !d.data) throw new Error("API failed");
  const videoUrl = d.data.high || d.data.low;
  if (!videoUrl) throw new Error("no URL");
  const vr = await axios.get(videoUrl, { responseType: "arraybuffer", timeout: 90000, headers: { "User-Agent": "Mozilla/5.0" } });
  fs.writeFileSync(outPath, Buffer.from(vr.data));
  return { title: d.data.title || "YouTube Video", quality: d.data.high ? "HD" : "SD" };
}

// ── TikTok download ──────────────────────────────────────────────
async function downloadTikTok(url, outPath) {
  const apis = [
    async () => {
      const res = await axios.get(
        "https://nayan-video-downloader.vercel.app/alldown?url=" + encodeURIComponent(url),
        { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 20000 }
      );
      const d = res.data;
      if (!d.status || !d.data) throw new Error("no data");
      const videoUrl = d.data.high || d.data.low;
      if (!videoUrl) throw new Error("no URL");
      return videoUrl;
    },
    async () => {
      const res = await axios.post(
        "https://www.tikwm.com/api/",
        new URLSearchParams({ url, hd: "1" }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0" }, timeout: 20000 }
      );
      const d = res.data;
      if (d.code !== 0 || !d.data) throw new Error("tikwm failed");
      const videoUrl = d.data.hdplay || d.data.play;
      if (!videoUrl) throw new Error("no URL");
      return videoUrl;
    },
  ];

  let videoUrl = null;
  for (const fn of apis) {
    try { videoUrl = await fn(); break; } catch {}
  }
  if (!videoUrl) throw new Error("All APIs failed");

  const vr = await axios.get(videoUrl, {
    responseType: "arraybuffer", timeout: 90000,
    headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://www.tiktok.com/" }
  });
  fs.writeFileSync(outPath, Buffer.from(vr.data));
  return { title: "TikTok Video" };
}

// ── Facebook download ────────────────────────────────────────────
async function downloadFacebook(url, outPath) {
  const apis = [
    async () => {
      const res = await axios.get(
        "https://nayan-video-downloader.vercel.app/alldown?url=" + encodeURIComponent(url),
        { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 35000 }
      );
      const d = res.data;
      if (!d.status || !d.data) throw new Error("no data");
      const videoUrl = d.data.high || d.data.low;
      if (!videoUrl) throw new Error("no URL");
      return { videoUrl, quality: d.data.high ? "HD" : "SD" };
    },
    async () => {
      const res = await axios.post(
        "https://fdownloader.net/api/ajaxSearch",
        new URLSearchParams({ q: url, lang: "en" }),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0", "Referer": "https://fdownloader.net/" },
          timeout: 20000
        }
      );
      const html = res.data?.data || "";
      const m = html.match(/href="(https:\/\/[^"]+\.mp4[^"]*)"/i) || html.match(/href="(https:\/\/[^"]+)"[^>]*>(?:HD|SD|720|360)/i);
      if (!m) throw new Error("no link");
      return { videoUrl: m[1].replace(/&amp;/g, "&"), quality: "SD" };
    },
  ];

  let result = null;
  for (const fn of apis) {
    try { result = await fn(); break; } catch {}
  }
  if (!result) throw new Error("All APIs failed");

  const vr = await axios.get(result.videoUrl, { responseType: "arraybuffer", timeout: 90000, headers: { "User-Agent": "Mozilla/5.0" } });
  fs.writeFileSync(outPath, Buffer.from(vr.data));
  return { quality: result.quality };
}

// ── Cooldown store (per thread, prevent spam) ────────────────────
const cooldowns = new Map();
const COOLDOWN_MS = 15000;

// ── Event handler ────────────────────────────────────────────────
module.exports.run = async function ({ api, event }) {
  try {
    const { threadID, messageID, body, senderID, type } = event;
    if (type !== "message" && type !== "message_reply") return;

    // Skip if message starts with prefix (user is using a command)
    const prefix = (global.config && global.config.PREFIX) || "/";
    if (body && body.trim().startsWith(prefix)) return;

    // Skip bot's own messages
    const botID = String(api.getCurrentUserID());
    if (String(senderID) === botID) return;

    // Detect link
    const detected = detectUrl(body);
    if (!detected) return;

    // Cooldown check (per thread)
    const now = Date.now();
    const lastTime = cooldowns.get(threadID) || 0;
    if (now - lastTime < COOLDOWN_MS) return;
    cooldowns.set(threadID, now);

    const { type: dlType, url } = detected;

    // Inform user
    const typeLabel = { youtube: "▶️ YouTube", tiktok: "🎵 TikTok", facebook: "📘 Facebook" }[dlType];
    api.setMessageReaction("⏳", messageID, () => {}, true);
    api.sendMessage(`⬇️ ${typeLabel} link পাওয়া গেছে — download হচ্ছে...`, threadID, messageID);

    const ext     = "mp4";
    const filename = `autodown_${dlType}_${Date.now()}.${ext}`;
    const outPath  = path.join(CACHE_DIR, filename);

    let meta = {};
    try {
      if (dlType === "youtube")  meta = await downloadYouTube(url, outPath);
      if (dlType === "tiktok")   meta = await downloadTikTok(url, outPath);
      if (dlType === "facebook") meta = await downloadFacebook(url, outPath);
    } catch (err) {
      try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch {}
      api.setMessageReaction("❌", messageID, () => {}, true);
      return api.sendMessage(
        `❌ Download ব্যর্থ!\n⚠️ ${err.message}\n\n💡 Link টি public হতে হবে।`,
        threadID, messageID
      );
    }

    if (!fs.existsSync(outPath)) {
      api.setMessageReaction("❌", messageID, () => {}, true);
      return api.sendMessage("❌ File download হয়নি।", threadID, messageID);
    }

    const sizeMB = fs.statSync(outPath).size / (1024 * 1024);
    if (sizeMB < 0.01) {
      fs.unlinkSync(outPath);
      api.setMessageReaction("❌", messageID, () => {}, true);
      return api.sendMessage("❌ File empty — link expired হয়ে গেছে।", threadID, messageID);
    }
    if (sizeMB > MAX_MB) {
      fs.unlinkSync(outPath);
      api.setMessageReaction("❌", messageID, () => {}, true);
      return api.sendMessage(`❌ File too large (${sizeMB.toFixed(1)} MB). Max: ${MAX_MB} MB.`, threadID, messageID);
    }

    let bodyMsg = `${typeLabel} Video\n`;
    if (meta.title)   bodyMsg += `📝 ${meta.title.slice(0, 80)}\n`;
    if (meta.quality) bodyMsg += `🎬 Quality: ${meta.quality}\n`;
    bodyMsg += `📦 ${sizeMB.toFixed(1)} MB\n⚡ MOSTAKIM V2 BOT`;

    await api.sendMessage(
      { body: bodyMsg, attachment: fs.createReadStream(outPath) },
      threadID,
      () => { try { fs.unlinkSync(outPath); } catch {} },
      messageID
    );
    api.setMessageReaction("✅", messageID, () => {}, true);

  } catch (e) {
    console.error("[autodown event error]", e && e.message);
  }
};
