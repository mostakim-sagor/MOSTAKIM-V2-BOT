const axios = require("axios");
const fs    = require("fs-extra");
const path  = require("path");

module.exports.config = {
  name:            "igdl",
  aliases:         ["igd", "igdown", "insta", "instagram"],
  version:         "2.1.0",
  hasPermssion:    0,
  credits:         "MOSTAKIM",
  description:     "Instagram video/reel/story download করো",
  commandCategory: "media",
  usages:          "igdl <instagram link>",
  cooldowns:       10,
};

const CACHE_DIR = path.join(process.cwd(), "tmp");
fs.ensureDirSync(CACHE_DIR);
const MAX_MB = 50;

async function fetchIgMedia(url) {
  const apis = [
    // API 1: igram.world JSON API
    async () => {
      const res = await axios.post(
        "https://igram.world/api/convert",
        new URLSearchParams({ url, lang: "en" }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://igram.world/",
            "Origin": "https://igram.world"
          },
          timeout: 20000
        }
      );
      const d = res.data;
      if (d.code && d.code !== "SUCCESS") throw new Error("igram: " + (d.info || d.code));
      const items = d.info || d.result || d.data || [];
      const list  = Array.isArray(items) ? items : [items];
      const media = list.filter(i => i.url || i.download_url).map(i => ({
        url:  (i.url || i.download_url).replace(/&amp;/g, "&"),
        type: i.type || (i.url?.includes(".mp4") ? "video" : "image")
      }));
      if (!media.length) throw new Error("igram: no media");
      return media;
    },

    // API 2: snapsave.app — parse HTML response
    async () => {
      const res = await axios.post(
        "https://snapsave.app/action.php",
        new URLSearchParams({ url }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://snapsave.app/"
          },
          timeout: 20000
        }
      );
      const raw = String(res.data || "");

      // snapsave returns obfuscated JS — decode the string inside it
      // Pattern: var _0x...=["","split",... actual content is base64/encoded table
      // Try to find direct CDN URLs embedded in the string
      const cdnUrls = [...raw.matchAll(/https:\\x2F\\x2F[^\\'"]+\.(?:mp4|jpg|jpeg|png)[^\\'"]{0,200}/g)];
      if (cdnUrls.length) {
        return cdnUrls.slice(0, 4).map(m => ({
          url:  m[0].replace(/\\x2F/g, "/").replace(/\\u0026/g, "&"),
          type: m[0].includes("mp4") ? "video" : "image"
        }));
      }

      // Try standard href pattern
      const hrefMatches = [...raw.matchAll(/href=\\?"(https?:\/\/[^\\?"]{20,}\.(?:mp4|jpg|jpeg|png)[^\\?"]*)\\?"/g)];
      if (hrefMatches.length) {
        return hrefMatches.slice(0, 4).map(m => ({
          url:  m[1].replace(/&amp;/g, "&"),
          type: m[1].includes("mp4") ? "video" : "image"
        }));
      }
      throw new Error("snapsave: no media found");
    },

    // API 3: Instagram OGP meta — public posts with Facebook bot UA
    async () => {
      const res = await axios.get(url, {
        headers: {
          "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9"
        },
        timeout: 15000,
        maxRedirects: 5
      });
      const html = res.data || "";
      const videoMeta = html.match(/<meta[^>]+property=["']og:video(?::url)?["'][^>]+content=["']([^"']+)["']/i)
                     || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video(?::url)?["']/i);
      const imageMeta = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
                     || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

      const results = [];
      if (videoMeta?.[1] && !videoMeta[1].includes("static.cdninstagram.com/rsrc")) {
        results.push({ url: videoMeta[1], type: "video" });
      }
      if (imageMeta?.[1] && !imageMeta[1].includes("44x44") && !imageMeta[1].includes("150x150")) {
        results.push({ url: imageMeta[1], type: "image" });
      }
      if (!results.length) throw new Error("OGP: no media meta found");
      return results;
    }
  ];

  for (const fn of apis) {
    try { return await fn(); } catch {}
  }
  throw new Error("সব API ব্যর্থ। Public post এর link দাও এবং আবার চেষ্টা করো।");
}

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  const url = args.join(" ").trim();

  if (!url || !url.startsWith("http")) {
    return api.sendMessage(
      "📸 Instagram Downloader\n━━━━━━━━━━━━━━━\n📌 Usage: igdl <link>\n\n✅ Supported:\n▸ instagram.com/p/\n▸ instagram.com/reel/\n▸ instagram.com/tv/\n▸ instagram.com/stories/",
      threadID, messageID
    );
  }

  if (!/instagram\.com/i.test(url)) {
    return api.sendMessage("❌ Instagram link দাও।\nExample: https://www.instagram.com/reel/...", threadID, messageID);
  }

  api.setMessageReaction("⏳", messageID, () => {}, true);
  api.sendMessage("⏳ Instagram download হচ্ছে, একটু অপেক্ষা করো...", threadID, messageID);

  try {
    const items = await fetchIgMedia(url);
    const attachments = [];
    const tmpFiles    = [];

    for (let i = 0; i < Math.min(items.length, 4); i++) {
      const item = items[i];
      const ext  = item.type === "image" ? "jpg"
                 : item.url.match(/\.(jpg|jpeg|png)/)?.[1] || "mp4";
      const outPath = path.join(CACHE_DIR, `igdl_${Date.now()}_${i}.${ext}`);

      const vr = await axios.get(item.url, {
        responseType: "arraybuffer",
        timeout: 90000,
        headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://www.instagram.com/" }
      });
      fs.writeFileSync(outPath, Buffer.from(vr.data));

      const sizeMB = fs.statSync(outPath).size / (1024 * 1024);
      if (sizeMB < 0.001 || sizeMB > MAX_MB) { try { fs.unlinkSync(outPath); } catch {} continue; }

      attachments.push(fs.createReadStream(outPath));
      tmpFiles.push(outPath);
    }

    if (!attachments.length) throw new Error("কোনো media download হয়নি। Public post এর link দাও।");

    const label = items.length > 1 ? `📸 Instagram (${attachments.length} media)` : "📸 Instagram";
    await api.sendMessage(
      { body: `${label}\n⚡ MOSTAKIM V2 BOT`, attachment: attachments },
      threadID,
      () => { tmpFiles.forEach(f => { try { fs.unlinkSync(f); } catch {} }); },
      messageID
    );
    api.setMessageReaction("✅", messageID, () => {}, true);
  } catch (err) {
    api.setMessageReaction("❌", messageID, () => {}, true);
    api.sendMessage(
      `❌ Instagram download ব্যর্থ!\n⚠️ ${err.message}\n\n💡 Tips:\n▸ Post টি public হতে হবে\n▸ Reel বা Post link দাও\n▸ Story হলে কাজ না-ও করতে পারে`,
      threadID, messageID
    );
  }
};
