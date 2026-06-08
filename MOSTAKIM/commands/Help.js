module.exports.config = {
  name: "help",
  version: "5.0.0",
  hasPermssion: 0,
  credits: "MOSTAKIM ISLAM SAGOR",
  description: "Show all commands or get info on a specific command",
  commandCategory: "system",
  usages: "[command name]",
  cooldowns: 5
};

module.exports.languages = {
  "en": {
    "moduleInfo":
`╔════════════════════╗
COMMAND INFO
╚════════════════════╝

✧ Name      ➤ %1
✧ Usage     ➤ %2
✧ Desc      ➤ %3
✧ Perm      ➤ %4
✧ Credit    ➤ %5
✧ Category  ➤ %6
✧ Cooldown  ➤ %7s

━━━━━━━━━━━━━━━━━━
✧ Prefix ➤ %8
✧ Bot    ➤ %9
━━━━━━━━━━━━━━━━━━`
  }
};

module.exports.handleEvent = function ({ api, event, getText }) {
  const { commands } = global.client;
  const { threadID, messageID, body } = event;

  if (!body || body.indexOf("help") !== 0) return;
  const parts = body.slice(body.indexOf("help")).trim().split(/\s+/);

  if (parts.length < 2 || !commands.has(parts[1].toLowerCase())) return;

  const threadSetting =
    (global.data &&
    global.data.threadData &&
    global.data.threadData.get(parseInt(threadID))) || {};

  const prefix = threadSetting.PREFIX || global.config.PREFIX;
  const command = commands.get(parts[1].toLowerCase());

  return api.sendMessage(getText(
    "moduleInfo",
    command.config.name,
    command.config.usages || "N/A",
    command.config.description || "N/A",
    command.config.hasPermssion,
    command.config.credits || "Unknown",
    command.config.commandCategory || "Unknown",
    command.config.cooldowns || 0,
    prefix,
    global.config.BOTNAME || "MOSTAKIM-V2-BOT"
  ), threadID, messageID);
};

module.exports.run = function ({ api, event, args, getText }) {
  const { commands } = global.client;
  const { threadID, messageID } = event;

  const threadSetting =
    (global.data &&
    global.data.threadData &&
    global.data.threadData.get(parseInt(threadID))) || {};

  const prefix = threadSetting.PREFIX || global.config.PREFIX;

  if (args[0] && commands.has(args[0].toLowerCase())) {
    const command = commands.get(args[0].toLowerCase());

    return api.sendMessage(getText(
      "moduleInfo",
      command.config.name,
      command.config.usages || "N/A",
      command.config.description || "N/A",
      command.config.hasPermssion,
      command.config.credits || "Unknown",
      command.config.commandCategory || "Unknown",
      command.config.cooldowns || 0,
      prefix,
      global.config.BOTNAME || "MOSTAKIM-V2-BOT"
    ), threadID, messageID);
  }

  const allCmds = Array.from(commands.keys())
    .filter(n => n && n.trim() !== "")
    .sort();

  const categories = {};

  // Known category aliases → normalized name
  const CAT_MAP = {
    "admin": "admin", "administration": "admin",
    "system": "system", "no prefix": "system", "noprefix": "system", "config": "system",
    "media": "media", "banner": "media", "image": "media", "img": "media",
    "video": "media", "music": "media", "stream": "media", "audio": "media",
    "picture": "media", "cover": "media", "caption": "media", "editing": "media",
    "edit-img": "media", "image editing tools": "media", "random video": "media",
    "𝗜𝗠𝗔𝗚𝗘 𝗚𝗘𝗡𝗘𝗥𝗔𝗧𝗢𝗥": "media",
    "group": "group",
    "info": "info", "information": "info", "user": "info", "for users": "info",
    "generate fb id link": "info", "facebook post": "info",
    "utility": "utility", "utilities": "utility", "general": "utility",
    "other": "utility", "others": "utility", "công cụ": "utility",
    "sandnoto": "utility", "spam": "utility", "tools": "utility",
    "game": "game",
    "fun": "fun", "random-img": "fun", "birthday": "fun", "bday": "fun",
    "chat": "chat", "box": "chat", "box chat": "chat",
    "economy": "economy", "store": "economy",
    "nsfw": "nsfw",
    "m h bd": "media",
    "unknown": "utility",
  };

  for (const name of allCmds) {
    const cmd = commands.get(name);
    const raw = ((cmd && cmd.config && cmd.config.commandCategory) || "utility")
                  .toString().toLowerCase().trim();
    const cat = CAT_MAP[raw] || raw;
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(name);
  }

  const HIGHLIGHT = "calladmin";

  // Fixed: renamed from 'body' to 'msgBody' to avoid conflict with event.body
  let msgBody = "";

  msgBody += `╔════════════════════════════╗\n`;
  msgBody += `        ${global.config.BOTNAME || "MOSTAKIM V2 BOT"}\n`;
  msgBody += `╚════════════════════════════╝\n\n`;

  msgBody += `✧ PREFIX ➤ [ ${prefix} ]\n`;
  msgBody += `✧ TOTAL COMMANDS ➤ ${allCmds.length}\n`;
  msgBody += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  const CAT_ICONS = {
    admin:   "🛡️",
    system:  "⚙️",
    media:   "🎬",
    group:   "👥",
    info:    "ℹ️",
    utility: "🔧",
    game:    "🎮",
    fun:     "🎉",
    chat:    "💬",
    economy: "💰",
    nsfw:    "🔞",
  };

  const sortedCats = Object.keys(categories).sort();

  for (const cat of sortedCats) {
    const icon = CAT_ICONS[cat] || "📌";
    msgBody += `${icon} 〔 ${cat.toUpperCase()} 〕\n`;

    const cmds = categories[cat];
    for (let i = 0; i < cmds.length; i += 3) {
      const row = cmds
        .slice(i, i + 3)
        .map(c => `${prefix}${c}`)
        .join("   ");
      msgBody += `➠ ${row}\n`;
    }

    msgBody += `\n`;
  }

  msgBody += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msgBody += `❖ NEED ADMIN SUPPORT?\n`;
  msgBody += `➥ ${prefix}${HIGHLIGHT} — Message admin directly anytime\n\n`;

  msgBody += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msgBody += `➥ ${prefix}help [cmd] — get command details`;

  return api.sendMessage(msgBody, threadID, messageID);
};