"use strict";

module.exports.config = {
    name:            "logs",
    version:         "1.0.0",
    hasPermssion:    3,
    credits:         "MOSTAKIM",
    description:     "Show recent bot console logs (admin only)",
    commandCategory: "admin",
    usages:          "logs [number]",
    cooldowns:       3,
    handleEventOnCommand: false
};

module.exports.run = async function ({ api, event, args }) {
    const { threadID, messageID } = event;

    const buffer = global._logBuffer || [];
    if (buffer.length === 0)
        return api.sendMessage("📋 No logs captured yet.", threadID, messageID);

    // How many lines to show — default 30, max 80
    let count = parseInt(args[0]) || 30;
    if (count > 80)  count = 80;
    if (count < 1)   count = 1;

    const lines  = buffer.slice(-count);
    const header = `📋 Console Logs (last ${lines.length} lines)\n` +
                   `🤖 ${global.config.BOTNAME || "MOSTAKIM V2 BOT"}\n` +
                   `━━━━━━━━━━━━━━━━━━━━━━\n`;
    const body   = lines.join("\n");

    const MAX = 4000;
    const full = header + body;

    if (full.length <= MAX)
        return api.sendMessage(full, threadID, messageID);

    // Split into chunks if too long
    const chunks = [];
    let cur = header;
    for (const line of lines) {
        if ((cur + line + "\n").length > MAX) {
            chunks.push(cur);
            cur = "";
        }
        cur += line + "\n";
    }
    if (cur.trim()) chunks.push(cur);

    for (const chunk of chunks)
        await api.sendMessage(chunk, threadID, messageID);
};
