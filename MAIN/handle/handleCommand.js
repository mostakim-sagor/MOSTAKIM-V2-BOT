module.exports = function ({ api, models, Users, Threads, Currencies }) {
  const stringSimilarity = require('string-similarity'),
    escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    logger = require("../../utils/log.js");
  const axios = require('axios');
  const moment = require("moment-timezone");

  // Shared spam tracker — handleReply also uses this so reply-based spam is caught too
  if (!global.data.spamTracker) global.data.spamTracker = new Map();
  const spamTracker = global.data.spamTracker;

  return async function ({ event }) {
    if (!event || !event.body) return;
    const dateNow = Date.now();
    const time = moment.tz("Asia/Dhaka").format("HH:mm:ss DD/MM/YYYY");

    const {
      allowInbox, PREFIX, ADMINBOT, DeveloperMode,
      adminOnly, ndhOnly, adminPaOnly, superadminOnly
    } = global.config;

    const NDH        = global.config.NDH        || [];
    const SUPERADMIN = global.config.SUPERADMIN || [];
    const DEV        = global.config.DEV        || [];
    const VIP        = global.config.VIP        || [];

    const usePrefix    = global.config.usePrefix    || { enable: true };
    const adminPrefix  = global.config.adminPrefix  || { enable: false };
    const hideNoti     = global.config.hideNotiMessage || {};
    const spamCfg      = global.config.spamProtection || { commandThreshold: 8, timeWindow: 10, banDuration: 24 };
    const wlMode       = global.config.whiteListMode  || { enable: false, whiteListIds: [] };
    const wlModeThread = global.config.whiteListModeThread || { enable: false, whiteListThreadIds: [] };

    const { userBanned, threadBanned, threadInfo, threadData, commandBanned } = global.data;
    const { commands } = global.client;

    var { body, senderID, threadID, messageID } = event;
    senderID = String(senderID);
    threadID = String(threadID);

    if (!body) return;

    const threadSetting   = threadData.get(threadID) || {};
    const rawPrefix       = threadSetting.hasOwnProperty("PREFIX") ? threadSetting.PREFIX : PREFIX;
    const effectivePrefix = (typeof rawPrefix === "string" && rawPrefix.length > 0) ? rawPrefix : (PREFIX || "/");

    const isBotAdmin   = ADMINBOT.includes(senderID);
    const isSuperAdmin = SUPERADMIN.includes(senderID);
    const isNDH        = NDH.includes(senderID);
    const isDev        = DEV.includes(senderID);
    const isPrivileged = isBotAdmin || isSuperAdmin || isDev;

    const adminPrefixRoles = (adminPrefix.allowedRoles || ["ADMINBOT", "SUPERADMIN", "DEV"]);
    const isAdminPrefixUser = (
      (adminPrefixRoles.includes("ADMINBOT")   && isBotAdmin) ||
      (adminPrefixRoles.includes("SUPERADMIN") && isSuperAdmin) ||
      (adminPrefixRoles.includes("NDH")        && isNDH) ||
      (adminPrefixRoles.includes("DEV")        && isDev)
    );

    const noPrefixGlobal = usePrefix.enable === false;
    const noPrefixAdmin  = adminPrefix.enable && adminPrefix.noPrefix && isAdminPrefixUser;

    const prefixRegex = new RegExp(`^(<@!?${senderID}>|${escapeRegex(effectivePrefix)})\\s*`);

    let args;
    if (noPrefixGlobal || noPrefixAdmin) {
      // Strip prefix if present (admin may optionally use prefix), otherwise use raw body
      const prefixMatch = body.match(prefixRegex);
      const stripped = prefixMatch
        ? body.slice(prefixMatch[0].length).trim()
        : body.trim();
      args = stripped.split(/ +/);
    } else {
      if (!prefixRegex.test(body)) return;
      const [matchedPrefix] = body.match(prefixRegex);
      args = body.slice(matchedPrefix.length).trim().split(/ +/);
    }

    var commandName = (args.shift() || '').toLowerCase();
    if (!commandName) return;

    // ── Night Mode ────────────────────────────────────────────────────────────
    if (!isPrivileged) {
      const _nmState = global.data.nightMode || 'auto';
      let _isNight = false;
      if (_nmState === 'on') {
        _isNight = true;
      } else if (_nmState === 'auto') {
        const _nightHour = moment.tz(global.config.timeZone || "Asia/Dhaka").hour();
        _isNight = (_nightHour >= 1 && _nightHour < 6);
      }
      if (_isNight) return;
    }

    // ── threadApproval ────────────────────────────────────────────────────────
    const threadApprovalCfg = global.config.threadApproval || {};
    if (threadApprovalCfg.enable && !isPrivileged) {
      const approved = threadApprovalCfg.autoApprovedThreads || [];
      const existing = threadApprovalCfg.autoApproveExisting ? global.data.allThreadID : [];
      if (!approved.includes(threadID) && !existing.includes(threadID)) {
        if (threadApprovalCfg.sendNotifications) {
          const notiMsg = `📋 New thread requesting bot access:\nThread ID: ${threadID}\n\nTo approve: add threadID to config.json > threadApproval > autoApprovedThreads`;
          for (const tid of (threadApprovalCfg.adminNotificationThreads || [])) {
            api.sendMessage(notiMsg, tid, () => {});
          }
        }
        if (threadApprovalCfg.sendThreadMessage) {
          api.sendMessage('⏳ This group is pending approval. Please wait for an admin to approve this bot.', threadID, () => {});
        }
        return;
      }
    }

    // ── whiteListModeThread ──────────────────────────────────────────────────
    if (wlModeThread.enable && !isPrivileged) {
      const allowedThreads = wlModeThread.whiteListThreadIds || [];
      if (allowedThreads.length > 0 && !allowedThreads.includes(threadID)) return;
    }

    // ── whiteListMode ────────────────────────────────────────────────────────
    if (wlMode.enable && !isPrivileged) {
      const allowedUsers = wlMode.whiteListIds || [];
      if (allowedUsers.length > 0 && !allowedUsers.includes(senderID)) return;
    }

    // ── adminPaOnly (inbox only for admins) ──────────────────────────────────
    if (!global.data.allThreadID.includes(threadID) && !isPrivileged && adminPaOnly == true) {
      if (hideNoti.adminOnly) return;
      return api.sendMessage("MODE » Only admins can use bots in their own inbox", threadID, messageID);
    }

    // ── superadminOnly ───────────────────────────────────────────────────────
    if (superadminOnly == true && !isSuperAdmin && !isDev) {
      if (hideNoti.adminOnly) return;
      return api.sendMessage("MODE » Only super admins can use bots", threadID, messageID);
    }

    // ── adminOnly ────────────────────────────────────────────────────────────
    if (adminOnly == true && !isPrivileged) {
      if (hideNoti.adminOnly) return;
      return api.sendMessage("MODE » Only admins can use bots", threadID, messageID);
    }

    // ── ndhOnly ──────────────────────────────────────────────────────────────
    if (ndhOnly == true && !isNDH && !isPrivileged) {
      if (hideNoti.adminOnly) return;
      return api.sendMessage("MODE » Only bot support can use bots", threadID, messageID);
    }

    // ── adminbox check ───────────────────────────────────────────────────────
    try {
      const dataAdbox = require('../../MOSTAKIM/commands/cache/data.json');
      const threadInf = (threadInfo.get(threadID) || await Threads.getInfo(threadID));
      const isGroupAdmin = threadInf.adminIDs && threadInf.adminIDs.find(el => el.id == senderID);
      if (dataAdbox.adminbox && dataAdbox.adminbox.hasOwnProperty(threadID) &&
          dataAdbox.adminbox[threadID] == true && !isPrivileged && !isGroupAdmin && event.isGroup) {
        return api.sendMessage("MODE » Only admins can use bots", threadID, messageID);
      }
    } catch (e) {}

    // ── userBanned / threadBanned ─────────────────────────────────────────────
    if (!isPrivileged) {
      if (userBanned.has(senderID)) {
        if (hideNoti.userBanned) return;
        const { reason, dateAdded } = userBanned.get(senderID) || {};
        return api.sendMessage(global.getText("handleCommand", "userBanned", reason, dateAdded), threadID, async (err, info) => {
          if (err || !info) return;
          await new Promise(r => setTimeout(r, 5000));
          api.unsendMessage(info.messageID);
        }, messageID);
      }
      if (threadBanned.has(threadID)) {
        if (hideNoti.threadBanned) return;
        const { reason, dateAdded } = threadBanned.get(threadID) || {};
        return api.sendMessage(global.getText("handleCommand", "threadBanned", reason, dateAdded), threadID, async (err, info) => {
          if (err || !info) return;
          await new Promise(r => setTimeout(r, 5000));
          api.unsendMessage(info.messageID);
        }, messageID);
      }
      if (allowInbox === false && senderID == threadID) return;
    }

    // ── command lookup ───────────────────────────────────────────────────────
    var command = commands.get(commandName);

    // Check aliases map if direct lookup failed
    if (!command && global.client.aliases && global.client.aliases.has(commandName)) {
      const realName = global.client.aliases.get(commandName);
      command = commands.get(realName);
    }

    if (!command) {
      // No-prefix mode: silently ignore non-exact matches
      // Fuzzy matching in no-prefix mode causes every random sentence to trigger commands
      if (noPrefixGlobal || noPrefixAdmin) return;

      // Prefix was explicitly used → allow fuzzy/suggestion matching
      const allCommandNames = Array.from(commands.keys());
      if (allCommandNames.length === 0) return;
      const checker = stringSimilarity.findBestMatch(commandName, allCommandNames);
      if (checker.bestMatch.rating >= 0.5) {
        command = global.client.commands.get(checker.bestMatch.target);
      } else {
        if (hideNoti.commandNotFound) return;
        return api.sendMessage(global.getText("handleCommand", "commandNotExist", checker.bestMatch.target), threadID);
      }
    }

    // ── spamProtection ───────────────────────────────────────────────────────
    if (!isPrivileged && spamCfg.commandThreshold) {
      const now = Date.now();
      const windowMs = (spamCfg.timeWindow || 10) * 1000;
      const threshold = spamCfg.commandThreshold || 8;
      const banDurationMs = (spamCfg.banDuration || 24) * 60 * 60 * 1000;

      let tracker = spamTracker.get(senderID);
      if (!tracker || (now - tracker.windowStart) > windowMs) {
        tracker = { count: 1, windowStart: now };
      } else {
        tracker.count++;
      }
      spamTracker.set(senderID, tracker);

      if (tracker.count > threshold) {
        const banExpiry = now + banDurationMs;
        global.data.userBanned.set(senderID, {
          reason: "Spam protection - too many commands",
          dateAdded: new Date().toLocaleString("en-US", { timeZone: global.config.timeZone || "Asia/Dhaka" })
        });
        spamTracker.delete(senderID);
        try {
          await Users.setData(senderID, { data: { banned: 1, reason: "Spam protection", dateAdded: new Date().toISOString(), banExpiry } });
        } catch (e) {}
        return api.sendMessage(`⚠️ You've been temporarily banned for ${spamCfg.banDuration || 24}h due to spam!`, threadID, messageID);
      }
    }

    // ── commandBanned ─────────────────────────────────────────────────────────
    if (!isPrivileged && (commandBanned.get(threadID) || commandBanned.get(senderID))) {
      const banThreads = commandBanned.get(threadID) || [];
      const banUsers   = commandBanned.get(senderID) || [];
      if (banThreads.includes(command.config.name))
        return api.sendMessage(global.getText("handleCommand", "commandThreadBanned", command.config.name), threadID, async (err, info) => {
          if (err || !info) return;
          await new Promise(r => setTimeout(r, 5000));
          api.unsendMessage(info.messageID);
        }, messageID);
      if (banUsers.includes(command.config.name))
        return api.sendMessage(global.getText("handleCommand", "commandUserBanned", command.config.name), threadID, async (err, info) => {
          if (err || !info) return;
          await new Promise(r => setTimeout(r, 5000));
          api.unsendMessage(info.messageID);
        }, messageID);
    }

    // ── NSFW check ────────────────────────────────────────────────────────────
    if (command.config.commandCategory && command.config.commandCategory.toLowerCase() == 'nsfw' &&
        !global.data.threadAllowNSFW.includes(threadID) && !isPrivileged)
      return api.sendMessage(global.getText("handleCommand", "threadNotAllowNSFW"), threadID, async (err, info) => {
        if (err || !info) return;
        await new Promise(r => setTimeout(r, 5000));
        api.unsendMessage(info.messageID);
      }, messageID);

    // ── permission level ──────────────────────────────────────────────────────
    var permssion = 0;
    try {
      const threadInfoo = (threadInfo.get(threadID) || await Threads.getInfo(threadID));
      const isGroupAdmin = threadInfoo.adminIDs && threadInfoo.adminIDs.find(el => el.id == senderID);
      if (isGroupAdmin && !isPrivileged && !isNDH) permssion = 1;
    } catch (e) {}
    if (isNDH)        permssion = 2;
    if (isBotAdmin)   permssion = 3;
    if (isSuperAdmin || isDev) permssion = 4;

    if (command.config.hasPermssion > permssion) {
      if (hideNoti.needRoleToUseCmd) return;
      return api.sendMessage(global.getText("handleCommand", "permssionNotEnough", command.config.name), threadID, messageID);
    }

    // ── cooldowns ─────────────────────────────────────────────────────────────
    if (!global.client.cooldowns.has(command.config.name)) global.client.cooldowns.set(command.config.name, new Map());
    const timestamps     = global.client.cooldowns.get(command.config.name);
    const expirationTime = (command.config.cooldowns || 1) * 1000;
    if (!isPrivileged && timestamps.has(senderID) && dateNow < timestamps.get(senderID) + expirationTime)
      return api.sendMessage(
        `⏳ Please wait ${((timestamps.get(senderID) + expirationTime - dateNow) / 1000).toFixed(1)}s before using this command again.`,
        threadID, messageID
      );

    // ── typingIndicator ───────────────────────────────────────────────────────
    const typingCfg = global.config.typingIndicator || { enable: false, duration: 500 };
    if (typingCfg.enable) {
      try { api.sendTypingIndicator(threadID); } catch (e) {}
    }

    // ── getText builder ───────────────────────────────────────────────────────
    var getText2;
    if (command.languages && typeof command.languages == 'object' && command.languages.hasOwnProperty(global.config.language))
      getText2 = (...values) => {
        var lang = command.languages[global.config.language][values[0]] || '';
        for (var i = 1; i < values.length; i++) {
          lang = lang.replace(new RegExp(`%${i}`, 'g'), values[i]);
        }
        return lang;
      };
    else getText2 = () => '';

    // ── Daily usage tracking ──────────────────────────────────────────────────
    {
      const _today = moment.tz(global.config.timeZone || "Asia/Dhaka").format("YYYY-MM-DD");
      if (!global.data.dailyUsage) global.data.dailyUsage = {};
      if (!global.data.dailyUsage[_today]) global.data.dailyUsage[_today] = {};
      global.data.dailyUsage[_today][senderID] = (global.data.dailyUsage[_today][senderID] || 0) + 1;
    }

    // ── GoatBot-compatible message wrapper (for onStart commands) ─────────────
    const message = {
      reply: (body, callback) => {
        const msg = (typeof body === "string") ? { body } : body;
        return api.sendMessage(msg, threadID, callback, messageID);
      },
      reaction: (emoji, msgID) => {
        try { api.setMessageReaction(emoji, msgID || messageID, () => {}, true); } catch (e) {}
      },
      unsend: (msgID) => {
        try { api.unsendMessage(msgID); } catch (e) {}
      },
      SyntaxError: (extra) => {
        const guide = command.config.guide || command.config.usages || "";
        const usage = typeof guide === "object" ? (guide.en || guide.vi || "") : guide;
        const usageStr = usage.replace(/\{pn\}/g, effectivePrefix + commandName);
        return api.sendMessage(
          `❌ Wrong usage!\n📖 ${effectivePrefix}${commandName} ${usageStr || ""}`.trim(),
          threadID, messageID
        );
      },
      add: (userID, callback) => api.addUserToGroup(userID, threadID, callback),
      kick: (userID, callback) => api.removeUserFromGroup(userID, threadID, callback),
    };

    // ── getLang for GoatBot onStart commands ──────────────────────────────────
    const getLang = (...values) => getText2(...values);

    // ── run command (supports both run & onStart) ──────────────────────────────
    const execFn = command.onStart || command.run;
    if (!execFn) return;

    try {
      event._commandHandled = true; // prevent handleCommandEvent double-firing
      execFn({
        api, event, args, models, message,
        Users, Threads, Currencies,
        usersData: Users, threadsData: Threads,
        permssion, role: permssion,
        commandName, getLang,
        getText: getText2,
      });
      timestamps.set(senderID, dateNow);
      if (DeveloperMode == true)
        logger(global.getText("handleCommand", "executeCommand", time, commandName, senderID, threadID, args.join(" "), Date.now() - dateNow), "[ DEV MODE ]");
    } catch (e) {
      return api.sendMessage(global.getText("handleCommand", "commandError", commandName, e), threadID);
    }
  };
};
