const fs      = require("fs-extra");
const request = require("request");
const path    = require("path");

module.exports.config = {
  name:            "help2",
  version:         "2.0.0",
  hasPermssion:    0,
  credits:         "MOSTAKIM",
  description:     "Displays all commands grouped by category with icons",
  commandCategory: "system",
  usages:          "[No args]",
  cooldowns:       5
};

module.exports.run = async function ({ api, event }) {
  const { commands } = global.client;
  const { threadID, messageID } = event;

  const threadSetting =
    (global.data && global.data.threadData &&
     global.data.threadData.get(parseInt(threadID))) || {};
  const prefix = threadSetting.PREFIX || global.config.PREFIX || "/";

  // ── Category config (same as Help.js) ─────────────────────────────────
  const CAT_MAP = {
    "admin": "admin", "administration": "admin",
    "system": "system", "no prefix": "system", "noprefix": "system", "config": "system",
    "media": "media", "banner": "media", "image": "media", "img": "media",
    "video": "media", "music": "media", "stream": "media", "audio": "media",
    "picture": "media", "cover": "media", "caption": "media", "editing": "media",
    "edit-img": "media", "image editing tools": "media", "random video": "media",
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

  // ── Group commands by category ─────────────────────────────────────────
  const categories = {};
  for (const [name, cmd] of commands) {
    if (!name || !name.trim()) continue;
    const raw = ((cmd && cmd.config && cmd.config.commandCategory) || "utility")
                  .toString().toLowerCase().trim();
    const cat = CAT_MAP[raw] || raw;
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(name);
  }

  const totalCmds = Array.from(commands.keys()).filter(n => n && n.trim()).length;
  const botName   = global.config.BOTNAME   || "MOSTAKIM V2 BOT";
  const owner     = global.config.AUTHOR_NAME || global.config.ADMINNAME || "MD MOSTAKIM ISLAM SAGOR";

  // ── Build text ─────────────────────────────────────────────────────────
  let body = "";
  body += `╔══════════════════════════╗\n`;
  body += `   🌟 ${botName}\n`;
  body += `╚══════════════════════════╝\n`;
  body += `⚙️ PREFIX: [ ${prefix} ]  📦 CMDS: ${totalCmds}\n`;
  body += `👑 OWNER: ${owner}\n`;
  body += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  const sortedCats = Object.keys(categories).sort();
  for (const cat of sortedCats) {
    const icon = CAT_ICONS[cat] || "📌";
    const cmds = categories[cat].sort();
    body += `${icon} 〔 ${cat.toUpperCase()} 〕\n`;
    for (let i = 0; i < cmds.length; i += 3) {
      const row = cmds.slice(i, i + 3).map(c => `${prefix}${c}`).join("   ");
      body += `➠ ${row}\n`;
    }
    body += `\n`;
  }

  body += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  body += `➥ ${prefix}help [cmd] — command details`;

  // ── Background image ───────────────────────────────────────────────────
  const backgrounds = [
    "https://i.imgur.com/TNPPtjT.jpeg",
    "https://i.imgur.com/TNPPtjT.jpeg",
    "https://i.imgur.com/TNPPtjT.jpeg",
    "https://i.imgur.com/TNPPtjT.jpeg"
  ];
  const selectedBg = backgrounds[Math.floor(Math.random() * backgrounds.length)];

  const cacheDir = path.join(__dirname, "cache");
  fs.ensureDirSync(cacheDir);
  const imgPath = path.join(cacheDir, `help2_${Date.now()}.jpg`);

  request(selectedBg)
    .on("error", async () => {
      await api.sendMessage(body, threadID, messageID);
    })
    .pipe(fs.createWriteStream(imgPath))
    .on("close", () => {
      api.sendMessage(
        { body, attachment: fs.createReadStream(imgPath) },
        threadID,
        () => { try { fs.unlinkSync(imgPath); } catch (_) {} },
        messageID
      );
    });
};
