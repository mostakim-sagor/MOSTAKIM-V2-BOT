"use strict";

const moment = require("moment-timezone");

module.exports.config = {
    name:            "adminadd",
    version:         "1.0.0",
    hasPermssion:    3,
    credits:         "MOSTAKIM",
    description:     "Temporarily grant or revoke bot-admin power (lost on bot restart)",
    commandCategory: "admin",
    usages:          "adminadd [add|remove|list] [@mention | uid]",
    cooldowns:       3
};

// ── In-memory store: tracks UIDs added THIS session ──────
// global.tempAdmins is a Map: uid → { name, addedBy, addedAt }
if (!global.tempAdmins) global.tempAdmins = new Map();

// ── Helpers ───────────────────────────────────────────────

const tz = () => (global.config && global.config.timeZone) || "Asia/Dhaka";

function isPermanentAdmin(uid) {
    const perma = [
        ...(global.config.SUPERADMIN || []),
        ...(global.config.ADMINBOT   || [])
    ].map(String);
    // Only count as permanent if NOT in tempAdmins
    return perma.includes(String(uid)) && !global.tempAdmins.has(String(uid));
}

function isCurrentAdmin(uid) {
    return [...(global.config.ADMINBOT || [])].map(String).includes(String(uid));
}

async function fetchName(api, uid) {
    try {
        const info = await api.getUserInfo(uid);
        return (info[uid] && info[uid].name) || "Unknown";
    } catch { return "Unknown"; }
}

// ── run ───────────────────────────────────────────────────

