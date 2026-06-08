module.exports = {
  config: {
    name: "coinflip",
    aliases: ["cf", "flip"],
    version: "1.0.0",
    hasPermssion: 0,
    credits: "MOSTAKIM",
    description: "Coin flip gambling game",
    commandCategory: "game",
    usages: "<amount> <heads/tails>",
    cooldowns: 5,
    usePrefix: true
  },

  onStart: async function ({ api, event, args, Currencies }) {
    const { threadID, messageID, senderID } = event;

    const usage = () => api.sendMessage(
      "❓ Usage: /coinflip <amount> <heads/tails>\n\n📌 Example:\n/coinflip 500 heads\n/coinflip 1000 tails",
      threadID, messageID
    );

    if (args.length < 2) return usage();

    const bet   = parseInt(args[0]);
    const guess = args[1]?.toLowerCase();

    if (isNaN(bet) || bet <= 0)
      return api.sendMessage("❌ Valid amount দাও! (যেমন: 500)", threadID, messageID);
    if (bet < 100)
      return api.sendMessage("❌ Minimum bet হলো $100!", threadID, messageID);
    if (!["heads", "tails", "h", "t"].includes(guess))
      return usage();

    const normalGuess = (guess === "h" || guess === "heads") ? "heads" : "tails";

    let balance = 0;
    try { balance = (await Currencies.getData(senderID))?.money || 0; } catch {}

    if (balance <= 0)
      return api.sendMessage("😅 তোমার একাউন্টে কোনো টাকা নেই!\n\n💡 /daily দিয়ে টাকা নাও।", threadID, messageID);
    if (bet > balance)
      return api.sendMessage(`❌ তোমার কাছে শুধু $${balance.toLocaleString()} আছে!`, threadID, messageID);

    const result  = Math.random() < 0.5 ? "heads" : "tails";
    const coinAni = result === "heads" ? "🪙" : "💿";
    const won     = result === normalGuess;
    const prize   = won ? bet : 0;

    try {
      if (won) await Currencies.increaseMoney(senderID, bet);
      else     await Currencies.decreaseMoney(senderID, bet);
    } catch {}

    let newBal = 0;
    try { newBal = (await Currencies.getData(senderID))?.money || 0; } catch {}

    const guessEmoji = normalGuess === "heads" ? "🪙 Heads" : "💿 Tails";
    const resultEmoji = result === "heads"     ? "🪙 Heads" : "💿 Tails";

    const msg = won
      ? `${coinAni} COIN FLIP ${coinAni}\n${"━".repeat(22)}\n🎯 তোমার guess : ${guessEmoji}\n🎲 Result       : ${resultEmoji}\n${"━".repeat(22)}\n✅ তুমি জিতেছো $${bet.toLocaleString()}! 🎉\n💰 New Balance : $${newBal.toLocaleString()}`
      : `${coinAni} COIN FLIP ${coinAni}\n${"━".repeat(22)}\n🎯 তোমার guess : ${guessEmoji}\n🎲 Result       : ${resultEmoji}\n${"━".repeat(22)}\n❌ তুমি হেরেছো $${bet.toLocaleString()} 😢\n💰 New Balance : $${newBal.toLocaleString()}`;

    return api.sendMessage(msg, threadID, messageID);
  }
};
