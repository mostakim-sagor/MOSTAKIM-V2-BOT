"use strict";

const fs      = require("fs-extra");
const axios   = require("axios");
const path    = require("path");
const moment  = require("moment-timezone");

module.exports.config = {
    name:            "groupinfo",
    version:         "2.0.0",
    hasPermssion:    0,
    credits:         "MOSTAKIM",
    description:     "Show full group / thread information",
    commandCategory: "group",
    usages:          "groupinfo",
    cooldowns:       5
};

module.exports.run = async function ({ api, event }) {
    const { threadID, messageID } = event;
    const out = (msg) => api.sendMessage(msg, threadID, messageID);

    let info;
    try {
        info = await api.getThreadInfo(threadID);
    } catch (e) {
        return out(`❌ Group info নিতে পারিনি: ${e.message}`);
    }

    const botID   = api.getCurrentUserID();
    const botName = global.config.BOTNAME || "MOSTAKIM V2 BOT";
    const tz      = (global.config && global.config.timeZone) || "Asia/Dhaka";
    const now     = moment().tz(tz).format("DD MMM YYYY, hh:mm A");

    const threadName = info.threadName     || "Unnamed Group";
    const groupID    = info.threadID       || threadID;
    const members    = info.participantIDs ? info.participantIDs.length : 0;
    const admins     = info.adminIDs       ? info.adminIDs.length       : 0;
    const msgCount   = info.messageCount   || 0;
    const emoji      = info.emoji          || "💬";
    const approval   = info.approvalMode   ? "✅ চালু" : "❌ বন্ধ";
    const color      = info.color          ? `#${info.color}` : "Default";
    const isBot      = info.participantIDs && info.participantIDs.includes(botID);

    // Count gender
    let male = 0, female = 0, other = 0;
    if (Array.isArray(info.userInfo)) {
        for (const u of info.userInfo) {
            if      (u.gender === "MALE")   male++;
            else if (u.gender === "FEMALE") female++;
            else                            other++;
        }
    }

    const msg =
        `╭──────────────────╮\n` +
        `│  📊 𝗚𝗥𝗢𝗨𝗣 𝗜𝗡𝗙𝗢  │\n` +
        `╰──────────────────╯\n\n` +
        `👥 𝗚𝗿𝗼𝘂𝗽 𝗡𝗮𝗺𝗲 : ${threadName}\n` +
        `🆔 𝗚𝗿𝗼𝘂𝗽 𝗜𝗗   : ${groupID}\n` +
        `💬 𝗘𝗺𝗼𝗷𝗶       : ${emoji}\n` +
        `🎨 𝗖𝗵𝗮𝘁 𝗖𝗼𝗹𝗼𝗿 : ${color}\n` +
        `\n` +
        `👤 𝗠𝗲𝗺𝗯𝗲𝗿𝘀     : ${members}\n` +
        `  ├ 👨 Male     : ${male}\n` +
        `  ├ 👩 Female   : ${female}\n` +
        `  └ 🔵 Other    : ${other}\n` +
        `👑 𝗔𝗱𝗺𝗶𝗻𝘀      : ${admins}\n` +
        `💌 𝗠𝗲𝘀𝘀𝗮𝗴𝗲𝘀   : ${msgCount.toLocaleString()}\n` +
        `🚪 𝗔𝗽𝗽𝗿𝗼𝘃𝗮𝗹   : ${approval}\n` +
        `\n` +
        `🤖 𝗕𝗼𝘁 𝗡𝗮𝗺𝗲   : ${botName}\n` +
        `🆔 𝗕𝗼𝘁 𝗜𝗗     : ${botID}\n` +
        `✅ 𝗕𝗼𝘁 𝗜𝗻 𝗚𝗿𝗼𝘂𝗽: ${isBot ? "Yes" : "No"}\n` +
        `\n` +
        `⏰ ${now}\n` +
        `🌺 𝗠𝗢𝗦𝗧𝗔𝗞𝗜𝗠 𝗩𝟮 𝗕𝗢𝗧`;

    // Try to use group cover image, fallback to text-only
    const imgSrc = info.imageSrc;
    if (imgSrc) {
        const tmpImg = path.join(process.cwd(), "tmp", `gi_${Date.now()}.jpg`);
        try {
            fs.ensureDirSync(path.dirname(tmpImg));
            const res = await axios.get(encodeURI(imgSrc), { responseType: "arraybuffer", timeout: 15000 });
            fs.writeFileSync(tmpImg, Buffer.from(res.data));
            await api.sendMessage({ body: msg, attachment: fs.createReadStream(tmpImg) }, threadID, messageID);
            try { fs.unlinkSync(tmpImg); } catch {}
            return;
        } catch {
            try { fs.existsSync(tmpImg) && fs.unlinkSync(tmpImg); } catch {}
        }
    }

    // No image / download failed → send text only
    return out(msg);
};
