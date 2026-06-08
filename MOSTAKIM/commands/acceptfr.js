"use strict";

if (!global.autoAcceptFR) global.autoAcceptFR = false;
if (!global.autoAcceptFR_interval) global.autoAcceptFR_interval = null;

module.exports = {
  config: {
    name:            "acceptfr",
    version:         "1.1.0",
    hasPermssion:    2,
    credits:         "MOSTAKIM",
    description:     "Accept bot's pending friend requests",
    commandCategory: "system",
    usages:          "acceptfr | acceptfr all | acceptfr on | acceptfr off | acceptfr <uid>",
    cooldowns:       10,
  },

  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;
    const out = (msg) => api.sendMessage(msg, threadID, messageID);
    const sub = (args[0] || "").toLowerCase().trim();

    // ── Toggle auto-accept ON ─────────────────────────────────────────────────
    if (sub === "on") {
      if (global.autoAcceptFR)
        return out("✅ Auto-accept mode ইতিমধ্যে চালু আছে!");

      global.autoAcceptFR = true;
      startAutoAccept(api);
      return out(
        "✅ Auto-accept mode চালু!\n" +
        "🔄 প্রতি ৫ মিনিটে pending friend request auto accept হবে।\n" +
        "বন্ধ করতে: /acceptfr off"
      );
    }

    // ── Toggle auto-accept OFF ────────────────────────────────────────────────
    if (sub === "off") {
      global.autoAcceptFR = false;
      if (global.autoAcceptFR_interval) {
        clearInterval(global.autoAcceptFR_interval);
        global.autoAcceptFR_interval = null;
      }
      return out("❌ Auto-accept mode বন্ধ করা হয়েছে।");
    }

    // ── Accept specific UID ───────────────────────────────────────────────────
    if (sub && /^\d+$/.test(sub)) {
      try {
        await api.handleFriendRequest(sub, true);
        return out(`✅ UID ${sub} এর friend request accept করা হয়েছে!`);
      } catch (e) {
        console.error("[AcceptFR] Manual accept error:", e);
        return out(`❌ Accept করতে পারিনি!\n⚠️ ${e.message || e}`);
      }
    }

    // ── Status (no sub) ───────────────────────────────────────────────────────
    if (!sub) {
      return out(
        `📋 𝗔𝗖𝗖𝗘𝗣𝗧𝗙𝗥 𝗦𝗧𝗔𝗧𝗨𝗦\n` +
        `━━━━━━━━━━━━━━━\n` +
        `🔄 Auto-accept: ${global.autoAcceptFR ? "চালু ✅" : "বন্ধ ❌"}\n\n` +
        `📌 𝗨𝘀𝗮𝗴𝗲:\n` +
        `• acceptfr on       → Auto-accept চালু\n` +
        `• acceptfr off      → Auto-accept বন্ধ\n` +
        `• acceptfr all      → সব pending accept\n` +
        `• acceptfr <uid>    → নির্দিষ্ট UID accept\n` +
        `• acceptfr list     → Pending list দেখাও\n` +
        `━━━━━━━━━━━━━━━\n` +
        `⚡ MOSTAKIM V2 BOT`
      );
    }

    // ── List pending ──────────────────────────────────────────────────────────
    if (sub === "list" || sub === "all") {
      const waitMsg = await api.sendMessage("⏳ Pending friend requests দেখা হচ্ছে...", threadID);

      try {
        const pendingList = await getPendingFriendRequests(api);

        try { api.unsendMessage(waitMsg.messageID); } catch {}

        if (pendingList.length === 0) {
          return out(
            `✅ কোনো pending friend request নেই।\n` +
            `🔄 Auto-accept: ${global.autoAcceptFR ? "চালু ✅" : "বন্ধ ❌"}`
          );
        }

        if (sub === "all") {
          const result = await acceptAll(api, pendingList);
          return out(
            `✅ 𝗙𝗥𝗜𝗘𝗡𝗗 𝗥𝗘𝗤𝗨𝗘𝗦𝗧 𝗔𝗖𝗖𝗘𝗣𝗧𝗘𝗗\n` +
            `━━━━━━━━━━━━━━━\n` +
            `✔️ Accept: ${result.success}\n` +
            `❌ Failed: ${result.failed}\n` +
            `━━━━━━━━━━━━━━━\n` +
            `🔄 Auto-accept: ${global.autoAcceptFR ? "চালু ✅" : "বন্ধ ❌"}`
          );
        }

        // Show list
        const listText = pendingList.slice(0, 20)
          .map((u, i) => `${i + 1}. ${u.name} (${u.uid})`)
          .join("\n");
        const extra = pendingList.length > 20 ? `\n... এবং আরও ${pendingList.length - 20} জন` : "";

        return out(
          `📋 𝗣𝗘𝗡𝗗𝗜𝗡𝗚 𝗙𝗥𝗜𝗘𝗡𝗗 𝗥𝗘𝗤𝗨𝗘𝗦𝗧𝗦\n` +
          `━━━━━━━━━━━━━━━\n` +
          `👥 মোট: ${pendingList.length} জন\n\n` +
          `${listText}${extra}\n` +
          `━━━━━━━━━━━━━━━\n` +
          `সব accept করতে: /acceptfr all`
        );

      } catch (e) {
        try { api.unsendMessage(waitMsg.messageID); } catch {}
        console.error("[AcceptFR] getPendingFriendRequests failed:", e);
        return out(
          `❌ Pending list আনতে পারিনি!\n` +
          `⚠️ Error: ${e.message || String(e)}\n\n` +
          `💡 নির্দিষ্ট UID দিয়ে accept করো:\n/acceptfr <uid>\n\n` +
          `🔄 Auto-accept: ${global.autoAcceptFR ? "চালু ✅" : "বন্ধ ❌"}`
        );
      }
    }

    return out(`❌ Unknown subcommand: "${sub}"\nUsage: /acceptfr | all | on | off | list | <uid>`);
  }
};

