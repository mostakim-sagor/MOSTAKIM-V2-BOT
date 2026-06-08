const axios = require("axios");

module.exports = {
  config: {
    name: "ai",
    version: "1.0.0",
    credits: "SHAHADAT SAHU",
    description: "Ask AI a question or reply to a message for an AI answer",
    commandCategory: "utility",
    usages: "ai [question]",
    cooldowns: 5,
    hasPermssion: 0,
    usePrefix: true
  },

  run: async ({ api, args, event }) => {
    const threadID = event.threadID;
    const messageID = event.messageID;
    const input = args.join(" ").trim();

    let SAHU;
    try {
      SAHU = (
        await axios.get(
          "https://raw.githubusercontent.com/shahadat-sahu/SAHU-API/refs/heads/main/SAHU-API.json"
        )
      ).data;
    } catch {
      return api.sendMessage(
        "❌ Failed to load AI configuration.",
        threadID,
        messageID
      );
    }

    const AI_API = SAHU.ai;

    const askAI = async (text) => {
      try {
        const res = await axios.get(AI_API + encodeURIComponent(text));
        return (
          res.data?.answer ||
          res.data?.response ||
          res.data?.reply ||
          "⚠️ No response from AI."
        );
      } catch {
        return "❌ AI request failed.";
      }
    };

    const reactDone = () =>
      api.setMessageReaction("✅", messageID, () => {}, true);

    if (
      event.type === "message_reply" &&
      event.messageReply.body &&
      !input
    ) {
      api.setMessageReaction("⏳", messageID, () => {}, true);
      const reply = await askAI(event.messageReply.body);
      await api.sendMessage(reply, threadID);
      return reactDone();
    }

    if (!input) {
      return api.sendMessage(
        "🤖 AI Usage Guide\n\n• Ask a question: /ai your question\n• Reply to any message and type /ai\n• Reply without a question to get an automatic answer",
        threadID,
        messageID
      );
    }

    api.setMessageReaction("⏳", messageID, () => {}, true);
    const reply = await askAI(input);
    await api.sendMessage(reply, threadID);
    return reactDone();
  }
};