module.exports.run = async function ({ api, event, args }) {
    const { threadID, messageID, senderID } = event;
    const out = (msg) => api.sendMessage(msg, threadID, messageID);

    const now = moment().tz(tz()).format("DD MMM YYYY, hh:mm A");

    // sub-command
    const sub = (args[0] || "").toLowerCase();

    // ── LIST ─────────────────────────────────────────────
    if (sub === "list" || sub === "show" || sub === "ls") {
        if (global.tempAdmins.size === 0) {
            return out(
                `📋 𝗧𝗘𝗠𝗣 𝗔𝗗𝗠𝗜𝗡 𝗟𝗜𝗦𝗧\n` +
                `━━━━━━━━━━━━━━━━\n` +
                `এই session-এ কোনো Temp Admin নেই।\n` +
                `⏰ ${now}`
            );
        }

        let lines = "";
        let i = 1;
        for (const [uid, data] of global.tempAdmins) {
            lines +=
                `${i++}. 👤 ${data.name}\n` +
                `   🆔 ${uid}\n` +
                `   ➕ Added by: ${data.addedByName}\n` +
                `   🕒 ${data.addedAt}\n\n`;
        }

        return out(
            `📋 𝗧𝗘𝗠𝗣 𝗔𝗗𝗠𝗜𝗡 𝗟𝗜𝗦𝗧\n` +
            `━━━━━━━━━━━━━━━━\n` +
            `⚡ Bot restart হলে সবাই remove হবে\n\n` +
            lines.trim() +
            `\n━━━━━━━━━━━━━━━━\n` +
            `📊 Total Temp Admins: ${global.tempAdmins.size}\n` +
            `⏰ ${now}`
        );
    }

    // ── REMOVE ───────────────────────────────────────────
    if (sub === "remove" || sub === "rem" || sub === "del" || sub === "delete") {
        // Resolve target UID
        let targetUID = null;

        if (event.type === "message_reply" && event.messageReply) {
            targetUID = String(event.messageReply.senderID);
        } else if (event.mentions && Object.keys(event.mentions).length > 0) {
            targetUID = String(Object.keys(event.mentions)[0]);
        } else if (args[1] && /^\d{5,20}$/.test(args[1])) {
            targetUID = String(args[1]);
        }

        if (!targetUID) {
            return out("❌ কাকে remove করবে? @mention, UID, বা reply করো।");
        }

        if (isPermanentAdmin(targetUID)) {
            return out("⛔ Permanent Admin কে temporary remove করা যাবে না!\nconfig.json এ manually করতে হবে।");
        }

        if (!global.tempAdmins.has(targetUID)) {
            return out(`❌ এই user (${targetUID}) Temp Admin তালিকায় নেই।`);
        }

        // Remove from global.config.ADMINBOT
        const data = global.tempAdmins.get(targetUID);
        global.config.ADMINBOT   = (global.config.ADMINBOT   || []).filter(id => String(id) !== targetUID);
        global.config.SUPERADMIN = (global.config.SUPERADMIN || []).filter(id => String(id) !== targetUID);
        global.tempAdmins.delete(targetUID);

        return out(
            `✅ 𝗧𝗘𝗠𝗣 𝗔𝗗𝗠𝗜𝗡 𝗥𝗘𝗠𝗢𝗩𝗘𝗗\n` +
            `━━━━━━━━━━━━━━━━\n` +
            `👤 Name : ${data.name}\n` +
            `🆔 UID  : ${targetUID}\n\n` +
            `❌ Admin power সরিয়ে নেওয়া হয়েছে।\n` +
            `⏰ ${now}`
        );
    }

    // ── ADD (default) ────────────────────────────────────
    // Normalize: if sub is "add", target is args[1]; otherwise sub itself may be a UID
    let targetUID  = null;
    let targetName = null;

    if (event.type === "message_reply" && event.messageReply) {
        targetUID = String(event.messageReply.senderID);
    } else if (event.mentions && Object.keys(event.mentions).length > 0) {
        targetUID = String(Object.keys(event.mentions)[0]);
    } else {
        // Try args[1] if sub="add", else args[0] if it looks like a UID
        const candidate = sub === "add" ? (args[1] || "") : (args[0] || "");
        if (/^\d{5,20}$/.test(candidate)) targetUID = String(candidate);
    }

    if (!targetUID) {
        return out(
            `📌 𝗔𝗗𝗠𝗜𝗡𝗔𝗗𝗗 — 𝗨𝗦𝗔𝗚𝗘\n` +
            `━━━━━━━━━━━━━━━━\n` +
            `➕ Add   : .adminadd @mention | uid\n` +
            `➖ Remove: .adminadd remove @mention | uid\n` +
            `📋 List  : .adminadd list\n\n` +
            `⚡ Bot restart হলে সব temp admin চলে যাবে।\n` +
            `🔒 Only Super Admin পারবে।`
        );
    }

    if (String(targetUID) === String(senderID)) {
        return out("❌ নিজেকে add করতে পারবে না।");
    }

    if (isPermanentAdmin(targetUID)) {
        return out("ℹ️ এই user ইতিমধ্যে Permanent Admin।");
    }

    if (global.tempAdmins.has(targetUID)) {
        const d = global.tempAdmins.get(targetUID);
        return out(`ℹ️ ${d.name} (${targetUID}) ইতিমধ্যে Temp Admin হিসেবে আছে।`);
    }

    // Fetch names
    [targetName] = await Promise.all([fetchName(api, targetUID)]);
    const senderName = await fetchName(api, senderID);

    const addedAt = moment().tz(tz()).format("DD MMM YYYY, hh:mm A");

    // Inject into global.config.ADMINBOT (in-memory only)
    if (!global.config.ADMINBOT) global.config.ADMINBOT = [];
    global.config.ADMINBOT.push(String(targetUID));

    // Track in tempAdmins store
    global.tempAdmins.set(targetUID, {
        name:        targetName,
        addedBy:     senderID,
        addedByName: senderName,
        addedAt
    });

    return out(
        `✅ 𝗧𝗘𝗠𝗣 𝗔𝗗𝗠𝗜𝗡 𝗔𝗗𝗗𝗘𝗗\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `👤 Name   : ${targetName}\n` +
        `🆔 UID    : ${targetUID}\n` +
        `👑 Role   : Temporary Admin\n` +
        `➕ By     : ${senderName}\n` +
        `🕒 At     : ${addedAt}\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `⚡ এই admin power শুধু bot চলা পর্যন্ত থাকবে।\n` +
        `🔄 Bot restart হলে automatically চলে যাবে।`
    );
};
