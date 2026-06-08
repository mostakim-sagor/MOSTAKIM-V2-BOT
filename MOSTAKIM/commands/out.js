module.exports.config = {
    name:            "out",
    version:         "2.0.0",
    hasPermssion:    3,
    credits:         "MOSTAKIM",
    description:     "Bot কে group থেকে বের করো (Bot Admin only)",
    commandCategory: "group",
    usages:          "out",
    cooldowns:       5,
};

module.exports.run = async function ({ api, event }) {
    const { threadID, messageID } = event;

    await api.sendMessage(
        "👋 Okay Bye!\n╰─❯ আবার দেখা হবে ইনশাআল্লাহ 💙",
        threadID,
        messageID
    );

    await new Promise(r => setTimeout(r, 1500));

    api.removeUserFromGroup(api.getCurrentUserID(), threadID, (err) => {
        if (err) api.sendMessage("❌ Group থেকে বের হতে পারলাম না। Bot কে Admin করো।", threadID, messageID);
    });
};
