module.exports.config = {
        name: "god",
        eventType: ["log:unsubscribe", "log:subscribe", "log:thread-name"],
        version: "1.0.1",
        credits: "MOSTAKIM",
        description: "Record bot activity notifications!",
        envConfig: {
                enable: true
        }
};

const _godConfigName = module.exports.config.name;

module.exports.run = async function({ api, event, Threads }) {
        const logger = require("../../utils/log");
        const configName = _godConfigName;
        const cfg = (global.configModule && global.configModule[configName]) || { enable: true };
        if (!cfg.enable) return;

        // ── Fetch group name from cache or API ────────────────────────────────
        let groupName = (global.data.threadData.get(String(event.threadID)) || {}).threadName || "";
        if (!groupName) {
                try {
                        const ti = await api.getThreadInfo(event.threadID);
                        groupName = ti.threadName || ti.name || "";
                        if (groupName) {
                                const td = global.data.threadData.get(String(event.threadID)) || {};
                                td.threadName = groupName;
                                global.data.threadData.set(String(event.threadID), td);
                        }
                } catch {}
        }
        const groupLabel = groupName
                ? `${groupName}\n» Group ID  : ${event.threadID}`
                : `» Group ID  : ${event.threadID}`;

        let formReport = "=== 𝐌𝐎𝐒𝐓𝐀𝐊𝐈𝐌 𝐕𝟐 𝐁𝐎𝐓 Notification ===" +
                                        "\n\n» Group     : " + groupLabel +
                                        "\n» Action    : {task}" +
                                        "\n» By userID : " + event.author +
                                        "\n» Time      : " + new Date().toLocaleString("en-GB", { timeZone: global.config.timeZone || "Asia/Dhaka", hour12: false }) + " «";

        let task = "";

        switch (event.logMessageType) {
                case "log:thread-name": {
                        const oldName = (await Threads.getData(event.threadID)).name || "Unknown";
                        const newName = event.logMessageData.name || "Unknown";
                        task = `Group name changed\n   From: "${oldName}"\n   To  : "${newName}"`;
                        await Threads.setData(event.threadID, { name: newName });
                        break;
                }
                case "log:subscribe": {
                        if (event.logMessageData.addedParticipants.some(i => i.userFbId == api.getCurrentUserID())) {
                                task = "✅ Bot was added to this group!";
                        }
                        break;
                }
                case "log:unsubscribe": {
                        if (event.logMessageData.leftParticipantFbId == api.getCurrentUserID()) {
                                task = "🚪 Bot was removed/kicked from this group!";
                        }
                        break;
                }
                default:
                        break;
        }

        if (task.length === 0) return;

        formReport = formReport.replace(/\{task}/g, task);

        const receivers = [
                ...(global.config.ADMINBOT   || []),
                ...(global.config.SUPERADMIN || [])
        ].map(String).filter((v, i, a) => a.indexOf(v) === i);

        for (const id of receivers) {
                try {
                        await api.sendMessage(formReport, id);
                } catch (error) {
                        logger(formReport, "[ Logging Event ]");
                }
        }
};
