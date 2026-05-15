const axios = require("axios");

const INTERVAL = 600000; // 10 min

// ================= HIDDEN CREDIT =================
// Code by : MOSTAKIM
//please don't change credit
// ================= END CREDIT =================


// ================= YOUTUBE =================
async function getYouTubeShort() {
  try {
    const res = await axios.get(
      "https://www.youtube.com/feeds/videos.xml?channel_id=UCY1kMZp36IQSyNx_9h4mpCg"
    );

    const ids = [...res.data.matchAll(/<yt:videoId>(.*?)<\/yt:videoId>/g)]
      .map(v => v[1]);

    if (!ids.length) return null;

    const id = ids[Math.floor(Math.random() * ids.length)];
    return `https://www.youtube.com/shorts/${id}`;

  } catch (err) {
    console.log("❌ YouTube failed");
    return null;
  }
}

// ================= TIKTOK =================
async function getTikTokVideo() {
  try {
    const res = await axios.get("https://api.tiktok.com/random");
    return res.data?.url || null;

  } catch (err) {
    console.log("❌ TikTok failed");
    return null;
  }
}

// ================= FALLBACK =================
async function getVideoLink() {
  let link = await getTikTokVideo();

  if (!link) {
    console.log("🔁 Fallback to YouTube...");
    link = await getYouTubeShort();
  }

  return link;
}

// ================= MAIN =================
function startAuto(bot, CHAT_ID) {

  async function sendLink() {
    try {
      const link = await getVideoLink();

      if (!link) return;

      // 👉 ONLY LINK SENT (NO CAPTION)
      await bot.sendMessage(CHAT_ID, {
        text: link
      });

      console.log("✅ Sent:", link);

    } catch (err) {
      console.log("❌ Send error:", err.message);
    }
  }

  // first send
  sendLink();

  // interval loop
  setInterval(sendLink, INTERVAL);
}

module.exports = { startAuto };