/**
 * ==========================================
 * 🤖 MOSTAKIM FB DOWNLOADER BOT 
 * 📌 Facebook Video Auto Downloader + INFO
 *  //please don't change credit
 * ==========================================
 */

const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());

// ================= CONFIG =================
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "mostakim_bot";
const PORT = process.env.PORT || 3000;

// ================= MEMORY (Duplicate Avoid) =================
let lastLinks = {};

// ================= VERIFY WEBHOOK =================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook Verified");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ================= RECEIVE MESSAGE =================
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const event = entry.messaging?.[0];

    if (!event) return res.sendStatus(200);

    const senderId = event.sender.id;
    const message = event.message?.text;

    if (!message) return res.sendStatus(200);

    console.log("📩 Message:", message);

    // 👉 Facebook link detect
    if (message.includes("facebook.com")) {

      // ❌ Duplicate check
      if (lastLinks[senderId] === message) {
        return sendMessage(senderId, "⚠️ Same link already processed!");
      }
      lastLinks[senderId] = message;

      await sendMessage(senderId, "⏳ Processing your video...");

      try {
        // 🔥 API CALL (Working public API)
        const api = `https://api.ryzendesu.vip/api/downloader/fb?url=${encodeURIComponent(message)}`;
        const response = await axios.get(api);

        const data = response.data;

        if (!data || !data.data) {
          return sendMessage(senderId, "❌ Failed to fetch video!");
        }

        const videoUrl = data.data.hd || data.data.sd;

        // 📊 INFO TEXT
        const info = `
📥 FACEBOOK VIDEO DOWNLOADER

🔥 𝐌𝐎𝐒𝐓𝐀𝐊𝐈𝐌 𝐆𝐎𝐀𝐓 𝐁𝐎𝐓 𝐕𝟐 🔥

📥⚡𝗔𝘂𝘁𝗼 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱𝗲𝗿⚡📂
🎬 𝐄𝐧𝐣𝐨𝐲 𝐭𝐡𝐞 𝐕𝐢𝐝𝐞𝐨 🎀

🔗 Link: ${message}
🎬 Quality: ${data.data.hd ? "HD" : "SD"}
⚡ Status: Download Complete`;

        // Send Info
        await sendMessage(senderId, info);

        // Send Video
        await sendVideo(senderId, videoUrl);

      } catch (err) {
        console.log("❌ API ERROR:", err.message);
        await sendMessage(senderId, "❌ Error downloading video!");
      }

    } else {
      // Default reply
      await sendMessage(
        senderId,
        "📩 Please send a valid Facebook video link."
      );
    }

    res.sendStatus(200);

  } catch (error) {
    console.log("❌ SERVER ERROR:", error);
    res.sendStatus(500);
  }
});

// ================= SEND TEXT =================
async function sendMessage(userId, text) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        recipient: { id: userId },
        message: { text }
      }
    );
  } catch (err) {
    console.log("Send Message Error:", err.response?.data || err.message);
  }
}

// ================= SEND VIDEO =================
async function sendVideo(userId, videoUrl) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        recipient: { id: userId },
        message: {
          attachment: {
            type: "video",
            payload: {
              url: videoUrl,
              is_reusable: true
            }
          }
        }
      }
    );
  } catch (err) {
    console.log("Send Video Error:", err.response?.data || err.message);
  }
}

// ================= ROOT =================
app.get("/", (req, res) => {
  res.send("🤖 MOSTAKIM FB DOWNLOADER BOT RUNNING...");
});

// ================= START SERVER =================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});