// ── httpPost helper (callback → Promise, same pattern as config.js) ─────────
function httpPostAsync(api, url, form) {
  return new Promise((resolve, reject) => {
    api.httpPost(url, form, (err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });
}

// ── httpGet helper ────────────────────────────────────────────────────────────
function httpGetAsync(api, url) {
  return new Promise((resolve, reject) => {
    api.httpGet(url, (err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });
}

// ── Get pending friend requests ───────────────────────────────────────────────
async function getPendingFriendRequests(api) {
  const botID = api.getCurrentUserID();
  const errors = [];

  // Method 1: GraphQL FriendRequests query (multiple doc_ids to try)
  const docIds = [
    "4267437483315407",
    "3369816276399999",
    "5117232945022085",
    "2754644701349272",
  ];

  for (const docId of docIds) {
    try {
      const form = {
        av: botID,
        fb_api_caller_class: "RelayModern",
        fb_api_req_friendly_name: "FriendingCometFriendRequestsRootQueryRendererQuery",
        doc_id: docId,
        variables: JSON.stringify({ count: 100, scale: 3 })
      };
      const raw  = await httpPostAsync(api, "https://www.facebook.com/api/graphql/", form);
      const data = JSON.parse(raw);

      console.log(`[AcceptFR] GraphQL doc_id ${docId} response keys:`, Object.keys(data?.data || {}));

      const edges =
        data?.data?.viewer?.friending_possibilities?.edges ||
        data?.data?.viewer?.friend_requests?.edges ||
        data?.data?.friends_all_pagination?.edges ||
        [];

      if (edges.length > 0) {
        console.log(`[AcceptFR] Found ${edges.length} pending requests via GraphQL doc_id ${docId}`);
        return edges.map(e => ({
          uid:  e.node?.id || e.node?.friend?.id || "",
          name: e.node?.name || e.node?.friend?.name || "Unknown"
        })).filter(u => u.uid);
      }
    } catch (e) {
      errors.push(`GraphQL(${docId}): ${e.message}`);
      console.error(`[AcceptFR] GraphQL doc_id ${docId} failed:`, e.message);
    }
  }

  // Method 2: Legacy friends requests AJAX page (cookie-authenticated)
  try {
    const html = await httpGetAsync(api, "https://www.facebook.com/friends/requests/");
    console.log("[AcceptFR] friends/requests/ response length:", html?.length || 0);

    // Extract UIDs from page source (multiple patterns)
    const uidPatterns = [
      /friend_requester_id['":\s]+(\d{10,20})/g,
      /"id":"(\d{10,20})","__typename":"User"/g,
      /FriendRequest[^}]*"id":"(\d{10,20})"/g,
    ];
    const uidSet = new Set();
    for (const pat of uidPatterns) {
      for (const m of html.matchAll(pat)) uidSet.add(m[1]);
    }

    // Extract names from page source
    const nameMap = {};
    for (const m of html.matchAll(/"name":"([^"]+)","id":"(\d{10,20})"/g)) {
      nameMap[m[2]] = m[1];
    }

    console.log(`[AcceptFR] Extracted ${uidSet.size} UIDs from friends/requests/ page`);

    if (uidSet.size > 0) {
      return [...uidSet].map(uid => ({ uid, name: nameMap[uid] || "Unknown" }));
    }
    errors.push("HTML parse: 0 UIDs found in page");
  } catch (e) {
    errors.push(`HTML parse: ${e.message}`);
    console.error("[AcceptFR] friends/requests/ page failed:", e.message);
  }

  // Method 3: Legacy JSON endpoint
  try {
    const raw = await httpGetAsync(api, "https://www.facebook.com/friends/requests/?format=json");
    console.log("[AcceptFR] Legacy JSON endpoint response:", raw?.slice(0, 200));
    const cleaned = raw.replace(/^for\s*\(;;\);/, "");
    const data = JSON.parse(cleaned);
    const reqs = data?.payload?.requests || data?.payload?.items || [];
    if (reqs.length > 0) {
      console.log(`[AcceptFR] Found ${reqs.length} requests via legacy endpoint`);
      return reqs.map(r => ({
        uid:  String(r.uid || r.id || r.friend_uid || ""),
        name: r.name || r.title || "Unknown"
      })).filter(u => u.uid);
    }
    errors.push("Legacy JSON: 0 requests");
  } catch (e) {
    errors.push(`Legacy JSON: ${e.message}`);
    console.error("[AcceptFR] Legacy JSON failed:", e.message);
  }

  throw new Error(
    "সব method fail:\n" + errors.slice(0, 3).join("\n") +
    "\n\nFacebook API restricted আছে। /acceptfr <uid> দিয়ে manually করো।"
  );
}

// ── Accept all ────────────────────────────────────────────────────────────────
async function acceptAll(api, list) {
  let success = 0, failed = 0;
  for (const user of list) {
    try {
      await api.handleFriendRequest(user.uid, true);
      success++;
      console.log(`[AcceptFR] ✅ Accepted: ${user.name} (${user.uid})`);
      await new Promise(r => setTimeout(r, 600));
    } catch (e) {
      failed++;
      console.error(`[AcceptFR] ❌ Failed: ${user.uid} →`, e.message);
    }
  }
  return { success, failed };
}

// ── Auto-accept interval (every 5 minutes) ────────────────────────────────────
function startAutoAccept(api) {
  if (global.autoAcceptFR_interval) clearInterval(global.autoAcceptFR_interval);

  global.autoAcceptFR_interval = setInterval(async () => {
    if (!global.autoAcceptFR) {
      clearInterval(global.autoAcceptFR_interval);
      global.autoAcceptFR_interval = null;
      return;
    }
    console.log("[AutoFR] 🔄 Checking pending friend requests...");
    try {
      const list = await getPendingFriendRequests(api);
      if (list.length > 0) {
        const result = await acceptAll(api, list);
        console.log(`[AutoFR] ✅ Auto-accepted ${result.success} | Failed ${result.failed}`);
      } else {
        console.log("[AutoFR] ✅ No pending friend requests.");
      }
    } catch (e) {
      console.error("[AutoFR] ⚠️ Check failed:", e.message.split("\n")[0]);
    }
  }, 5 * 60 * 1000);

  console.log("[AutoFR] 🟢 Auto-accept mode started (every 5 min)");
}
