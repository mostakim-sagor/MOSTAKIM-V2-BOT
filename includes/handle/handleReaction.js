module.exports = function ({ api, models, Users, Threads, Currencies }) {
    const logger = require("../../utils/log");

    return async function ({ event }) {
        try {
            const { threadID, messageID, reaction, userID, messageAuthorID } = event;

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

            const targetID = String(messageAuthorID || "");
            if (!targetID) return;

            const botID = String(api.getCurrentUserID() || "");

            // Don't act on reactions to bot's own messages or self-reactions
            if (targetID === botID) return;
            if (String(userID) === targetID) return;

            // Check if reactor is admin
            let adminIDs = [];
            try {
                const threadInfo = await api.getThreadInfo(threadID);
                adminIDs = (threadInfo.adminIDs || []).map(i => String(i.id));
            } catch (e) {}

            const adminBot = global.config.ADMINBOT || global.config.adminBot || [];
            const isGroupAdmin = adminIDs.includes(String(userID));
            const isBotAdmin = adminBot.map(String).includes(String(userID));
            const isAdmin = isGroupAdmin || isBotAdmin;

            if (!isAdmin) return;

            // Match reaction to action
            let matchedAction = null;
            for (const [action, emojis] of Object.entries(reactBy)) {
                if (!Array.isArray(emojis)) continue;
                if (emojis.includes(reaction)) {
                    matchedAction = action;
                    break;
                }
            }

            if (!matchedAction) return;

            const targetName = global.data.userName.get(String(targetID))
                || await Users.getNameUser(targetID).catch(() => String(targetID));

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
                    try {
                        api.sendMessage(`⚠️ সতর্কবার্তা!\n👤 ${targetName} (${targetID})\nএই আচরণ আর করবেন না।`, threadID);
                    } catch (e) {
                        logger(`warn reaction error: ${e.message}`, "[ REACT ]");
                    }
                    break;
                }

                case "mute": {
                    try {
                        const userData = await Users.getData(targetID).catch(() => null);
                        let data = (userData && userData.data) ? userData.data : {};
                        data.muted = true;
                        data.mutedBy = String(userID);
                        data.mutedAt = new Date().toLocaleString("en-GB", { timeZone: "Asia/Dhaka" });
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
                        data.banned = true;
                        data.bannedBy = String(userID);
                        data.bannedAt = new Date().toLocaleString("en-GB", { timeZone: "Asia/Dhaka" });
                        await Users.setData(targetID, { data });
                        global.data.userBanned.set(String(targetID), {
                            reason: "Reaction ban",
                            dateAdded: new Date().toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })
                        });
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
