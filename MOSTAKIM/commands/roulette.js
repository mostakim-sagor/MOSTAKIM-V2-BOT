module.exports = {
  config: {
    name: "roulette",
    aliases: ["rlt", "spin"],
    version: "1.0.0",
    hasPermssion: 0,
    credits: "MOSTAKIM",
    description: "Roulette game — bet on color or number range",
    commandCategory: "game",
    usages: "<amount> <red/black/green/odd/even/1-18/19-36>",
    cooldowns: 5,
    usePrefix: true
  },

  onStart: async function ({ api, event, args, Currencies }) {
    const { threadID, messageID, senderID } = event;

    // Roulette 0–36 color map (standard European roulette)
    const RED_NUMS   = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
    const BLACK_NUMS = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];

    const BETS = {
      red:    { label:"🔴 Red",    mult: 2 },
      black:  { label:"⚫ Black",  mult: 2 },
      green:  { label:"🟢 Green",  mult: 14 },
      odd:    { label:"🔢 Odd",    mult: 2 },
      even:   { label:"🔢 Even",   mult: 2 },
      "1-18": { label:"📊 1-18",   mult: 2 },
      "19-36":{ label:"📊 19-36",  mult: 2 },
    };

    const usage = () => api.sendMessage(
      [
        "🎡 ROULETTE — কিভাবে খেলবে:",
        "",
        "🔴 /roulette <amount> red    → 2x",
        "⚫ /roulette <amount> black  → 2x",
        "🟢 /roulette <amount> green  → 14x (0 তে জেতো)",
        "🔢 /roulette <amount> odd    → 2x",
        "🔢 /roulette <amount> even   → 2x",
        "📊 /roulette <amount> 1-18   → 2x",
        "📊 /roulette <amount> 19-36  → 2x",
        "",
        "📌 Example: /roulette 500 red"
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
    if (!BETS[choice])
      return usage();

    let balance = 0;
    try { balance = (await Currencies.getData(senderID))?.money || 0; } catch {}

    if (balance <= 0)
      return api.sendMessage("😅 তোমার একাউন্টে কোনো টাকা নেই!", threadID, messageID);
    if (bet > balance)
      return api.sendMessage(`❌ তোমার কাছে শুধু $${balance.toLocaleString()} আছে!`, threadID, messageID);

    // Spin the wheel 0–36
    const num   = Math.floor(Math.random() * 37);
    const color = num === 0 ? "green" : RED_NUMS.includes(num) ? "red" : "black";
    const colorEmoji = { red:"🔴", black:"⚫", green:"🟢" }[color];

    let won = false;
    switch (choice) {
      case "red":    won = (color === "red");                    break;
      case "black":  won = (color === "black");                  break;
      case "green":  won = (color === "green");                  break;
      case "odd":    won = (num !== 0 && num % 2 !== 0);        break;
      case "even":   won = (num !== 0 && num % 2 === 0);        break;
      case "1-18":   won = (num >= 1 && num <= 18);             break;
      case "19-36":  won = (num >= 19 && num <= 36);            break;
    }

    const { label, mult } = BETS[choice];
    const winnings = bet * mult;

    try {
      if (won) await Currencies.increaseMoney(senderID, winnings - bet);
      else     await Currencies.decreaseMoney(senderID, bet);
    } catch {}

    let newBal = 0;
    try { newBal = (await Currencies.getData(senderID))?.money || 0; } catch {}

    // Spinning animation string
    const spinNums = Array.from({ length: 7 }, () =>
      Math.floor(Math.random() * 37)
    ).join(" → ");

    const msg = [
      `🎡 ROULETTE SPIN 🎡`,
      "━".repeat(22),
      `🌀 ${spinNums} → ${colorEmoji}${num}`,
      "━".repeat(22),
      `🎯 তোমার bet  : ${label} — $${bet.toLocaleString()}`,
      `🎰 Result     : ${colorEmoji} ${num} (${color.toUpperCase()})`,
      "━".repeat(22),
      won
        ? `✅ জিতেছো! $${winnings.toLocaleString()} পেলে 🎉\n💰 New Balance : $${newBal.toLocaleString()}`
        : `❌ হেরেছো $${bet.toLocaleString()} 😢\n💰 New Balance : $${newBal.toLocaleString()}`
    ].join("\n");

    return api.sendMessage(msg, threadID, messageID);
  }
};
