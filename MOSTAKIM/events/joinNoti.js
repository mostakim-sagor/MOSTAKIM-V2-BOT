module.exports.config = {
  name: "joinnoti",
  eventType: ["log:subscribe"],
  version: "1.0.7",
  credits: "MOSTAKIM",
  description: "Welcome message with optional image/video, dynamic session & profile links",
  dependencies: {
    "fs-extra": "",
    "path": ""
  }
};

module.exports.onLoad = function () {
  const { existsSync, mkdirSync } = global.nodemodule["fs-extra"];
  const { join } = global.nodemodule["path"];
  const joinGifDir = join(__dirname, "cache", "joinGif");
  if (!existsSync(joinGifDir)) mkdirSync(joinGifDir, { recursive: true });
};

module.exports.run = async function({ api, event, Users, Threads }) {
  const fs   = require("fs");
  const path = require("path");
  const { threadID } = event;

  const botPrefix = global.config.PREFIX  || "/";
  const botName   = global.config.BOTNAME || "𝐌𝐎𝐒𝐓𝐀𝐊𝐈𝐌 𝐕𝟐 𝐁𝐎𝐓";

  // ── Bot added to group ──────────────────────────────────────────────────────
  if (event.logMessageData.addedParticipants.some(i => i.userFbId == api.getCurrentUserID())) {
    await api.changeNickname(`[ ${botPrefix} ] • ${botName}`, threadID, api.getCurrentUserID()).catch(() => {});

    const welcomeMsg =
      `⚡ ${botName} ⚡\n\n` +
      `Is successfully connected and running ♻️\n` +
      `All services are active and ready to handle your requests 🔥\n` +
      `Thank you for using this system — let's get started 🚀\n\n` +
      `☢️ Prefix : < ${botPrefix} >`;

    api.sendMessage(welcomeMsg, threadID, () => {
      const gifFile = path.join(__dirname, "cache", "botrun.gif");
      const gifDir  = path.join(__dirname, "cache", "botrun_gifs");

      let streamPath = null;

      if (fs.existsSync(gifFile) && fs.statSync(gifFile).isFile()) {
        streamPath = gifFile;
      }
      else if (fs.existsSync(gifDir) && fs.statSync(gifDir).isDirectory()) {
        const exts  = [".mp4", ".jpg", ".png", ".jpeg", ".gif", ".mp3"];
        const files = fs.readdirSync(gifDir).filter(f => exts.some(e => f.endsWith(e)));
        if (files.length > 0) {
          streamPath = path.join(gifDir, files[Math.floor(Math.random() * files.length)]);
        }
      }

      if (streamPath) {
        api.sendMessage(
          { body: `⚡ ${botName} is now online! ♻️`, attachment: fs.createReadStream(streamPath) },
          threadID
        );
      }
    });
    return;
  }

  // ── User joined group ───────────────────────────────────────────────────────
  try {
    const { createReadStream, readdirSync, existsSync } = global.nodemodule["fs-extra"];
    const { threadName, participantIDs } = await api.getThreadInfo(threadID);
    const threadData = global.data.threadData.get(parseInt(threadID)) || {};

    let mentions = [], nameArray = [], memLength = [], i = 0;
    for (const user of event.logMessageData.addedParticipants) {
      nameArray.push(user.fullName);
      mentions.push({ tag: user.fullName, id: user.userFbId });
      memLength.push(participantIDs.length - i++);
    }
    memLength.sort((a, b) => a - b);

    const hour = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" })
    ).getHours();

    const session =
      (hour >= 20 || hour < 6)  ? "Night"     :
      (hour >= 6  && hour < 12) ? "Morning"   :
      (hour >= 12 && hour < 17) ? "Afternoon" : "Evening";

    const profileLinks = event.logMessageData.addedParticipants
      .map(u => `fb.com/${u.userFbId}`)
      .join('\n');

    let msg = (typeof threadData.customJoin === "undefined")
      ? `╭───〔 🌸 𝐖𝐄𝐋𝐂𝐎𝐌𝐄 🌸 〕───╮\n\n 👋 Hello    < ${nameArray.join(', ')} >\n  Welcome to < ${threadName} >\n You are member number   < ${memLength.join(', ')} >\n\n ✦ Have a nice < ${session} 😊 >\n\n╰────────────────────────╯`
      : threadData.customJoin
          .replace(/\{userName}/g,    nameArray.join(', '))
          .replace(/\{boxName}/g,     threadName)
          .replace(/\{soThanhVien}/g, memLength.join(', '))
          .replace(/\{session}/g,     session);

    const joinGifDir = path.join(__dirname, "cache", "joinGif");
    if (existsSync(joinGifDir)) {
      const files = readdirSync(joinGifDir).filter(f =>
        [".mp4", ".jpg", ".png", ".jpeg", ".gif", ".mp3"].some(ext => f.endsWith(ext))
      );
      if (files.length > 0) {
        const pick = files[Math.floor(Math.random() * files.length)];
        api.sendMessage(
          { body: "", attachment: createReadStream(path.join(joinGifDir, pick)) },
          threadID
        );
      }
    }

    for (const user of event.logMessageData.addedParticipants) {
      api.shareContact(msg, user.userFbId, threadID, (err) => {
        if (err) console.log(err);
      });
    }

  } catch (e) {
    console.error("joinNoti error:", e);
  }
};