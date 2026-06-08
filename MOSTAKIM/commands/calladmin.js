"use strict";

const moment = require("moment-timezone");

module.exports.config = {
    name:            "calladmin",
    version:         "2.2.0",
    hasPermssion:    0,
    credits:         "MOSTAKIM",
    description:     "Send a message directly to the bot admin",
    commandCategory: "utility",
    usages:          "calladmin [your message]",
    cooldowns:       30
};

module.exports.run = async function ({ api, event, args }) {
    const { threadID, messageID, senderID } = event;
    const out = (msg) => api.sendMessage(msg, threadID, messageID);

    const userMsg = args.join(" ").trim();
    if (!userMsg) {
        return out(
            `[ CALL ADMIN ]\n` +
            `─────────────────\n` +
            `Send a message to the bot admin:\n\n` +
            `Usage: /calladmin [message]\n\n` +
            `Example:\n` +
            `/calladmin I need help with the bot\n\n` +
            `⚠️ Do not spam — abuse may result in a ban.`
        );
    }

    const adminUIDs = [
        ...(global.config.ADMINBOT   || []),
        ...(global.config.SUPERADMIN || [])
    ].map(String).filter((v, i, a) => a.indexOf(v) === i);

    if (adminUIDs.length === 0) {
        return out("❌ No admin is configured. Please try again later.");
    }

    // ── Send confirmation to user IMMEDIATELY ────────────────────────────────
    out(
        `╔══ ✅ MESSAGE SENT ══╗\n\n` +
        `Your message has been delivered\n` +
        `to the admin(s) successfully!\n\n` +
        `📩 Admin(s) have been notified.\n` +
        `💬 You will receive a reply\n` +
        `   directly in this chat.\n\n` +
        `Your message:\n` +
        `"${userMsg}"\n\n` +
        `╚═══ Please wait for reply ═══╝`
    );

    // ── Collect sender info in background ────────────────────────────────────
    const tz  = (global.config && global.config.timeZone) || "Asia/Dhaka";
    const now = moment().tz(tz).format("DD MMM YYYY, hh:mm A");

    let senderName = "Unknown User";
    try {
        const uinfo = await api.getUserInfo(senderID);
        senderName  = (uinfo[senderID] && uinfo[senderID].name) || senderName;
    } catch (_) {}

    let groupName = "Unknown Group";
    let isGroup   = false;
    try {
        const tinfo = await api.getThreadInfo(threadID);
        groupName   = tinfo.threadName || "Unknown Group";
        isGroup     = tinfo.isGroup;
    } catch (_) {}

    const adminMsg =
        `[ NEW CALL ADMIN MESSAGE ]\n` +
        `─────────────────────────\n` +
        `From     : ${senderName}\n` +
        `User ID  : ${senderID}\n` +
        `Location : ${isGroup ? groupName : "Private Chat"}\n` +
        `Thread   : ${threadID}\n` +
        `Time     : ${now}\n` +
        `─────────────────────────\n` +
        `Message  :\n${userMsg}\n` +
        `─────────────────────────\n` +
        `Reply to this message to respond to the user.`;

    // ── Send to each admin in background ────────────────────────────────────
    for (const adminID of adminUIDs) {
        try {
            await new Promise((resolve, reject) => {
                api.sendMessage(adminMsg, adminID, (err, info) => {
                    if (err) return reject(err);
                    global.client.handleReply.push({
                        name:             module.exports.config.name,
                        messageID:        info.messageID,
                        originalThreadID: threadID,
                        senderID:         senderID,
                        senderName:       senderName,
                        groupName:        isGroup ? groupName : "Private Chat",
                        originalMessage:  userMsg,
                        allAdmins:        adminUIDs
                    });
                    resolve();
                });
            });
        } catch (_) {}
    }
};

module.exports.handleReply = async function ({ api, event, handleReply }) {
    const { threadID, messageID, senderID, body } = event;

    const allAdmins = handleReply.allAdmins || [];
    const isAdmin   = allAdmins.includes(String(senderID)) ||
                      (global.config.ADMINBOT   || []).includes(String(senderID)) ||
                      (global.config.SUPERADMIN || []).includes(String(senderID));

    if (!isAdmin) return;

    const adminReply = (body || "").trim();
    if (!adminReply) return;

    const tz  = (global.config && global.config.timeZone) || "Asia/Dhaka";
    const now = moment().tz(tz).format("DD MMM YYYY, hh:mm A");

    let adminName = "Admin";
    try {
        const ainfo = await api.getUserInfo(senderID);
        adminName   = (ainfo[senderID] && ainfo[senderID].name) || adminName;
    } catch (_) {}

    const replyMsg =
        `[ ADMIN REPLY ]\n` +
        `─────────────────────────\n` +
        `Admin : ${adminName}\n` +
        `Time  : ${now}\n` +
        `─────────────────────────\n` +
        `Your message was:\n"${handleReply.originalMessage}"\n\n` +
        `Admin's reply:\n${adminReply}`;

    try {
        await api.sendMessage(
            {
                body:     replyMsg,
                mentions: [{ tag: handleReply.senderName, id: handleReply.senderID }]
            },
            handleReply.originalThreadID
        );

        api.sendMessage(
            `╔══ ✅ REPLY DELIVERED ══╗\n\n` +
            `Your reply was successfully\n` +
            `sent to the user!\n\n` +
            `👤 User  : ${handleReply.senderName}\n` +
            `📍 Group : ${handleReply.groupName}\n\n` +
            `╚══ Message delivered ══╝`,
            threadID,
            messageID
        );
    } catch (e) {
        api.sendMessage(`❌ Failed to send reply: ${e.message}`, threadID, messageID);
    }
};
