module.exports.config = {
  name:        "react",
  eventType:   ["message_reaction"],
  version:     "2.0.0",
  credits:     "MOSTAKIM",
  description: "Group-এ কেউ react করলে bot সেই same reaction টা সেই message-এ দেবে। Admin /react on|off দিয়ে control করতে পারবে। Default: OFF",
};

module.exports.run = async function ({ api, event }) {
  try {
    const { threadID, senderID, reaction, messageID } = event;

    const botID = String(api.getCurrentUserID());
    if (String(senderID) === botID) return;

    const thread = global.data.threadData.get(String(threadID)) || {};
    if (thread["react"] !== true) return;

    if (reaction) {
      api.setMessageReaction(reaction, messageID, () => {}, true);
    }
  } catch (e) {
    console.error("[react event error]", e.message || e);
  }
};
