const axios = require("axios");
const fs    = require("fs-extra");
const path  = require("path");

module.exports.config = {
  name:            "ttdl",
  aliases:         ["ttd", "tiktok", "ttkdown"],
  version:         "2.0.0",
  hasPermssion:    0,
  credits:         "MOSTAKIM",
  description:     "TikTok video watermark ছাড়া download করো",
  commandCategory: "media",
  usages:          "ttdl <tiktok link>",
  cooldowns:       10,
};

const CACHE_DIR = path.join(process.cwd(), "tmp");
fs.ensureDirSync(CACHE_DIR);
const MAX_MB = 50;

async function fetchTikTok(url) {
  const apis = [
    async () => {
      const res = await axios.get(
        "https://nayan-video-downloader.vercel.app/alldown?url=" + encodeURIComponent(url),
        { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 20000 }
      );
      const d = res.data;
      if (!d.status || !d.data) throw new Error("no data");
      const videoUrl = d.data.high || d.data.low;
      if (!videoUrl) throw new Error("no video URL");
      return { videoUrl, title: d.data.title || "TikTok Video", author: "" };
    },
    async () => {
      const res = await axios.post(
        "https://ssstik.io/abc?url=dl",
        new URLSearchParams({ id: url, locale: "en", tt: "aTVhTk5z" }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://ssstik.io/en"
          },
          timeout: 20000
        }
      );
      const html = res.data || "";
      const match = html.match(/href="(https:\/\/tikcdn\.io\/ssstik\/[^"]+)"/);
      if (!match) throw new Error("ssstik: no URL");
      return { videoUrl: match[1], title: "TikTok Video", author: "" };
    },
    async () => {
      const res = await axios.post(
        "https://www.tikwm.com/api/",
        new URLSearchParams({ url, hd: "1" }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0" }, timeout: 20000 }
      );
      const d = res.data;
      if (d.code !== 0 || !d.data) throw new Error(d.msg || "tikwm failed");
      const videoUrl = d.data.hdplay || d.data.play;
      if (!videoUrl) throw new Error("no URL");
      return { videoUrl, title: d.data.title || "TikTok Video", author: d.data.author?.nickname || "" };
    }
  ];

  for (const fn of apis) {
    try { return await fn(); } catch {}
  }
  throw new Error("সব API ব্যর্থ। আবার চেষ্টা করো।");
}

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  const url = args.join(" ").trim();

  if (!url || !url.startsWith("http")) {
    return api.sendMessage(
      "🎵 TikTok Downloader\n━━━━━━━━━━━━━━━\n📌 Usage: ttdl <link>\n\n✅ Supported:\n▸ tiktok.com/@user/video/\n▸ vm.tiktok.com/\n▸ vt.tiktok.com/\n\n💡 Watermark ছাড়া download হবে!",
      threadID, messageID
    );
  }

  if (!/tiktok\.com|vm\.tiktok|vt\.tiktok/i.test(url)) {
    return api.sendMessage("❌ TikTok link দাও।\nExample: https://vm.tiktok.com/...", threadID, messageID);
  }

  api.setMessageReaction("⏳", messageID, () => {}, true);
  api.sendMessage("⏳ TikTok download হচ্ছে, একটু অপেক্ষা করো...", threadID, messageID);

  try {
    const { videoUrl, title, author } = await fetchTikTok(url);
    const filename = `ttdl_${Date.now()}.mp4`;
    const outPath  = path.join(CACHE_DIR, filename);

    const vr = await axios.get(videoUrl, {
      responseType: "arraybuffer",
      timeout: 90000,
      headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://www.tiktok.com/" }
    });
    fs.writeFileSync(outPath, Buffer.from(vr.data));

    const sizeMB = fs.statSync(outPath).size / (1024 * 1024);
    if (sizeMB < 0.01) {
      fs.unlinkSync(outPath);
      throw new Error("File empty — link expired, আবার চেষ্টা করো।");
    }
    if (sizeMB > MAX_MB) {
      fs.unlinkSync(outPath);
      return api.sendMessage(`❌ Video too large (${sizeMB.toFixed(1)} MB). Max: ${MAX_MB} MB.`, threadID, messageID);
    }

    const body =
      `🎵 TikTok Video\n` +
      (author ? `👤 @${author}\n` : "") +
      (title  ? `📝 ${title.slice(0, 80)}\n` : "") +
      `📦 ${sizeMB.toFixed(1)} MB\n⚡ MOSTAKIM V2 BOT`;

    await api.sendMessage(
      { body, attachment: fs.createReadStream(outPath) },
      threadID,
      () => { try { fs.unlinkSync(outPath); } catch {} },
      messageID
    );
    api.setMessageReaction("✅", messageID, () => {}, true);
  } catch (err) {
    api.setMessageReaction("❌", messageID, () => {}, true);
    api.sendMessage(`❌ TikTok download ব্যর্থ!\n⚠️ ${err.message}`, threadID, messageID);
  }
};
