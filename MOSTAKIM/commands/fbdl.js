const axios = require("axios");
const fs    = require("fs-extra");
const path  = require("path");

module.exports.config = {
  name:            "fbdl",
  aliases:         ["fbd", "fbdown", "facebook"],
  version:         "2.1.0",
  hasPermssion:    0,
  credits:         "MOSTAKIM",
  description:     "Facebook video download করো (video/reel/watch)",
  commandCategory: "media",
  usages:          "fbdl <facebook link>",
  cooldowns:       10,
};

const CACHE_DIR = path.join(process.cwd(), "tmp");
fs.ensureDirSync(CACHE_DIR);
const MAX_MB = 50;

async function fetchFbVideo(url) {
  const apis = [
    // API 1: Nayan downloader — works, needs 35s timeout
    async () => {
      const res = await axios.get(
        "https://nayan-video-downloader.vercel.app/alldown?url=" + encodeURIComponent(url),
        { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 35000 }
      );
      const d = res.data;
      if (!d.status || !d.data) throw new Error("no data");
      const videoUrl = d.data.high || d.data.low;
      if (!videoUrl) throw new Error("no video URL");
      return { videoUrl, quality: d.data.high ? "HD" : "SD" };
    },

    // API 2: snapcdn via savefrom-style token URL
    async () => {
      const res = await axios.get(
        "https://worker.sf-tools.com/savefrom.php?sf_url=" + encodeURIComponent(url),
        { headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://en.savefrom.net/" }, timeout: 20000 }
      );
      const d = res.data;
      if (typeof d !== "object" || d === "ok") throw new Error("sf-tools no data");
      const links = d.url || d.urls || [];
      const best  = Array.isArray(links) ? links.find(l => l.url) : null;
      if (!best?.url) throw new Error("sf-tools no url");
      return { videoUrl: best.url, quality: best.meta || "SD" };
    },

    // API 3: fdownloader.net
    async () => {
      const res = await axios.post(
        "https://fdownloader.net/api/ajaxSearch",
        new URLSearchParams({ q: url, lang: "en" }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://fdownloader.net/"
          },
          timeout: 20000
        }
      );
      const html = res.data?.data || "";
      const hdMatch = html.match(/href="(https:\/\/[^"]+)"[^>]*>(?:HD|720)/i);
      const sdMatch = html.match(/href="(https:\/\/[^"]+)"[^>]*>(?:SD|360)/i);
      const anyMatch = html.match(/href="(https:\/\/[^"]+\.mp4[^"]*)"/i);
      const link = hdMatch?.[1] || sdMatch?.[1] || anyMatch?.[1];
      if (!link) throw new Error("no link found");
      return { videoUrl: link.replace(/&amp;/g, "&"), quality: hdMatch ? "HD" : "SD" };
    }
  ];

  for (const fn of apis) {
    try { return await fn(); } catch {}
  }
  throw new Error("সব API ব্যর্থ। Public video/reel link দাও এবং আবার চেষ্টা করো।");
}

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  const url = args.join(" ").trim();

  if (!url || !url.startsWith("http")) {
    return api.sendMessage(
      "📘 Facebook Video Downloader\n━━━━━━━━━━━━━━━\n📌 Usage: fbdl <link>\n\n✅ Supported:\n▸ facebook.com/watch\n▸ facebook.com/videos/\n▸ facebook.com/reel/\n▸ fb.watch/",
      threadID, messageID
    );
  }

  if (!/facebook\.com|fb\.watch/i.test(url)) {
    return api.sendMessage("❌ Facebook link দাও।\nExample: https://www.facebook.com/reel/...", threadID, messageID);
  }

  api.setMessageReaction("⏳", messageID, () => {}, true);
  api.sendMessage("⏳ Facebook video download হচ্ছে, একটু অপেক্ষা করো...", threadID, messageID);

  try {
    const { videoUrl, quality } = await fetchFbVideo(url);
    const filename = `fbdl_${Date.now()}.mp4`;
    const outPath  = path.join(CACHE_DIR, filename);

    const vr = await axios.get(videoUrl, {
      responseType: "arraybuffer",
      timeout: 90000,
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    fs.writeFileSync(outPath, Buffer.from(vr.data));

    const sizeMB = fs.statSync(outPath).size / (1024 * 1024);
    if (sizeMB < 0.01) {
      fs.unlinkSync(outPath);
      throw new Error("File empty — link expired হয়ে গেছে, আবার চেষ্টা করো।");
    }
    if (sizeMB > MAX_MB) {
      fs.unlinkSync(outPath);
      return api.sendMessage(`❌ Video too large (${sizeMB.toFixed(1)} MB). Max: ${MAX_MB} MB.`, threadID, messageID);
    }

    await api.sendMessage(
      { body: `📘 Facebook Video\n🎬 Quality: ${quality}\n📦 ${sizeMB.toFixed(1)} MB\n⚡ MOSTAKIM V2 BOT`, attachment: fs.createReadStream(outPath) },
      threadID,
      () => { try { fs.unlinkSync(outPath); } catch {} },
      messageID
    );
    api.setMessageReaction("✅", messageID, () => {}, true);
  } catch (err) {
    api.setMessageReaction("❌", messageID, () => {}, true);
    api.sendMessage(
      `❌ Facebook download ব্যর্থ!\n⚠️ ${err.message}\n\n💡 Tips:\n▸ Video টি public হতে হবে\n▸ Reel বা Watch link দাও`,
      threadID, messageID
    );
  }
};
