const { writeFileSync } = require("fs-extra");
const { join } = require("path");

module.exports.config = {
    name: "setprefix",
    version: "2.0.0",
    hasPermssion: 1,
    credits: "MOSTAKIM",
    description: "Change prefix for this box or the entire bot system",
    commandCategory: "group",
    usages: "[new prefix] | [new prefix] -g | reset",
    cooldowns: 5
};

module.exports.languages = {
    "en": {
        "missingInput":       "Please provide a prefix. Usage: setprefix <prefix> or setprefix <prefix> -g",
        "onlyAdmin":          "Only bot admins can change the global prefix",
        "confirmBox":         "React to confirm changing this box prefix to: %1",
        "confirmGlobal":      "React to confirm changing the GLOBAL prefix to: %1",
        "successBox":         "✅ Box prefix changed to: %1",
        "successGlobal":      "✅ Global prefix changed to: %1",
        "resetBox":           "🔄 Box prefix reset to default: %1"
    }
};

module.exports.handleReaction = async function ({ api, event, Threads, handleReaction, getText }) {
    try {
        if (String(event.userID) !== String(handleReaction.author)) return;

        const { threadID, messageID } = event;
        api.unsendMessage(handleReaction.messageID);

        if (handleReaction.setGlobal) {
            // ── Change global prefix ──────────────────────────────────────────
            global.config.PREFIX = handleReaction.PREFIX;
            try {
                const configPath = join(global.client.mainPath, "config.json");
                writeFileSync(configPath, JSON.stringify(global.config, null, 4), "utf8");
            } catch (e) { console.log("Failed to write config.json:", e); }
            return api.sendMessage(getText("successGlobal", handleReaction.PREFIX), threadID, messageID);
        } else {
            // ── Change box/thread prefix ──────────────────────────────────────
            const data = ((await Threads.getData(String(threadID))) || {}).data || {};
            data["PREFIX"] = handleReaction.PREFIX;
            await Threads.setData(threadID, { data });
            global.data.threadData.set(String(threadID), data);
            return api.sendMessage(getText("successBox", handleReaction.PREFIX), threadID, messageID);
        }
    } catch (e) { console.log(e); }
};

module.exports.run = async ({ api, event, args, Threads, getText, permssion }) => {
    const { threadID, messageID, senderID } = event;

    if (!args[0]) return api.sendMessage(getText("missingInput"), threadID, messageID);

    const prefix = args[0].trim();

    // ── Reset box prefix ──────────────────────────────────────────────────────
    if (prefix === "reset") {
        const data = ((await Threads.getData(String(threadID))) || {}).data || {};
        data["PREFIX"] = global.config.PREFIX;
        await Threads.setData(threadID, { data });
        global.data.threadData.set(String(threadID), data);
        return api.sendMessage(getText("resetBox", global.config.PREFIX), threadID, messageID);
    }

    const isGlobal = args[1] === "-g";

    // ── Global prefix requires admin (permssion level 3) ──────────────────────
    if (isGlobal && permssion < 3)
        return api.sendMessage(getText("onlyAdmin"), threadID, messageID);

    const confirmMsg = isGlobal
        ? getText("confirmGlobal", prefix)
        : getText("confirmBox", prefix);

    return api.sendMessage(confirmMsg, threadID, (err, info) => {
        if (err || !info) return;
        global.client.handleReaction.push({
            name: "setprefix",
            messageID: info.messageID,
            author: senderID,
            PREFIX: prefix,
            setGlobal: isGlobal
        });
    });
};
