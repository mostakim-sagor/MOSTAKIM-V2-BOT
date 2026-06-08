module.exports.config = {
    name: "fork",
    version: "1.0.1",
    hasPermssion: 0,
    credits: "MOSTAKIM",  //please don't change credit
    description: "Send YouTube channel and GitHub fork link with intro text",
    commandCategory: "utility",
    usages: "fork",
    cooldowns: 0,
};

module.exports.run = async function({ api, event }) {
    const message = 
        "🔗 GitHub Fork Link: https://github.com 🙂🫶";

    return api.sendMessage(message, event.threadID, event.messageID);
};
