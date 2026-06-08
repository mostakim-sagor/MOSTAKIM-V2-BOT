"use strict";

const axios = require("axios");
const fs    = require("fs-extra");
const path  = require("path");

const CACHE_DIR = path.join(process.cwd(), "tmp");
fs.ensureDirSync(CACHE_DIR);
const MAX_MB = 50;

const PATTERNS = {
  youtube:   /youtu\.be\/|youtube\.com\/(?:watch|shorts|embed|live)/i,
  tiktok:    /tiktok\.com|vm\.tiktok|vt\.tiktok/i,
  facebook:  /facebook\.com|fb\.watch/i,
  instagram: /instagram\.com\/(?:p|reel|tv|stories)\//i,
  twitter:   /(?:twitter|x)\.com\/\S+\/status\//i,
  pinterest: /pinterest\.com\/pin\/|pin\.it\//i,
};

const LABELS = {
  youtube:   "▶️ YouTube",
  tiktok:    "🎵 TikTok",
  facebook:  "📘 Facebook",
  instagram: "📸 Instagram",
  twitter:   "🐦 Twitter / X",
  pinterest: "📌 Pinterest",
};

function detectPlatform(text) {
  const m = text.match(/https?:\/\/[^\s<>"]+/);
  if (!m) return null;
  const url = m[0];
  for (const [platform, pat] of Object.entries(PATTERNS)) {
    if (pat.test(url)) return { platform, url };
  }
  return null;
}

// ── Nayan universal API (works for most platforms) ────────────────────────────
async function nayanDownload(url) {
  const res = await axios.get(
    "https://nayan-video-downloader.vercel.app/alldown?url=" + encodeURIComponent(url),
    { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 35000 }
  );
  const d = res.data;
  if (!d.status || !d.data) throw new Error("nayan: no data");
  const videoUrl = d.data.high || d.data.low || d.data.url;
  if (!videoUrl) throw new Error("nayan: no video URL");
  return { videoUrl, title: d.data.title || "Video" };
}

// ── TikTok via tikwm (no watermark) ──────────────────────────────────────────
async function tikwmDownload(url) {
  const res = await axios.post(
    "https://www.tikwm.com/api/",
    new URLSearchParams({ url, hd: "1" }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0" }, timeout: 20000 }
  );
  const d = res.data;
  if (d.code !== 0 || !d.data) throw new Error(d.msg || "tikwm failed");
  const videoUrl = d.data.hdplay || d.data.play;
  if (!videoUrl) throw new Error("no URL");
  return { videoUrl, title: d.data.title || "TikTok Video" };
}

// ── YouTube via ytdl-core ─────────────────────────────────────────────────────
async function ytdlCoreDownload(url, outPath) {
  const ytdl = require("@distube/ytdl-core");
  const info  = await ytdl.getInfo(url);
  const title = info.videoDetails.title || "Video";
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
}

// ── Instagram via igram ───────────────────────────────────────────────────────
async function igramDownload(url) {
  const res = await axios.post(
    "https://igram.world/api/convert",
    new URLSearchParams({ url, lang: "en" }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://igram.world/",
        "Origin": "https://igram.world"
      },
      timeout: 20000
    }
  );
  const d = res.data;
  const items = d.info || d.result || d.data || [];
  const list  = Array.isArray(items) ? items : [items];
  const media = list.filter(i => i.url && i.url.includes(".mp4"));
  if (!media.length) throw new Error("igram: no video");
  return { videoUrl: media[0].url, title: "Instagram Video" };
}

// ── Main download logic ───────────────────────────────────────────────────────
async function processDownload(url, platform, threadID, messageID, api) {
  const filename   = `autodl_${Date.now()}.mp4`;
  const outputPath = path.join(CACHE_DIR, filename);

  api.setMessageReaction("⏳", messageID, () => {}, true);
  api.sendMessage(`⬇️ ${LABELS[platform]} download হচ্ছে...`, threadID, messageID);

  let title = "Video";

  try {
    if (platform === "youtube") {
      try {
        const r = await ytdlCoreDownload(url, outputPath);
        title = r.title;
      } catch {
        const r = await nayanDownload(url);
        title = r.title;
        const vr = await axios.get(r.videoUrl, { responseType: "arraybuffer", timeout: 90000, headers: { "User-Agent": "Mozilla/5.0" } });
        fs.writeFileSync(outputPath, Buffer.from(vr.data));
      }

    } else if (platform === "tiktok") {
      let r;
      try { r = await tikwmDownload(url); }
      catch { r = await nayanDownload(url); }
      title = r.title;
      const vr = await axios.get(r.videoUrl, { responseType: "arraybuffer", timeout: 90000, headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://www.tiktok.com/" } });
      fs.writeFileSync(outputPath, Buffer.from(vr.data));

    } else if (platform === "instagram") {
      let r;
      try { r = await igramDownload(url); }
      catch { r = await nayanDownload(url); }
      title = r.title;
      const vr = await axios.get(r.videoUrl, { responseType: "arraybuffer", timeout: 90000, headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://www.instagram.com/" } });
      fs.writeFileSync(outputPath, Buffer.from(vr.data));

    } else {
      // Facebook, Twitter, Pinterest — nayan universal API
      const r = await nayanDownload(url);
      title = r.title;
      const vr = await axios.get(r.videoUrl, { responseType: "arraybuffer", timeout: 90000, headers: { "User-Agent": "Mozilla/5.0" } });
      fs.writeFileSync(outputPath, Buffer.from(vr.data));
    }

    if (!fs.existsSync(outputPath)) throw new Error("File download হয়নি");

    const sizeMB = fs.statSync(outputPath).size / (1024 * 1024);
    if (sizeMB < 0.01) {
      fs.unlinkSync(outputPath);
      throw new Error("File empty — link expired বা private হতে পারে");
    }
    if (sizeMB > MAX_MB) {
      fs.unlinkSync(outputPath);
      throw new Error(`File too large (${sizeMB.toFixed(1)} MB). Max: ${MAX_MB} MB`);
    }

    const body =
      `📥 𝗔𝘂𝘁𝗼 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱𝗲𝗿\n` +
      `${LABELS[platform]}\n` +
      `🎬 ${title.slice(0, 80)}\n` +
      `📦 ${sizeMB.toFixed(1)} MB\n` +
      `⚡ MOSTAKIM V2 BOT`;

    await api.sendMessage(
      { body, attachment: fs.createReadStream(outputPath) },
      threadID,
      () => { try { fs.unlinkSync(outputPath); } catch {} },
      messageID
    );
    api.setMessageReaction("✅", messageID, () => {}, true);

  } catch (err) {
    try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch {}
    api.setMessageReaction("❌", messageID, () => {}, true);
    api.sendMessage(
      `❌ Download ব্যর্থ!\n🌐 Platform: ${LABELS[platform]}\n⚠️ ${err.message}\n\n💡 Link টি public হতে হবে।`,
      threadID, messageID
    );
  }
}

// ── Command config ────────────────────────────────────────────────────────────
module.exports.config = {
  name:            "autodl",
  version:         "3.0.0",
  hasPermssion:    0,
  credits:         "MOSTAKIM",
  description:     "যেকোনো platform এর video link download করো (YouTube, TikTok, FB, IG, Twitter, Pinterest)",
  commandCategory: "media",
  usages:          "autodl <link>",
  cooldowns:       10,
};

// ── Manual command ────────────────────────────────────────────────────────────
module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  const link = args.join(" ").trim();

  if (!link) {
    return api.sendMessage(
      `📥 𝗔𝘂𝘁𝗼 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱𝗲𝗿\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `✅ Supported:\n` +
      `▶️ YouTube\n🎵 TikTok\n📘 Facebook\n📸 Instagram\n🐦 Twitter/X\n📌 Pinterest\n\n` +
      `📌 Usage: /autodl <link>`,
      threadID, messageID
    );
  }

  const detected = detectPlatform(link);
  if (!detected) {
    return api.sendMessage(
      `❌ Unsupported link!\n✅ Supported: YouTube, TikTok, Facebook, Instagram, Twitter/X, Pinterest`,
      threadID, messageID
    );
  }

  await processDownload(detected.url, detected.platform, threadID, messageID, api);
};
