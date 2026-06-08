"use strict";

const moment = require("moment-timezone");

module.exports.config = {
    name:            "console",
    version:         "1.2.0",
    hasPermssion:    3,
    credits:         "MOSTAKIM",
    description:     "Toggle the message console log on/off for this thread (Admin only)",
    commandCategory: "system",
    usages:          "console | console on | console off | console status",
    cooldowns:       0,
    handleEventOnCommand: false
};

module.exports.languages = {
    en: {
        on:      "✅ Console ON",
        off:     "❌ Console OFF",
        success: "— Console toggled!"
    }
};

module.exports.run = async function ({ api, event, Threads, getText, args }) {
    const { threadID, messageID } = event;

    const row  = await Threads.getData(threadID);
    const data = (row && row.data) ? row.data : {};

    // Default: console is OFF unless explicitly turned on
    if (data.console === undefined) data.console = false;

    const sub = (args[0] || "").toLowerCase();

    if (sub === "status") {
        const existing = global.data.threadData.get(String(threadID)) || {};
        const isOn = existing.console === true;
        return api.sendMessage(
            `📊 Console Status\n━━━━━━━━━━━━━━━\n` +
            `Thread: ${threadID}\n` +
            `Status: ${isOn ? "✅ ON (সব message log হচ্ছে)" : "❌ OFF (log বন্ধ)"}`,
            threadID, messageID
        );
    }

    if (sub === "on") {
        data.console = true;
    } else if (sub === "off") {
        data.console = false;
    } else {
        const wasOn = data.console === true;
        data.console = !wasOn;
    }

    await Threads.setData(threadID, { data });

    const existing2 = global.data.threadData.get(String(threadID)) || {};
    existing2.console = data.console;
    global.data.threadData.set(String(threadID), existing2);

    const statusIcon = data.console ? "✅" : "❌";
    const statusText = data.console ? "ON — এখন থেকে সব message এই group এ log হবে।" : "OFF — Message logging বন্ধ।";

    return api.sendMessage(
        `🖥️ Console Log\n━━━━━━━━━━━━━━━\n` +
        `${statusIcon} ${statusText}\n\n` +
        `💡 /console on  — চালু করো\n` +
        `💡 /console off — বন্ধ করো\n` +
        `💡 /console status — অবস্থা দেখো`,
        threadID, messageID
    );
};

module.exports.handleEvent = async function ({ api, event, Users }) {
    const { threadID, senderID, body } = event;

    if (!body || !body.trim()) return;
    const trimmed = body.trim();
    if (trimmed.length === 1) return;

    const globalPrefix = global.config.PREFIX || "/";
    const threadData2  = global.data.threadData.get(String(threadID)) || {};
    const threadPrefix = threadData2.PREFIX || globalPrefix;
    if (trimmed.startsWith(globalPrefix) || trimmed.startsWith(threadPrefix)) return;

    const botID = String(api.getCurrentUserID());
    if (String(senderID) === botID) return;

    const threadData = global.data.threadData.get(String(threadID)) || {};
    if (threadData.console !== true) return;

    const ADMINBOT   = global.config.ADMINBOT   || [];
    const SUPERADMIN = global.config.SUPERADMIN || [];
    const DEV        = global.config.DEV        || [];
    const isAdmin    = ADMINBOT.includes(String(senderID)) || SUPERADMIN.includes(String(senderID)) || DEV.includes(String(senderID));

    let threadName = threadData.threadName;
    if (!threadName || threadName === "Name does not exist") {
        try {
            const info = await api.getThreadInfo(threadID);
            threadName = info && (info.threadName || info.name);
            if (threadName) {
                threadData.threadName = threadName;
                global.data.threadData.set(String(threadID), threadData);
            }
        } catch {}
    }
    threadName = threadName || `Thread ${threadID}`;

    let userName = global.data.userName && global.data.userName.get(String(senderID));
    if (!userName) {
        try { userName = await Users.getNameUser(senderID); } catch {}
    }
    userName = userName || String(senderID);

    const tz   = global.config.timeZone || "Asia/Dhaka";
    const time = moment().tz(tz).format("LLLL");

    const logMsg =
        `[💓]→ Group name: ${threadName}\n` +
        `[🔎]→ Group ID: ${threadID}\n` +
        `[🔱]→ User name: ${userName}${isAdmin ? " 👑" : ""}\n` +
        `[📝]→ User ID: ${senderID}\n` +
        `[📩]→ Content: ${body.slice(0, 300)}\n` +
        `[ ${time} ]\n` +
        `◆━━━━━━━━━◆${global.config.BOTNAME || "MOSTAKIM V2 BOT"}◆━━━━━━━━◆`;

    try {
        await api.sendMessage({
            body:     logMsg,
            mentions: [{ tag: userName, id: senderID }]
        }, threadID);
    } catch {}
};
