module.exports.config = {
  name: "prefix",
  version: "1.3.0",
  hasPermssion: 0,
  credits: "MOSTAKIM",
  description: "Display the bot's prefix and owner info",
  commandCategory: "info",
  usages: "",
  cooldowns: 5
};

const GHOST_PREFIXES = ['-', ",", ".", "?", "*", "!"];

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getSenderName(api, senderID) {
  try {
    const info = await api.getUserInfo(senderID);
    return info?.[senderID]?.name || "Friend";
  } catch {
    return "Friend";
  }
}

module.exports.handleEvent = async ({ event, api }) => {
  const { threadID, body, senderID } = event;
  if (!body) return;

  const threadSetting = global.data.threadData.get(String(threadID)) || {};
  const globalPrefix  = global.config.PREFIX  || "/";
  const threadPrefix  = threadSetting.PREFIX  || globalPrefix;
  const botName       = global.config.BOTNAME || "MOSTAKIM V2 BOT";

  const trimmedLower = body.trim().toLowerCase();
  const trimmedBody  = body.trim();

  // Skip if already handled by run()
  const prefixCmdRegex = new RegExp(`^${escapeRegex(threadPrefix)}\\s*prefix(\\s|$)`, "i");
  if (prefixCmdRegex.test(trimmedBody)) return;

  const noPrefixMode  = global.config.usePrefix && global.config.usePrefix.enable === false;
  const ADMINBOT      = global.config.ADMINBOT   || [];
  const SUPERADMIN    = global.config.SUPERADMIN || [];
  const DEV           = global.config.DEV        || [];
  const adminPrefix   = global.config.adminPrefix || {};
  const adminPrefixRoles = adminPrefix.allowedRoles || ["ADMINBOT","SUPERADMIN","DEV"];
  const senderStr     = String(senderID);
  const isAdminPrefixUser = (
    (adminPrefixRoles.includes("ADMINBOT")   && ADMINBOT.includes(senderStr))   ||
    (adminPrefixRoles.includes("SUPERADMIN") && SUPERADMIN.includes(senderStr)) ||
    (adminPrefixRoles.includes("DEV")        && DEV.includes(senderStr))
  );
  const noPrefixAdmin = adminPrefix.enable && adminPrefix.noPrefix && isAdminPrefixUser;
  if ((noPrefixMode || noPrefixAdmin) && trimmedLower === "prefix") return;

  // ── Case 1: Actual prefix sent alone ──
  if (trimmedBody === globalPrefix || trimmedBody === threadPrefix) {
    const name = await getSenderName(api, senderID);
    return api.sendMessage(
      `${name}! Hey, I'm Here! 👋\n\n` +
      `➥ 🌐 Global Prefix: < ${globalPrefix} >\n` +
      `➥ 💬 This Chat Prefix: < ${threadPrefix} >\n\n` +
      `I'm < ${botName} > at your service 🫡\n` +
      `Try: ${threadPrefix}help`,
      threadID
    );
  }

  // ── Case 2: Ghost prefix ──
  if (
    GHOST_PREFIXES.includes(trimmedBody) &&
    trimmedBody !== threadPrefix &&
    trimmedBody !== globalPrefix
  ) {
    return api.sendMessage(
      `Hey I'm Here < ${botName} >\n\n` +
      `🌐 Global Prefix: < ${globalPrefix} >\n` +
      `💬 Box Prefix: < ${threadPrefix} >`,
      threadID
    );
  }

  // ── Case 3: Keyword trigger ──
  const triggerWords = [
    "bot prefix","what is the prefix","bot name",
    "how to use bot","bot not working","bot is offline",
    "perfix","bot not talking","where is bot","bot dead","bots dead",
    "what prefix","what is bot","what prefix bot",
    "where are the bots","where prefix"
  ];

  if (triggerWords.includes(trimmedLower)) {
    const name = await getSenderName(api, senderID);
    return api.sendMessage(
      `${name} - Hey, I'm Here! 👋\n\n` +
      `➥ 🌐 Global Prefix: < ${globalPrefix} >\n` +
      `➥ 💬 This Chat Prefix: < ${threadPrefix} >\n\n` +
      `I'm < ${botName} > at your service 🫡\n` +
      `Try: ${threadPrefix}help`,
      threadID
    );
  }
};

module.exports.run = async ({ event, api }) => {
  const { threadID, senderID } = event;
  const threadSetting = global.data.threadData.get(String(threadID)) || {};
  const globalPrefix  = global.config.PREFIX  || "/";
  const threadPrefix  = threadSetting.PREFIX  || globalPrefix;
  const botName       = global.config.BOTNAME || "MOSTAKIM V2 BOT";

  const name = await getSenderName(api, senderID);
  return api.sendMessage(
    `Hey 👋 ${name} did you ask for my prefix?\n\n` +
    `➥ 🌐 Global Prefix: < ${globalPrefix} >\n` +
    `➥ 💬 This Chat Prefix: < ${threadPrefix} >\n\n` +
    `I'm < ${botName} > at your service 🫡\n` +
    `Try: ${threadPrefix}help`,
    threadID
  );
};
