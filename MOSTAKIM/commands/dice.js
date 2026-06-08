module.exports = {
  config: {
    name: "dice",
    aliases: ["rolldice", "diceroll"],
    version: "1.0.0",
    hasPermssion: 0,
    credits: "MOSTAKIM",
    description: "Dice roll gambling game — bet on high, low or lucky 7",
    commandCategory: "game",
    usages: "<amount> <high/low/seven>",
    cooldowns: 5,
    usePrefix: true
  },

  onStart: async function ({ api, event, args, Currencies }) {
    const { threadID, messageID, senderID } = event;

    const DICE_FACES = ["⚀","⚁","⚂","⚃","⚄","⚅"];

    const usage = () => api.sendMessage(
      [
        "🎲 DICE GAME — কিভাবে খেলবে:",
        "",
        "/dice <amount> high   → দুই dice এর যোগফল > 7 (2x)",
        "/dice <amount> low    → দুই dice এর যোগফল < 7 (2x)",
        "/dice <amount> seven  → ঠিক 7 হলে 5x জেতো!",
        "",
        "📌 Example: /dice 500 high"
      ].join("\n"),
      threadID, messageID
    );

    if (args.length < 2) return usage();

    const bet    = parseInt(args[0]);
    const choice = args[1]?.toLowerCase();

    if (isNaN(bet) || bet <= 0)
      return api.sendMessage("❌ Valid amount দাও! (যেমন: 500)", threadID, messageID);
    if (bet < 100)
      return api.sendMessage("❌ Minimum bet হলো $100!", threadID, messageID);
    if (!["high","low","seven","7"].includes(choice))
      return usage();

    let balance = 0;
    try { balance = (await Currencies.getData(senderID))?.money || 0; } catch {}

    if (balance <= 0)
      return api.sendMessage("😅 তোমার একাউন্টে কোনো টাকা নেই!", threadID, messageID);
    if (bet > balance)
      return api.sendMessage(`❌ তোমার কাছে শুধু $${balance.toLocaleString()} আছে!`, threadID, messageID);

    const d1    = Math.floor(Math.random() * 6) + 1;
    const d2    = Math.floor(Math.random() * 6) + 1;
    const total = d1 + d2;

    const normalChoice = (choice === "7") ? "seven" : choice;

    let won = false, multiplier = 0;
    if (normalChoice === "high"  && total > 7)  { won = true; multiplier = 2; }
    if (normalChoice === "low"   && total < 7)  { won = true; multiplier = 2; }
    if (normalChoice === "seven" && total === 7) { won = true; multiplier = 5; }

    const winnings = bet * multiplier;

    try {
      if (won) await Currencies.increaseMoney(senderID, winnings - bet);
      else     await Currencies.decreaseMoney(senderID, bet);
    } catch {}

    let newBal = 0;
    try { newBal = (await Currencies.getData(senderID))?.money || 0; } catch {}

    const choiceLabel = { high: "HIGH (>7)", low: "LOW (<7)", seven: "SEVEN (=7)" }[normalChoice];

    const msg = [
      `🎲 DICE ROLL RESULT 🎲`,
      "━".repeat(22),
      `🎯 তোমার bet     : ${choiceLabel} — $${bet.toLocaleString()}`,
      `🎲 Dice result   : ${DICE_FACES[d1-1]} + ${DICE_FACES[d2-1]} = ${total}`,
      "━".repeat(22),
      won
        ? `✅ জিতেছো! $${winnings.toLocaleString()} পেলে 🎉\n💰 New Balance : $${newBal.toLocaleString()}`
        : `❌ হেরেছো $${bet.toLocaleString()} 😢\n💰 New Balance : $${newBal.toLocaleString()}`
    ].join("\n");

    return api.sendMessage(msg, threadID, messageID);
  }
};
