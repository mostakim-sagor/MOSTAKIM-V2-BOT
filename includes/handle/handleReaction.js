module.exports = function ({ api, models, Users, Threads, Currencies }) {
    const logger = require("../../utils/log");

    return async function ({ event }) {
        try {
            const { threadID, messageID, reaction, userID, senderID } = event;

            // Debug log: always print reaction events so we can see them in logs
            logger(`[reactBy] reaction="${reaction}" userID=${userID} senderID=${senderID} threadID=${threadID}`, "[ REACTION ]");

            if (!reaction || !threadID) return;

            // ── Handle command-specific reactions (handleReaction array) ──
            const reactions = global.client.handleReaction;
            if (Array.isArray(reactions)) {
                const idx = reactions.findIndex(r => r.messageID === messageID);
                if (idx !== -1) {
                    const reactionData = reactions[idx];
                    const command = global.client.commands.get(reactionData.name);
                    if (command && typeof command.handleReaction === "function") {
                        try {
                            await command.handleReaction({
                                event, api, Users, Threads, Currencies,
                                handleReaction: reactionData
                            });
                        } catch (e) {
                            logger(`handleReaction command error [${reactionData.name}]: ${e.message}`, "[ HANDLE ]");
                        }
                    }
                    return;
                }
            }

            // ── ReactBy feature ──
            const reactBy = (global.config && global.config.reactBy) ? global.config.reactBy : {};
            if (Object.keys(reactBy).length === 0) return;

            // senderID = who sent the original message (the target of the action)
            // userID   = who reacted (must be admin to trigger an action)
            const targetID = String(senderID || "");
            if (!targetID) return;

            const botID = String(api.getCurrentUserID() || "");
            const reactorID = String(userID || "");

            // Don't act on reactions to bot's own messages
            if (targetID === botID) return;
            // Don't act when someone reacts to their own message
            if (reactorID === targetID) return;

            // Check if reactor is group admin or bot admin
            let adminIDs = [];
            try {
                const threadInfo = await api.getThreadInfo(threadID);
                adminIDs = (threadInfo.adminIDs || []).map(i => String(i.id));
            } catch (e) {}

            // Collect all privileged IDs: ADMINBOT + SUPERADMIN + DEV
            const adminBot = [
                ...(global.config.ADMINBOT   || global.config.adminBot  || []),
                ...(global.config.SUPERADMIN || []),
                ...(global.config.DEV        || global.config.devUsers  || [])
            ].map(String);
            const isGroupAdmin = adminIDs.includes(reactorID);
            const isBotAdmin   = adminBot.includes(reactorID);
            const isAdmin = isGroupAdmin || isBotAdmin;

            if (!isAdmin) return;

            // Match reaction emoji to action
            // Normalize: strip variation selectors (U+FE0F, U+FE0E) so
            // "⚠️" in config matches "⚠" sent by Facebook (and vice versa)
            const normalizeEmoji = (s) => (s || "").replace(/\uFE0F|\uFE0E/g, "").trim();
            const normalizedReaction = normalizeEmoji(reaction);

            let matchedAction = null;
            for (const [action, emojis] of Object.entries(reactBy)) {
                if (!Array.isArray(emojis)) continue;
                if (emojis.some(e => normalizeEmoji(e) === normalizedReaction)) {
                    matchedAction = action;
                    break;
                }
            }

            if (!matchedAction) return;

            const targetName = (global.data && global.data.userName && global.data.userName.get(targetID))
                || await Users.getNameUser(targetID).catch(() => targetID);

            switch (matchedAction) {

                case "delete": {
                    try {
                        await api.unsendMessage(messageID);
                    } catch (e) {
                        api.sendMessage(`❌ বার্তা ডিলিট করতে পারিনি!\n${e.message}`, threadID);
                    }
                    break;
                }

                case "kick": {
                    try {
                        await api.removeUserFromGroup(targetID, threadID);
                        api.sendMessage(`🦵 ${targetName} কে গ্রুপ থেকে বের করা হয়েছে!`, threadID);
                    } catch (e) {
                        api.sendMessage(`❌ Kick করতে পারিনি!\n${e.message}`, threadID);
                    }
                    break;
                }

                case "warn": {
                    api.sendMessage(`⚠️ সতর্কবার্তা!\n👤 ${targetName} (${targetID})\nএই আচরণ আর করবেন না।`, threadID);
                    break;
                }

                case "mute": {
                    try {
                        const userData = await Users.getData(targetID).catch(() => null);
                        let data = (userData && userData.data) ? userData.data : {};
                        data.muted    = true;
                        data.mutedBy  = reactorID;
                        data.mutedAt  = new Date().toLocaleString("en-GB", { timeZone: "Asia/Dhaka" });
                        await Users.setData(targetID, { data });
                        api.sendMessage(`🔇 ${targetName} কে মিউট করা হয়েছে!`, threadID);
                    } catch (e) {
                        api.sendMessage(`❌ Mute করতে পারিনি!\n${e.message}`, threadID);
                    }
                    break;
                }

                case "ban": {
                    try {
                        const userData = await Users.getData(targetID).catch(() => null);
                        let data = (userData && userData.data) ? userData.data : {};
                        data.banned   = true;
                        data.bannedBy = reactorID;
                        data.bannedAt = new Date().toLocaleString("en-GB", { timeZone: "Asia/Dhaka" });
                        await Users.setData(targetID, { data });
                        if (global.data && global.data.userBanned) {
                            global.data.userBanned.set(targetID, {
                                reason: "Reaction ban",
                                dateAdded: data.bannedAt
                            });
                        }
                        api.sendMessage(`🚫 ${targetName} (${targetID}) কে ব্যান করা হয়েছে!`, threadID);
                    } catch (e) {
                        api.sendMessage(`❌ Ban করতে পারিনি!\n${e.message}`, threadID);
                    }
                    break;
                }

                case "adduser": {
                    try {
                        await api.addUserToGroup(targetID, threadID);
                        api.sendMessage(`🫂 ${targetName} কে গ্রুপে যোগ করা হয়েছে!`, threadID);
                    } catch (e) {
                        api.sendMessage(`❌ Add করতে পারিনি!\n${e.message}`, threadID);
                    }
                    break;
                }

                default:
                    break;
            }

        } catch (e) {
            logger(`handleReaction fatal error: ${e.message}`, "[ HANDLE ]");
        }
    };
};
