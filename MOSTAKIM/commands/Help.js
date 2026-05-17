module.exports.config = {
    name: "help",
    version: "3.0.0",
    hasPermssion: 0,
    credits: "MOSTAKIM ISLAM SAGOR",
    description: "Shows all commands",
    commandCategory: "system",
    usages: "[command name]",
    cooldowns: 5
};

module.exports.languages = {
    "en": {
        "moduleInfo":
`╭━━━━━━━━━━━━━━━━╮
┃ ✨ 𝐂𝐎𝐌𝐌𝐀𝐍𝐃 𝐈𝐍𝐅𝐎 ✨
┣━━━━━━━━━━━━━━━━┫
┃ 🔖 Name: %1
┃ 📄 Usage: %2
┃ 📜 Description: %3
┃ 🔑 Permission: %4
┃ 👨‍💻 Credit: %5
┃ 📂 Category: %6
┃ ⏳ Cooldown: %7s
┣━━━━━━━━━━━━━━━━┫
┃ ⚙ Prefix: %8
┃ 🤖 Bot Name: %9
┃ 👑 Owner: 𝐌𝐃 𝐌𝐎𝐒𝐓𝐀𝐊𝐈𝐌 𝐈𝐒𝐋𝐀𝐌 𝐒𝐀𝐆𝐎𝐑
╰━━━━━━━━━━━━━━━━╯`
    }
};

module.exports.handleEvent = function ({ api, event, getText }) {
    const { commands } = global.client;
    const { threadID, messageID, body } = event;

    if (!body || body.indexOf("help") !== 0) return;
    const parts = body.slice(body.indexOf("help")).trim().split(/\s+/);
    if (parts.length < 2 || !commands.has(parts[1].toLowerCase())) return;

    const threadSetting = (global.data && global.data.threadData && global.data.threadData.get(parseInt(threadID))) || {};
    const prefix  = threadSetting.PREFIX || global.config.PREFIX;
    const command = commands.get(parts[1].toLowerCase());

    const detail = getText("moduleInfo",
        command.config.name,
        command.config.usages        || "Not Provided",
        command.config.description   || "Not Provided",
        command.config.hasPermssion,
        command.config.credits       || "Unknown",
        command.config.commandCategory || "Unknown",
        command.config.cooldowns     || 0,
        prefix,
        global.config.BOTNAME        || "MOSTAKIM-V2-BOT"
    );

    return api.sendMessage(detail, threadID, messageID);
};

module.exports.run = function ({ api, event, args, getText }) {
    const { commands } = global.client;
    const { threadID, messageID } = event;

    const threadSetting = (global.data && global.data.threadData && global.data.threadData.get(parseInt(threadID))) || {};
    const prefix = threadSetting.PREFIX || global.config.PREFIX;

    // /help <commandName>  →  show single command info
    if (args[0] && commands.has(args[0].toLowerCase())) {
        const command = commands.get(args[0].toLowerCase());
        const detail = getText("moduleInfo",
            command.config.name,
            command.config.usages        || "Not Provided",
            command.config.description   || "Not Provided",
            command.config.hasPermssion,
            command.config.credits       || "Unknown",
            command.config.commandCategory || "Unknown",
            command.config.cooldowns     || 0,
            prefix,
            global.config.BOTNAME        || "MOSTAKIM-V2-BOT"
        );
        return api.sendMessage(detail, threadID, messageID);
    }

    // /help  →  show ALL commands at once (no pagination)
    const allCmds = Array.from(commands.keys())
        .filter(n => n && n.trim() !== "")
        .sort();

    const list = allCmds.map((n, i) => `┃ ${String(i + 1).padStart(3, " ")}. ✪ ${n}`).join("\n");

    const text =
`╭━━━━━━━━━━━━━━━━╮
┃ 📜 𝐂𝐎𝐌𝐌𝐀𝐍𝐃 𝐋𝐈𝐒𝐓 📜
┣━━━━━━━━━━━━━━━━┫
┃ 🧮 Total: ${allCmds.length} commands
┣━━━━━━━━━━━━━━━━┫
${list}
┣━━━━━━━━━━━━━━━━┫
┃ ⚙ Prefix: ${prefix}
┃ 🤖 Bot: ${global.config.BOTNAME || "𝐌𝐎𝐒𝐓𝐀𝐊𝐈𝐌 𝐕𝟐 𝐁𝐎𝐓"}
┃ 👑 Owner: 𝐌𝐃 𝐌𝐎𝐒𝐓𝐀𝐊𝐈𝐌 𝐈𝐒𝐋𝐀𝐌 𝐒𝐀𝐆𝐎𝐑
╰━━━━━━━━━━━━━━━━╯`;

    return api.sendMessage(text, threadID, messageID);
};
