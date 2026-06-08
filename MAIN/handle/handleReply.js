module.exports = function ({ api, models, Users, Threads, Currencies }) {
    return async function ({ event }) {
        if (!event || !event.messageReply) return;

        const { handleReply, commands } = global.client;
        if (!handleReply || handleReply.length === 0) return;

        // ── Find tracked message ──────────────────────────────────────────────
        const indexOfHandle = handleReply.findIndex(e => e.messageID == event.messageReply.messageID);
        if (indexOfHandle < 0) return;

        const indexOfMessage = handleReply[indexOfHandle];
        const handleNeedExec = commands.get(indexOfMessage.name);
        if (!handleNeedExec) {
            return api.sendMessage(global.getText('handleReply', 'missingValue'), event.threadID, event.messageID);
        }

        // ── Normalize IDs ─────────────────────────────────────────────────────
        const dateNow   = Date.now();
        const senderID  = String(event.senderID  || '');
        const threadID  = String(event.threadID  || '');
        const messageID = String(event.messageID || '');

        // ── Config ────────────────────────────────────────────────────────────
        const {
            allowInbox, ADMINBOT, DeveloperMode,
            adminOnly, ndhOnly, adminPaOnly, superadminOnly
        } = global.config;

        const NDH        = global.config.NDH        || [];
        const SUPERADMIN = global.config.SUPERADMIN || [];
        const DEV        = global.config.DEV        || [];
        const hideNoti   = global.config.hideNotiMessage   || {};
        const spamCfg    = global.config.spamProtection    || { commandThreshold: 8, timeWindow: 10, banDuration: 24 };
        const wlMode     = global.config.whiteListMode       || { enable: false, whiteListIds: [] };
        const wlThread   = global.config.whiteListModeThread || { enable: false, whiteListThreadIds: [] };

        const { userBanned, threadBanned, threadInfo, commandBanned } = global.data;

        // ── Permission flags ──────────────────────────────────────────────────
        const isBotAdmin   = ADMINBOT.includes(senderID);
        const isSuperAdmin = SUPERADMIN.includes(senderID);
        const isNDH        = NDH.includes(senderID);
        const isDev        = DEV.includes(senderID);
        const isPrivileged = isBotAdmin || isSuperAdmin || isDev;

        // ── Night Mode ────────────────────────────────────────────────────────
        if (!isPrivileged) {
            const _nmState = global.data.nightMode || 'auto';
            let _isNight = false;
            if (_nmState === 'on') {
                _isNight = true;
            } else if (_nmState === 'auto') {
                const moment = require('moment-timezone');
                const _nightHour = moment.tz(global.config.timeZone || "Asia/Dhaka").hour();
                _isNight = (_nightHour >= 1 && _nightHour < 6);
            }
            if (_isNight) return;
        }

        // ── threadApproval ────────────────────────────────────────────────────
        const threadApprovalCfg = global.config.threadApproval || {};
        if (threadApprovalCfg.enable && !isPrivileged) {
            const approved = threadApprovalCfg.autoApprovedThreads || [];
            const existing = threadApprovalCfg.autoApproveExisting ? global.data.allThreadID : [];
            if (!approved.includes(threadID) && !existing.includes(threadID)) {
                if (threadApprovalCfg.sendThreadMessage)
                    api.sendMessage('⏳ This group is pending approval.', threadID, () => {});
                return;
            }
        }

        // ── whiteListModeThread ───────────────────────────────────────────────
        if (wlThread.enable && !isPrivileged) {
            const allowedThreads = wlThread.whiteListThreadIds || [];
            if (allowedThreads.length > 0 && !allowedThreads.includes(threadID)) return;
        }

        // ── whiteListMode ─────────────────────────────────────────────────────
        if (wlMode.enable && !isPrivileged) {
            const allowedUsers = wlMode.whiteListIds || [];
            if (allowedUsers.length > 0 && !allowedUsers.includes(senderID)) return;
        }

        // ── adminPaOnly (inbox only for admins) ───────────────────────────────
        if (!global.data.allThreadID.includes(threadID) && !isPrivileged && adminPaOnly == true) {
            if (hideNoti.adminOnly) return;
            return api.sendMessage("MODE » Only admins can use bots in their own inbox", threadID, messageID);
        }

        // ── superadminOnly ────────────────────────────────────────────────────
        if (superadminOnly == true && !isSuperAdmin && !isDev) {
            if (hideNoti.adminOnly) return;
            return api.sendMessage("MODE » Only super admins can use bots", threadID, messageID);
        }

        // ── adminOnly ─────────────────────────────────────────────────────────
        if (adminOnly == true && !isPrivileged) {
            if (hideNoti.adminOnly) return;
            return api.sendMessage("MODE » Only admins can use bots", threadID, messageID);
        }

        // ── ndhOnly ───────────────────────────────────────────────────────────
        if (ndhOnly == true && !isNDH && !isPrivileged) {
            if (hideNoti.adminOnly) return;
            return api.sendMessage("MODE » Only bot support can use bots", threadID, messageID);
        }

        // ── adminbox check ────────────────────────────────────────────────────
        try {
            const dataAdbox = require('../../MOSTAKIM/commands/cache/data.json');
            const threadInf = (threadInfo.get(threadID) || await Threads.getInfo(threadID));
            const isGroupAdmin = threadInf.adminIDs && threadInf.adminIDs.find(el => el.id == senderID);
            if (dataAdbox.adminbox && dataAdbox.adminbox.hasOwnProperty(threadID) &&
                dataAdbox.adminbox[threadID] == true && !isPrivileged && !isGroupAdmin && event.isGroup) {
                return api.sendMessage("MODE » Only group admins can use bots here", threadID, messageID);
            }
        } catch (e) {}

        // ── userBanned / threadBanned ─────────────────────────────────────────
        if (!isPrivileged) {
            if (userBanned.has(senderID)) {
                if (hideNoti.userBanned) return;
                const { reason, dateAdded } = userBanned.get(senderID) || {};
                return api.sendMessage(
                    global.getText("handleCommand", "userBanned", reason, dateAdded),
                    threadID,
                    async (err, info) => {
                        if (err || !info) return;
                        await new Promise(r => setTimeout(r, 5000));
                        api.unsendMessage(info.messageID);
                    },
                    messageID
                );
            }
            if (threadBanned.has(threadID)) {
                if (hideNoti.threadBanned) return;
                const { reason, dateAdded } = threadBanned.get(threadID) || {};
                return api.sendMessage(
                    global.getText("handleCommand", "threadBanned", reason, dateAdded),
                    threadID,
                    async (err, info) => {
                        if (err || !info) return;
                        await new Promise(r => setTimeout(r, 5000));
                        api.unsendMessage(info.messageID);
                    },
                    messageID
                );
            }
            if (allowInbox === false && senderID == threadID) return;
        }

        // ── spamProtection (shared tracker with handleCommand) ────────────────
        if (!global.data.spamTracker) global.data.spamTracker = new Map();
        const spamTracker = global.data.spamTracker;

        if (!isPrivileged && spamCfg.commandThreshold) {
            const now           = Date.now();
            const windowMs      = (spamCfg.timeWindow    || 10) * 1000;
            const threshold     = spamCfg.commandThreshold || 8;
            const banDurationMs = (spamCfg.banDuration   || 24) * 60 * 60 * 1000;

            let tracker = spamTracker.get(senderID);
            if (!tracker || (now - tracker.windowStart) > windowMs) {
                tracker = { count: 1, windowStart: now };
            } else {
                tracker.count++;
            }
            spamTracker.set(senderID, tracker);

            if (tracker.count > threshold) {
                global.data.userBanned.set(senderID, {
                    reason: "Spam protection - too many commands",
                    dateAdded: new Date().toLocaleString("en-US", {
                        timeZone: global.config.timeZone || "Asia/Dhaka"
                    })
                });
                spamTracker.delete(senderID);
                try {
                    await Users.setData(senderID, {
                        data: {
                            banned: 1, reason: "Spam protection",
                            dateAdded: new Date().toISOString(),
                            banExpiry: now + banDurationMs
                        }
                    });
                } catch (e) {}
                return api.sendMessage(
                    `⚠️ You've been temporarily banned for ${spamCfg.banDuration || 24}h due to spam!`,
                    threadID, messageID
                );
            }
        }

        // ── commandBanned ─────────────────────────────────────────────────────
        if (!isPrivileged && (commandBanned.get(threadID) || commandBanned.get(senderID))) {
            const cmdName    = handleNeedExec.config && handleNeedExec.config.name;
            const banThreads = commandBanned.get(threadID) || [];
            const banUsers   = commandBanned.get(senderID) || [];
            if (cmdName && banThreads.includes(cmdName))
                return api.sendMessage(
                    global.getText("handleCommand", "commandThreadBanned", cmdName),
                    threadID,
                    async (err, info) => {
                        if (err || !info) return;
                        await new Promise(r => setTimeout(r, 5000));
                        api.unsendMessage(info.messageID);
                    },
                    messageID
                );
            if (cmdName && banUsers.includes(cmdName))
                return api.sendMessage(
                    global.getText("handleCommand", "commandUserBanned", cmdName),
                    threadID,
                    async (err, info) => {
                        if (err || !info) return;
                        await new Promise(r => setTimeout(r, 5000));
                        api.unsendMessage(info.messageID);
                    },
                    messageID
                );
        }

        // ── NSFW check ────────────────────────────────────────────────────────
        if (handleNeedExec.config &&
            handleNeedExec.config.commandCategory &&
            handleNeedExec.config.commandCategory.toLowerCase() === 'nsfw' &&
            !global.data.threadAllowNSFW.includes(threadID) &&
            !isPrivileged)
            return api.sendMessage(
                global.getText("handleCommand", "threadNotAllowNSFW"),
                threadID,
                async (err, info) => {
                    if (err || !info) return;
                    await new Promise(r => setTimeout(r, 5000));
                    api.unsendMessage(info.messageID);
                },
                messageID
            );

        // ── Permission level ──────────────────────────────────────────────────
        var permssion = 0;
        try {
            const threadInfoo  = (threadInfo.get(threadID) || await Threads.getInfo(threadID));
            const isGroupAdmin = threadInfoo.adminIDs && threadInfoo.adminIDs.find(el => el.id == senderID);
            if (isGroupAdmin && !isPrivileged && !isNDH) permssion = 1;
        } catch (e) {}
        if (isNDH)                 permssion = 2;
        if (isBotAdmin)            permssion = 3;
        if (isSuperAdmin || isDev) permssion = 4;

        if (handleNeedExec.config && handleNeedExec.config.hasPermssion > permssion) {
            if (hideNoti.needRoleToUseCmd) return;
            return api.sendMessage(
                global.getText("handleCommand", "permssionNotEnough", handleNeedExec.config.name),
                threadID, messageID
            );
        }

        // ── Cooldown ──────────────────────────────────────────────────────────
        const cmdName4Cool = handleNeedExec.config && handleNeedExec.config.name;
        if (cmdName4Cool) {
            if (!global.client.cooldowns.has(cmdName4Cool))
                global.client.cooldowns.set(cmdName4Cool, new Map());
            const timestamps     = global.client.cooldowns.get(cmdName4Cool);
            const expirationTime = (handleNeedExec.config.cooldowns || 1) * 1000;
            if (!isPrivileged && timestamps.has(senderID) && dateNow < timestamps.get(senderID) + expirationTime)
                return api.sendMessage(
                    `⏳ Please wait ${((timestamps.get(senderID) + expirationTime - dateNow) / 1000).toFixed(1)}s before replying again.`,
                    threadID, messageID
                );
            timestamps.set(senderID, dateNow);
        }

        // ── getText builder ───────────────────────────────────────────────────
        var getText2;
        if (handleNeedExec.languages && typeof handleNeedExec.languages === 'object') {
            getText2 = (...value) => {
                if (!handleNeedExec.languages.hasOwnProperty(global.config.language)) return '';
                var lang = handleNeedExec.languages[global.config.language][value[0]] || '';
                for (var i = 1; i < value.length; i++)
                    lang = lang.replace(new RegExp('%' + i, 'g'), value[i]);
                return lang;
            };
        } else getText2 = () => {};

        // ── Execute handleReply callback ───────────────────────────────────────
        try {
            handleNeedExec.handleReply({
                api, event, models, Users, Threads, Currencies,
                handleReply: indexOfMessage,
                getText: getText2
            });
        } catch (error) {
            return api.sendMessage(
                global.getText('handleReply', 'executeError', error),
                threadID, messageID
            );
        }
    };
};
