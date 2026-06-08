module.exports = function ({ api, models, Users, Threads, Currencies }) {

    // Strip Unicode variation selectors so emoji comparisons work reliably
    // Facebook sometimes appends U+FE0F or U+FE0E to emoji strings
    function normalizeEmoji(str) {
        if (!str) return '';
        return str.replace(/[\uFE00-\uFE0F]/g, '').normalize('NFC').trim();
    }

    // Wrap callback-based FCA api calls into Promises
    function apiCall(fn, ...args) {
        return new Promise((resolve, reject) => {
            try {
                fn(...args, (err, res) => {
                    if (err) reject(err);
                    else resolve(res);
                });
            } catch (e) { reject(e); }
        });
    }

    return async function ({ event }) {
        const { handleReaction, commands } = global.client;

        // ── Pull event fields ─────────────────────────────────────────────────
        const messageID = String(event.messageID || '');
        const threadID  = String(event.threadID  || '');
        const senderID  = String(event.senderID  || '');
        const userID    = String(event.userID    || '');  // sender of original message
        const reaction  = normalizeEmoji(event.reaction);

        // isGroup is now patched into the FCA reaction event; fallback to allThreadID check
        const isGroup = (typeof event.isGroup === 'boolean')
            ? event.isGroup
            : global.data.allThreadID.includes(threadID);

        // ── Config ────────────────────────────────────────────────────────────
        const ADMINBOT   = global.config.ADMINBOT   || [];
        const SUPERADMIN = global.config.SUPERADMIN || [];
        const DEV        = global.config.DEV        || [];
        const reactBy    = global.config.reactBy    || {};

        // Only ADMINBOT / SUPERADMIN / DEV can trigger reactBy actions
        const canReactBy = ADMINBOT.includes(senderID) ||
                           SUPERADMIN.includes(senderID) ||
                           DEV.includes(senderID);

        // Always log reaction events so reactBy issues can be diagnosed
        console.log('[reactBy]', { senderID, reaction, isGroup, canReactBy,
            inADMINBOT: ADMINBOT.includes(senderID), threadID });

        // ── reactBy system ────────────────────────────────────────────────────
        if (reactBy && reaction && canReactBy) {

            // Normalize config emoji lists the same way
            const deleteEmojis = (reactBy.delete || []).map(normalizeEmoji);
            const kickEmojis   = (reactBy.kick   || []).map(normalizeEmoji);

            console.log('[reactBy check]', { reaction, deleteEmojis, kickEmojis,
                isDelete: deleteEmojis.includes(reaction), isKick: kickEmojis.includes(reaction) });

            // DELETE: only unsend if the reacted message was sent by the bot itself
            if (deleteEmojis.length && deleteEmojis.includes(reaction)) {
                const botUID = String(api.getCurrentUserID ? api.getCurrentUserID() : '');
                const isBotMsg = botUID && userID === botUID;
                if (isBotMsg) {
                    try {
                        await apiCall(api.unsendMessage.bind(api), messageID);
                        console.log('[reactBy delete] ✅ unsent bot message:', messageID);
                    } catch (e) {
                        console.log('[reactBy delete error]', e?.message || e);
                    }
                } else {
                    // Silent — bot does NOT react to delete emoji on others' messages
                    console.log('[reactBy delete] silent — not bot\'s own message, userID:', userID);
                }
                return;
            }

            // KICK: admin reacts with kick emoji → kick original message sender
            if (kickEmojis.length && kickEmojis.includes(reaction)) {
                if (!isGroup) {
                    console.log('[reactBy kick] skipped — not a group');
                    return;
                }
                // Safety: never kick protected accounts
                const isProtected = !userID ||
                    ADMINBOT.includes(userID) ||
                    SUPERADMIN.includes(userID) ||
                    DEV.includes(userID) ||
                    userID === senderID;

                if (isProtected) {
                    console.log('[reactBy kick] skipped — userID is protected:', userID);
                    return;
                }
                try {
                    await apiCall(api.removeUserFromGroup.bind(api), userID, threadID);
                    console.log('[reactBy kick] ✅ removed:', userID, 'from', threadID);
                } catch (e) {
                    console.log('[reactBy kick error]', e?.message || e);
                    try {
                        api.sendMessage(
                            `⚠️ Cannot kick user ${userID}.\nMake sure I am a group admin.`,
                            senderID, () => {}
                        );
                    } catch (_) {}
                }
                return;
            }
        }

        // ── Command handleReaction (bot's own tracked messages) ───────────────
        if (!handleReaction || handleReaction.length === 0) return;

        // Match by raw (un-normalized) messageID
        const indexOfHandle = handleReaction.findIndex(e => e.messageID == event.messageID);
        if (indexOfHandle < 0) return;

        const indexOfMessage = handleReaction[indexOfHandle];
        const handleNeedExec = commands.get(indexOfMessage.name);

        if (!handleNeedExec) {
            return api.sendMessage(global.getText('handleReaction', 'missingValue'), threadID, event.messageID);
        }

        try {
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

            handleNeedExec.handleReaction({
                api, event, models, Users, Threads, Currencies,
                handleReaction: indexOfMessage,
                getText: getText2
            });
        } catch (error) {
            return api.sendMessage(
                global.getText('handleReaction', 'executeError', error),
                threadID, event.messageID
            );
        }
    };
};
