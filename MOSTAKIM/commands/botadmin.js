"use strict";

const moment = require("moment-timezone");

module.exports.config = {
    name:            "botadmin",
    version:         "1.0.0",
    hasPermssion:    0,
    credits:         "MOSTAKIM",
    description:     "Show the current real admins of this bot",
    commandCategory: "admin",
    usages:          "botadmin",
    cooldowns:       5
};

module.exports.run = async function ({ api, event }) {
    const { threadID, messageID } = event;
    const out = (msg) => api.sendMessage(msg, threadID, messageID);

    const tz  = (global.config && global.config.timeZone) || "Asia/Dhaka";
    const now = moment().tz(tz).format("DD MMM YYYY, hh:mm A");

    // Collect unique admin UIDs (SUPERADMIN + ADMINBOT, deduplicated)
    const seen = new Set();
    const adminUIDs = [];

    const superAdmins = (global.config.SUPERADMIN || []).map(String);
    const adminBot    = (global.config.ADMINBOT    || []).map(String);

    for (const uid of superAdmins) {
        if (!seen.has(uid)) { seen.add(uid); adminUIDs.push({ uid, role: "👑 Super Admin" }); }
    }
    for (const uid of adminBot) {
        if (!seen.has(uid)) { seen.add(uid); adminUIDs.push({ uid, role: "🔑 Admin" }); }
    }

    if (adminUIDs.length === 0) {
        return out("❌ কোনো Admin configured নেই।");
    }

    // Fetch name for each admin UID
    const lines = [];
    for (let i = 0; i < adminUIDs.length; i++) {
        const { uid, role } = adminUIDs[i];
        let name = "Unknown";
        try {
            const info = await api.getUserInfo(uid);
            name = (info[uid] && info[uid].name) || "Unknown";
        } catch {}
        lines.push(
            `┌ ${role}\n` +
            `├ 👤 Name : ${name}\n` +
            `├ 🆔 UID  : ${uid}\n` +
            `└ 🔗 Link : fb.com/${uid}`
        );
    }

    const botID   = api.getCurrentUserID();
    const botName = global.config.BOTNAME || "MOSTAKIM V2 BOT";

    const msg =
        `╭──────────────────────╮\n` +
        `│  👑 𝗕𝗢𝗧 𝗥𝗘𝗔𝗟 𝗔𝗗𝗠𝗜𝗡𝗦  │\n` +
        `╰──────────────────────╯\n\n` +
        `🤖 Bot   : ${botName}\n` +
        `🆔 Bot ID: ${botID}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        lines.join("\n\n") +
        `\n\n━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📊 Total Admins : ${adminUIDs.length}\n` +
        `⏰ ${now}\n` +
        `🌺 𝗠𝗢𝗦𝗧𝗔𝗞𝗜𝗠 𝗩𝟮 𝗕𝗢𝗧`;

    return out(msg);
};
