"use strict";

const axios = require("axios");

module.exports.config = {
    name:            "adduser",
    version:         "2.0.0",
    hasPermssion:    1,
    credits:         "MOSTAKIM",
    description:     "Add one or more users to the group by UID or Facebook profile link",
    commandCategory: "group",
    usages:          "adduser [uid1 uid2 ... | facebook_link]",
    cooldowns:       3
};

module.exports.run = async function ({ api, event, args }) {
    const { threadID, messageID } = event;
    const out = (msg) => api.sendMessage(msg, threadID, messageID);

    if (!args[0]) {
        return out(
            `👥 𝗔𝗗𝗗𝗨𝗦𝗘𝗥\n` +
            `━━━━━━━━━━━━━━━━\n` +
            `📌 Usage:\n` +
            `.adduser 123456789\n` +
            `.adduser 111 222 333\n` +
            `.adduser https://facebook.com/someone`
        );
    }

    // ── Get thread info ───────────────────────────────────
    let threadInfo;
    try {
        threadInfo = await api.getThreadInfo(threadID);
    } catch (e) {
        return out(`❌ Group info নিতে পারিনি: ${e.message}`);
    }

    const participantIDs = new Set(threadInfo.participantIDs.map(String));
    const botID          = String(api.getCurrentUserID());
    const admins         = new Set((threadInfo.adminIDs || []).map(a => String(a.id || a)));
    const approvalMode   = threadInfo.approvalMode === true;
    const botIsAdmin     = admins.has(botID);

    // ── Resolve all UIDs ──────────────────────────────────
    const uids = [];

    for (const arg of args) {
        if (/^\d{5,20}$/.test(arg)) {
            uids.push(arg);
        } else if (arg.includes("facebook.com") || arg.includes("fb.com")) {
            const resolved = await resolveUID(arg);
            if (resolved) uids.push(resolved);
            else return out(`❌ Link থেকে UID বের করা যায়নি: ${arg}`);
        } else {
            return out(`❌ Valid UID বা Facebook link দাও।\nInvalid: "${arg}"`);
        }
    }

    if (uids.length === 0) return out("❌ কোনো valid UID পাওয়া যায়নি।");

    // ── Add each user ─────────────────────────────────────
    const results    = [];
    const toAdd      = uids.filter(uid => !participantIDs.has(uid));
    const alreadyIn  = uids.filter(uid =>  participantIDs.has(uid));

    if (alreadyIn.length > 0) {
        results.push(`⚠️ Already in group: ${alreadyIn.join(", ")}`);
    }

    let successCount = 0;
    let failCount    = 0;

    for (const uid of toAdd) {
        try {
            await api.addUserToGroup(uid, threadID);
            await delay(800); // small delay to avoid rate-limit

            if (approvalMode && !botIsAdmin) {
                results.push(`📨 Request sent: ${uid}`);
            } else {
                results.push(`✅ Added: ${uid}`);
            }
            successCount++;
        } catch (err) {
            const reason = friendlyError(err.message || String(err));
            results.push(`❌ Failed (${uid}): ${reason}`);
            failCount++;

            // If Facebook rate-limited, wait longer
            if (/rate|limit|flood/i.test(err.message || "")) {
                await delay(5000);
            }
        }
    }

    const summary =
        `👥 𝗔𝗗𝗗𝗨𝗦𝗘𝗥 𝗥𝗘𝗦𝗨𝗟𝗧\n` +
        `━━━━━━━━━━━━━━━━\n` +
        results.join("\n") +
        `\n━━━━━━━━━━━━━━━━\n` +
        `✅ Success: ${successCount} | ❌ Failed: ${failCount}`;

    return out(summary);
};

// ── Helpers ───────────────────────────────────────────────

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function friendlyError(msg) {
    if (/not a friend|not friend/i.test(msg))    return "User আপনার বন্ধু না";
    if (/privacy|blocked/i.test(msg))            return "User privacy restrict করেছে";
    if (/already/i.test(msg))                    return "Already in group";
    if (/limit|flood|rate/i.test(msg))           return "Facebook rate limit — একটু পরে try করো";
    if (/permission|admin/i.test(msg))           return "Bot-এর admin permission নেই";
    if (/not found|invalid/i.test(msg))          return "Invalid UID";
    return msg.slice(0, 80);
}

async function resolveUID(link) {
    // Try fetching page source and extracting UID
    try {
        const res  = await axios.get(link, {
            timeout: 15000,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
            }
        });
        const html = res.data;

        // Various patterns Facebook uses
        const patterns = [
            /"userID":"(\d+)"/,
            /"USER_ID":"(\d+)"/,
            /content="fb:\/\/profile\/(\d+)"/,
            /"profile_id":(\d+)/,
            /"actor_id":"(\d+)"/,
            /\/(\d{10,20})\/picture/
        ];
        for (const p of patterns) {
            const m = html.match(p);
            if (m) return m[1];
        }
    } catch {}
    return null;
}
