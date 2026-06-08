const axios = require("axios");
const fs    = require("fs-extra");
const path  = require("path");

module.exports.config = {
  name:            "pindl",
  aliases:         ["pin", "pindown", "pinterest"],
  version:         "2.0.0",
  hasPermssion:    0,
  credits:         "MOSTAKIM",
  description:     "Pinterest video/image download করো",
  commandCategory: "media",
  usages:          "pindl <pinterest link>",
  cooldowns:       10,
};

const CACHE_DIR = path.join(process.cwd(), "tmp");
fs.ensureDirSync(CACHE_DIR);
const MAX_MB = 30;

async function fetchPinterest(url) {
  const apis = [
    // API 1: Nayan downloader
    async () => {
      const res = await axios.get(
        "https://nayan-video-downloader.vercel.app/alldown?url=" + encodeURIComponent(url),
        { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 20000 }
      );
      const d = res.data;
      if (!d.status || !d.data) throw new Error("no data");
      const mediaUrl = d.data.high || d.data.low || d.data.url;
      if (!mediaUrl || mediaUrl.includes("unsplash")) throw new Error("no real Pinterest media URL");
      return { mediaUrl, type: mediaUrl.includes(".mp4") ? "video" : "image" };
    },

    // API 2: pintdownloader.com — parse HTML for pinimg CDN links
    async () => {
      const res = await axios.post(
        "https://pintdownloader.com/",
        new URLSearchParams({ url }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://pintdownloader.com/",
            "Origin": "https://pintdownloader.com"
          },
          timeout: 20000,
          maxRedirects: 10
        }
      );
      const html = res.data || "";
      const mp4  = html.match(/https?:\/\/[^"'\s]*v1\.pinimg\.com[^"'\s]*\.mp4[^"'\s]*/);
      const jpg  = html.match(/https?:\/\/[^"'\s]*(?:i|v\d*)\.pinimg\.com[^"'\s]*\.(?:jpg|jpeg|png)[^"'\s]*/);
      const link = mp4?.[0] || jpg?.[0];
      if (!link) throw new Error("no pinimg link in HTML");
      return { mediaUrl: link.replace(/&amp;/g, "&"), type: mp4 ? "video" : "image" };
    },

    // API 3: Facebook external hit bot — get OGP meta tags
    async () => {
      const res = await axios.get(url, {
        headers: {
          "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9"
        },
        timeout: 15000,
        maxRedirects: 10
      });
      const html = res.data || "";
      const videoMeta = html.match(/<meta[^>]+property="og:video(?::url)?"[^>]+content="([^"]+)"/i)
                     || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:video(?::url)?"/i);
      const imageMeta = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)
                     || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);
      const link = videoMeta?.[1] || imageMeta?.[1];
      if (!link || link.includes("75x75") || link.length < 20) throw new Error("no usable OGP media");
      return { mediaUrl: link, type: videoMeta ? "video" : "image" };
    }
  ];

  for (const fn of apis) {
    try { return await fn(); } catch {}
  }
  throw new Error("Pinterest download এখন কাজ করছে না। Public pin link দিন এবং আবার চেষ্টা করুন।");
}

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  const url = args.join(" ").trim();

  if (!url || !url.startsWith("http")) {
    return api.sendMessage(
      "📌 Pinterest Downloader\n━━━━━━━━━━━━━━━\n📌 Usage: pindl <link>\n\n✅ Supported:\n▸ pinterest.com/pin/\n▸ pin.it/ (short link)\n\n💡 Video ও Image দুটোই download হবে!",
      threadID, messageID
    );
  }

  if (!/pinterest\.com|pin\.it/i.test(url)) {
    return api.sendMessage("❌ Pinterest link দাও।\nExample: https://pin.it/... অথবা https://www.pinterest.com/pin/...", threadID, messageID);
  }

  api.setMessageReaction("⏳", messageID, () => {}, true);
  api.sendMessage("⏳ Pinterest download হচ্ছে, একটু অপেক্ষা করো...", threadID, messageID);

  try {
    const { mediaUrl, type } = await fetchPinterest(url);
    const ext      = type === "image" ? "jpg" : "mp4";
    const filename = `pindl_${Date.now()}.${ext}`;
    const outPath  = path.join(CACHE_DIR, filename);

    const vr = await axios.get(mediaUrl, {
      responseType: "arraybuffer",
      timeout: 60000,
      headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://www.pinterest.com/" }
    });
    fs.writeFileSync(outPath, Buffer.from(vr.data));

    const sizeMB = fs.statSync(outPath).size / (1024 * 1024);
    if (sizeMB < 0.001) {
      fs.unlinkSync(outPath);
      throw new Error("File empty — Pinterest media আনা যায়নি।");
    }
    if (sizeMB > MAX_MB) {
      fs.unlinkSync(outPath);
      return api.sendMessage(`❌ File too large (${sizeMB.toFixed(1)} MB). Max: ${MAX_MB} MB.`, threadID, messageID);
    }

    const label = type === "image" ? "📌 Pinterest Image" : "📌 Pinterest Video";
    await api.sendMessage(
      { body: `${label}\n📦 ${sizeMB.toFixed(1)} MB\n⚡ MOSTAKIM V2 BOT`, attachment: fs.createReadStream(outPath) },
      threadID,
      () => { try { fs.unlinkSync(outPath); } catch {} },
      messageID
    );
    api.setMessageReaction("✅", messageID, () => {}, true);
  } catch (err) {
    api.setMessageReaction("❌", messageID, () => {}, true);
    api.sendMessage(
      `❌ Pinterest download ব্যর্থ!\n⚠️ ${err.message}\n\n💡 Tips:\n▸ Pin টি public হতে হবে\n▸ Direct /pin/ link দাও\n▸ pin.it short link ও চেষ্টা করো`,
      threadID, messageID
    );
  }
};
