"use strict";

const axios = require("axios");
const fs    = require("fs");
const path  = require("path");

const CACHE_DIR = path.join(process.cwd(), "tmp");
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

module.exports = {
  config: {
    name:            "4k",
    version:         "2.0.0",
    hasPermssion:    0,
    credits:         "MOSTAKIM",
    description:     "Enhance & upscale photo to 2× resolution",
    commandCategory: "media",
    usages:          "4k  (reply to an image)",
    cooldowns:       10,
  },

  handleEvent: async ({ api, event }) => {
    const { body, messageReply, threadID, messageID } = event;
    if ((body || "").toLowerCase().trim() !== "4k") return;
    if (!messageReply?.attachments?.length)
      return api.sendMessage("📸 কোনো ছবিকে Reply করে 4k লেখো!", threadID, messageID);
    await processImage(api, threadID, messageID, messageReply.attachments[0].url);
  },

  run: async ({ api, event }) => {
    const { threadID, messageID, messageReply } = event;
    if (!messageReply?.attachments?.length)
      return api.sendMessage("📸 কোনো ছবিকে Reply করে /4k দাও!", threadID, messageID);
    await processImage(api, threadID, messageID, messageReply.attachments[0].url);
  }
};

// ── Download image as buffer ───────────────────────────────────────────────────
async function downloadImage(url) {
  const r = await axios.get(url, {
    responseType: "arraybuffer",
    timeout:      20000,
    headers:      { "User-Agent": "Mozilla/5.0" }
  });
  return Buffer.from(r.data);
}

// ── Method 1: x-noobs API (original, try first) ───────────────────────────────
async function tryXnoobs(imgUrl) {
  const configRes = await axios.get(
    "https://raw.githubusercontent.com/shahadat-sahu/SAHU-API/refs/heads/main/SAHU-API.json",
    { timeout: 8000 }
  );
  const apiBase = configRes.data?.["4k"];
  if (!apiBase) throw new Error("No 4k URL in config");

  const res = await axios.get(`${apiBase}?imageUrl=${encodeURIComponent(imgUrl)}`, { timeout: 15000 });
  const resultUrl = res.data?.result;
  if (!resultUrl) throw new Error("No result URL");

  return await downloadImage(resultUrl);
}

// ── Method 2: picwish free upscaler ───────────────────────────────────────────
async function tryPicwish(imgBuf) {
  const FormData = require("form-data");
  const form     = new FormData();
  form.append("file", imgBuf, { filename: "photo.jpg", contentType: "image/jpeg" });

  const upload = await axios.post(
    "https://picwish.com/api/upload",
    form,
    { headers: { ...form.getHeaders(), "User-Agent": "Mozilla/5.0" }, timeout: 20000 }
  );
  const taskId = upload.data?.data?.task_id || upload.data?.task_id;
  if (!taskId) throw new Error("No task_id");

  // Poll for result
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const poll = await axios.get(
      `https://picwish.com/api/task/${taskId}`,
      { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 10000 }
    );
    const resultUrl = poll.data?.data?.result_url || poll.data?.result_url;
    if (resultUrl) return await downloadImage(resultUrl);
  }
  throw new Error("Picwish timeout");
}

// ── Method 3: jimp local 2× upscale (always works) ───────────────────────────
async function jimpUpscale(imgBuf) {
  const { Jimp } = require("jimp");
  const img      = await Jimp.fromBuffer(imgBuf);

  const origW = img.bitmap.width;
  const origH = img.bitmap.height;

  // Cap at 2000px per side to stay under FB 25MB limit
  const scale  = Math.min(2, Math.floor(4000 / Math.max(origW, origH)) || 2);
  const newW   = origW * scale;
  const newH   = origH * scale;

  img.resize({ w: newW, h: newH });

  // Slight sharpening — increase contrast by 10%
  img.contrast(0.08);

  const outBuf = await img.getBuffer("image/jpeg");
  return { buf: outBuf, origW, origH, newW, newH, scale };
}

// ── Main processor ────────────────────────────────────────────────────────────
async function processImage(api, threadID, messageID, imgUrl) {
  const outPath = path.join(CACHE_DIR, `4k_${Date.now()}.jpg`);
  const waitMsg = await api.sendMessage("⏳ Enhancing photo...", threadID);

  try {
    // Step 1: Download original
    const origBuf = await downloadImage(imgUrl);

    let outBuf   = null;
    let method   = "";
    let sizeInfo = "";

    // Step 2: Try online APIs first, fall back to jimp
    try {
      outBuf = await tryXnoobs(imgUrl);
      method = "✨ AI Enhanced (x-noobs)";
    } catch {}

    if (!outBuf) {
      try {
        outBuf = await tryPicwish(origBuf);
        method = "✨ AI Enhanced (Picwish)";
      } catch {}
    }

    if (!outBuf) {
      // Local jimp upscale (always works)
      const result = await jimpUpscale(origBuf);
      outBuf   = result.buf;
      method   = `🔍 Local ${result.scale}× Upscale`;
      sizeInfo = `📐 ${result.origW}×${result.origH} → ${result.newW}×${result.newH}\n`;
    }

    const sizeMB = (outBuf.length / 1024 / 1024).toFixed(2);

    // Check size limit
    if (outBuf.length > 25 * 1024 * 1024) {
      throw new Error(`File too large: ${sizeMB} MB`);
    }

    fs.writeFileSync(outPath, outBuf);

    try { api.unsendMessage(waitMsg.messageID); } catch {}

    api.sendMessage(
      {
        body:
          `🖼️ 𝗣𝗛𝗢𝗧𝗢 𝗘𝗡𝗛𝗔𝗡𝗖𝗘𝗗\n` +
          `━━━━━━━━━━━━━━━\n` +
          `${method}\n` +
          `${sizeInfo}` +
          `📦 ${sizeMB} MB\n` +
          `━━━━━━━━━━━━━━━\n` +
          `⚡ MOSTAKIM V2 BOT`,
        attachment: fs.createReadStream(outPath)
      },
      threadID,
      () => { try { fs.unlinkSync(outPath); } catch {} },
      messageID
    );

  } catch (e) {
    try { api.unsendMessage(waitMsg.messageID); } catch {}
    try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch {}
    api.sendMessage(
      `❌ Enhancement failed!\n⚠️ ${e.message || "Unknown error"}`,
      threadID, messageID
    );
  }
}
