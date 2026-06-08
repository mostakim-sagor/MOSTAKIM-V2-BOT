const axios = require("axios");
const fs    = require("fs-extra");
const path  = require("path");

module.exports.config = {
  name:            "ytdl",
  aliases:         ["yt", "ytdown", "ytv"],
  version:         "2.0.0",
  hasPermssion:    0,
  credits:         "MOSTAKIM",
  description:     "YouTube video/shorts/audio download করো",
  commandCategory: "media",
  usages:          "ytdl <link> | ytdl audio <link>",
  cooldowns:       15,
};

const CACHE_DIR = path.join(process.cwd(), "tmp");
fs.ensureDirSync(CACHE_DIR);
const MAX_MB = 50;

async function downloadYouTube(url, audioOnly, outPath) {
  const ytdl = require("@distube/ytdl-core");

  const info    = await ytdl.getInfo(url);
  const title   = info.videoDetails.title || "Video";
  const uploader = info.videoDetails.author?.name || "";
  const duration = info.videoDetails.lengthSeconds;
  const mins    = Math.floor(duration / 60);
  const secs    = duration % 60;
  const durationStr = `${mins}:${secs.toString().padStart(2, "0")}`;

  let stream;
  if (audioOnly) {
    const formats = ytdl.filterFormats(info.formats, "audioonly");
    const best = formats.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];
    if (!best) throw new Error("Audio format পাওয়া যায়নি।");
    stream = ytdl.downloadFromInfo(info, { format: best });
  } else {
    const formats = ytdl.filterFormats(info.formats, "videoandaudio");
    const mp4     = formats.filter(f => f.container === "mp4").sort((a, b) => {
      const qa = parseInt(a.qualityLabel) || 0;
      const qb = parseInt(b.qualityLabel) || 0;
      return qb - qa;
    });
    const best = mp4[0] || formats[0];
    if (!best) throw new Error("Video format পাওয়া যায়নি।");
    stream = ytdl.downloadFromInfo(info, { format: best });
  }

  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(outPath);
    stream.pipe(writer);
    stream.on("error", reject);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });

  return { title, uploader, durationStr };
}

async function downloadYouTubeViaAPI(url, outPath) {
  const res = await axios.get(
    "https://nayan-video-downloader.vercel.app/alldown?url=" + encodeURIComponent(url),
    { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 25000 }
  );
  const d = res.data;
  if (!d.status || !d.data) throw new Error("API no data");
  const videoUrl = d.data.high || d.data.low;
  if (!videoUrl) throw new Error("API no URL");

  const vr = await axios.get(videoUrl, {
    responseType: "arraybuffer",
    timeout: 90000,
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  fs.writeFileSync(outPath, Buffer.from(vr.data));

  return { title: d.data.title || "Video", uploader: "", durationStr: "" };
}

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;

  if (!args[0]) {
    return api.sendMessage(
      "▶️ YouTube Downloader\n━━━━━━━━━━━━━━━\n📌 Usage:\n▸ ytdl <link>          — video\n▸ ytdl audio <link>    — mp3 audio\n\n✅ Supported:\n▸ youtube.com/watch\n▸ youtu.be/\n▸ youtube.com/shorts/",
      threadID, messageID
    );
  }

  const audioOnly = args[0].toLowerCase() === "audio";
  const url = audioOnly ? args.slice(1).join(" ").trim() : args.join(" ").trim();

  if (!url || !url.startsWith("http")) {
    return api.sendMessage("❌ YouTube link দাও।\nExample: https://youtu.be/...", threadID, messageID);
  }
  if (!/youtube\.com|youtu\.be/i.test(url)) {
    return api.sendMessage("❌ YouTube link দাও।", threadID, messageID);
  }

  api.setMessageReaction("⏳", messageID, () => {}, true);
  api.sendMessage("⏳ YouTube download হচ্ছে, একটু অপেক্ষা করো...", threadID, messageID);

  const ext      = audioOnly ? "mp3" : "mp4";
  const filename = `ytdl_${Date.now()}.${ext}`;
  const outPath  = path.join(CACHE_DIR, filename);

  try {
    let info = { title: "Video", uploader: "", durationStr: "" };

    try {
      info = await downloadYouTube(url, audioOnly, outPath);
    } catch {
      info = await downloadYouTubeViaAPI(url, outPath);
    }

    if (!fs.existsSync(outPath)) throw new Error("File download হয়নি।");

    const sizeMB = fs.statSync(outPath).size / (1024 * 1024);
    if (sizeMB < 0.01) {
      fs.unlinkSync(outPath);
      throw new Error("File empty — আবার চেষ্টা করো।");
    }
    if (sizeMB > MAX_MB) {
      fs.unlinkSync(outPath);
      return api.sendMessage(`❌ File too large (${sizeMB.toFixed(1)} MB). Max: ${MAX_MB} MB.`, threadID, messageID);
    }

    const body =
      `▶️ YouTube ${audioOnly ? "Audio 🎵" : "Video"}\n` +
      (info.title    ? `📝 ${info.title.slice(0, 80)}\n` : "") +
      (info.durationStr ? `⏱️ ${info.durationStr}\n` : "") +
      (info.uploader ? `👤 ${info.uploader}\n` : "") +
      `📦 ${sizeMB.toFixed(1)} MB\n⚡ MOSTAKIM V2 BOT`;

    await api.sendMessage(
      { body, attachment: fs.createReadStream(outPath) },
      threadID,
      () => { try { fs.unlinkSync(outPath); } catch {} },
      messageID
    );
    api.setMessageReaction("✅", messageID, () => {}, true);
  } catch (err) {
    try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch {}
    api.setMessageReaction("❌", messageID, () => {}, true);
    api.sendMessage(`❌ YouTube download ব্যর্থ!\n⚠️ ${err.message}`, threadID, messageID);
  }
};
