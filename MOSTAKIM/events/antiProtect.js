const fs = require("fs-extra");
const axios = require("axios");

module.exports.config = {
  name: "antiProtect",
  version: "3.4.0",
  credits: "MOSTAKIM",
  description: "Protect group name, photo, description, emoji, color/theme",
  eventType: [
    "log:thread-name",
    "log:thread-icon",
    "log:thread-description",
    "log:thread-emoji",
    "log:thread-color"
  ],
  cooldowns: 2
};

module.exports.run = async function ({ api, event }) {
  try {
    const threadID = event.threadID;
    const senderID = event.author || event.senderID;

    const dir = `${__dirname}/../../cache/antiProtect/`;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const dataFile = dir + `${threadID}.json`;

    const threadInfo = await api.getThreadInfo(threadID);
    const adminIDs   = (threadInfo.adminIDs || []).map(i => i.id);
    const botID      = api.getCurrentUserID();
    const isAdmin    = adminIDs.includes(senderID);
    const botAdmin   = adminIDs.includes(botID);
    if (!botAdmin) return;

    if (!fs.existsSync(dataFile)) {
      const snap = {
        name:        threadInfo.threadName        || "",
        image:       threadInfo.imageSrc          || null,
        description: threadInfo.threadDescription || "",
        emoji:       threadInfo.emoji             || "",
        color:       threadInfo.threadColor       || ""
      };
      fs.writeFileSync(dataFile, JSON.stringify(snap, null, 2));
      return;
    }

    const old = JSON.parse(fs.readFileSync(dataFile));

    if (isAdmin || senderID == botID) {
      const snap = {
        name:        threadInfo.threadName        || "",
        image:       threadInfo.imageSrc          || null,
        description: threadInfo.threadDescription || "",
        emoji:       threadInfo.emoji             || "",
        color:       threadInfo.threadColor       || ""
      };
      fs.writeFileSync(dataFile, JSON.stringify(snap, null, 2));
      return;
    }

    const warningGif = `${__dirname}/../../cache/antiprotect.gif`;
    const hasGif     = fs.existsSync(warningGif);

    const mentions = [{
      tag: threadInfo.nicknames?.[senderID] || senderID,
      id:  senderID
    }];

    const send = (body) => {
      if (hasGif) {
        return api.sendMessage({
          body,
          mentions,
          attachment: fs.createReadStream(warningGif)
        }, threadID);
      }
      return api.sendMessage({ body, mentions }, threadID);
    };

    switch (event.logMessageType) {

      case "log:thread-name": {
        await api.setTitle(old.name, threadID).catch(() => {});
        return send(
          `🚫 Group name change blocked!\n` +
          `👤 User: @${threadInfo.nicknames?.[senderID] || senderID}\n` +
          `Restored to: "${old.name}"`
        );
      }

      case "log:thread-icon": {
        try {
          if (old.image) {
            const res = await axios.get(old.image, { responseType: "arraybuffer" });
            await api.changeGroupImage(Buffer.from(res.data, "binary"), threadID);
          }
        } catch (_) {}
        return send(
          `🚫 Group photo change blocked!\n` +
          `👤 User: @${threadInfo.nicknames?.[senderID] || senderID}\n` +
          `Old photo restored.`
        );
      }

      case "log:thread-description": {
        return send(
          `🚫 Group description change blocked!\n` +
          `👤 User: @${threadInfo.nicknames?.[senderID] || senderID}`
        );
      }

      case "log:thread-emoji": {
        await api.changeThreadEmoji(old.emoji, threadID).catch(() => {});
        return send(
          `🚫 Group emoji change blocked!\n` +
          `👤 User: @${threadInfo.nicknames?.[senderID] || senderID}\n` +
          `Restored to old emoji.`
        );
      }

      case "log:thread-color": {
        await api.changeThreadColor(old.color, threadID).catch(() => {});
        return send(
          `🚫 Group color/theme change blocked!\n` +
          `👤 User: @${threadInfo.nicknames?.[senderID] || senderID}\n` +
          `Restored to old color/theme.`
        );
      }
    }

  } catch (e) {
    console.log("antiProtect Error:", e);
  }
};
