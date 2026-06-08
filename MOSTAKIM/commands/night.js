const fs = require("fs");
const path = require("path");

module.exports.config = {
    name:            "night",
    version:         "1.0.1",
    hasPermssion:    0,
    credits:         "MOSTAKIM",
    description:     "Auto reply good night",
    commandCategory: "fun",
    usages:          "night",
    cooldowns:       5
};

module.exports.handleEvent = function ({ api, event }) {
    const { threadID, messageID, body } = event;
    if (!body) return;

    const lower = body.toLowerCase();
    if (
        lower.startsWith("good night") ||
        lower.startsWith("gud night")  ||
        lower.startsWith("gud nini")
    ) {
        const imgPath = path.join(__dirname, "cache", "night.jpg");
        const msg = { body: "Good night 🌉✨ Bye 💫🥀 Sweet dreams 😴" };
        if (fs.existsSync(imgPath)) msg.attachment = fs.createReadStream(imgPath);
        api.sendMessage(msg, threadID, messageID);
        api.setMessageReaction("😴", messageID, () => {}, true);
    }
};

module.exports.run = function ({ api, event }) {};
