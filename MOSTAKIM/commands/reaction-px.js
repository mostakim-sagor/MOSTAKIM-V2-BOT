module.exports.config = {
    name:            "reaction-px",
    version:         "1.0.1",
    hasPermssion:    0,
    credits:         "MOSTAKIM",
    description:     "Auto react 🌺 when a message starts with /",
    commandCategory: "system",
    usages:          "",
    cooldowns:       0
};

module.exports.handleEvent = function ({ api, event }) {
    const { body, messageID } = event;
    if (!body) return;
    if (body.startsWith("/")) {
        api.setMessageReaction("🌺", messageID, () => {}, true);
    }
};

module.exports.run = function () {};
