module.exports.config = {
  name:            "groupemoji",
  aliases:         ["gemoji", "setemoji2"],
  version:         "2.0.0",
  hasPermssion:    0,
  credits:         "MOSTAKIM",
  description:     "Group-এর emoji change করো",
  commandCategory: "group",
  usages:          "groupemoji [emoji]\nExample: groupemoji 🔥",
  cooldowns:       3,
};

// Detect actual emoji (unicode emoji ranges)
function containsEmoji(str) {
  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FEFF}\u{1F000}-\u{1F9FF}\u{E0020}-\u{E007F}]/u;
  return emojiRegex.test(str);
}

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;

  if (!args.length || !args.join("").trim()) {
    return api.sendMessage(
      "😊 Group Emoji Changer\n" +
      "━━━━━━━━━━━━━━━━━━━\n" +
      "📌 Usage: groupemoji [emoji]\n\n" +
      "💡 Example:\n" +
      "  /groupemoji 🔥\n" +
      "  /groupemoji 😍\n" +
      "  /groupemoji 🌊\n\n" +
      "⚠️ একটি emoji দিতে হবে।",
      threadID, messageID
    );
  }

  const input = args.join(" ").trim();

  // Must contain at least one emoji character
  if (!containsEmoji(input)) {
    return api.sendMessage(
      "❌ একটি valid emoji দাও!\n\n" +
      "💡 Example: /groupemoji 🔥\n" +
      "⚠️ শুধু text দিলে হবে না, emoji দিতে হবে।",
      threadID, messageID
    );
  }

  // Extract only the first emoji (or use full input if user wants custom)
  const emojiToSet = input;

  api.changeThreadEmoji(emojiToSet, threadID, (err) => {
    if (err) {
      return api.sendMessage(
        "❌ Emoji change করা যায়নি!\n" +
        "💡 Bot-কে group admin বানাও।",
        threadID, messageID
      );
    }
    api.sendMessage(
      `✅ Group emoji সেট হয়েছে: ${emojiToSet}\n⚡ MOSTAKIM V2 BOT`,
      threadID, messageID
    );
  });
};
