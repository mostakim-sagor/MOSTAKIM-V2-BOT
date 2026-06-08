const axios = require("axios");
const yts   = require("yt-search");
const fs    = require("fs");
const path  = require("path");

module.exports.config = {
  name:             "sing",
  aliases:          ["song", "music", "play"],
  version:          "1.0.0",
  hasPermssion:     0,
  credits:          "SaGor",
  commandCategory: "media",
  usages:           "[song name]",
  cooldowns:        5,
  description:      "Search and send song from YouTube.",
  dependencies: {
    axios:      "",
    "yt-search": ""
  }
};

module.exports.languages = {
  en: {
    noArgs:      "❌ Please provide a song name.",
    searching:   "🔍 Searching song...",
    downloading: "⬇️ Downloading song...",
    notFound:    "❌ Song not found.",
    failDl:      "❌ Failed to download audio.",
    error:       "❌ An error occurred: %1"
  }
};

module.exports.run = async function ({ api, args, event, getLang }) {
  const { threadID, messageID } = event;

  if (!args[0]) {
    return api.sendMessage(getLang("noArgs"), threadID, messageID);
  }

  let searchingMsg, downloadingMsg;

  try {
    // ── Search ──
    searchingMsg = await api.sendMessage(getLang("searching"), threadID);

    const search = await yts(args.join(" "));
    const video  = search.videos[0];

    try { api.unsendMessage(searchingMsg.messageID); } catch {}

    if (!video) {
      return api.sendMessage(getLang("notFound"), threadID, messageID);
    }

    // ── Download info ──
    downloadingMsg = await api.sendMessage(getLang("downloading"), threadID);

    const { data } = await axios.get(
      `https://sagor.nav.bd/sagor/ytdl?url=${encodeURIComponent(video.url)}`,
      { timeout: 15000 }
    );

    if (!data?.result?.audios?.MP3_128K?.preview) {
      try { api.unsendMessage(downloadingMsg.messageID); } catch {}
      return api.sendMessage(getLang("failDl"), threadID, messageID);
    }

    const CACHE_DIR = path.join(process.cwd(), "tmp");
    if (!require("fs").existsSync(CACHE_DIR)) require("fs").mkdirSync(CACHE_DIR, { recursive: true });
    const filePath = path.join(CACHE_DIR, `sing_${Date.now()}.mp3`);

    // ── Stream to file ──
    const response = await axios({
      url:          data.result.audios.MP3_128K.preview,
      method:       "GET",
      responseType: "stream",
      timeout:      60000
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    writer.on("finish", () => {
      try { api.unsendMessage(downloadingMsg.messageID); } catch {}
      api.sendMessage(
        {
          body:       `🎵 ${data.result.title}\n⏱ ${video.timestamp} | 👁 ${video.views?.toLocaleString() || "N/A"} views`,
          attachment: fs.createReadStream(filePath)
        },
        threadID,
        () => { try { fs.unlinkSync(filePath); } catch {} },
        messageID
      );
    });

    writer.on("error", () => {
      try { api.unsendMessage(downloadingMsg.messageID); } catch {}
      try { fs.unlinkSync(filePath); } catch {}
      api.sendMessage(getLang("failDl"), threadID, messageID);
    });

  } catch (e) {
    try { if (searchingMsg)   api.unsendMessage(searchingMsg.messageID);   } catch {}
    try { if (downloadingMsg) api.unsendMessage(downloadingMsg.messageID); } catch {}
    api.sendMessage(getLang("error", e.message), threadID, messageID);
  }
};
