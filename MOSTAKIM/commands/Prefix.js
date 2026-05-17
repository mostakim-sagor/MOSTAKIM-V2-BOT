module.exports.config = {
  name: "prefix",
  version: "1.0.0", 
  hasPermssion: 0,
  credits: "MOSTAKIM",
  description: "Display the bot's prefix and owner info",
  commandCategory: "Information",
  usages: "",
  cooldowns: 5
};

module.exports.handleEvent = async ({ event, api, Threads }) => {
  var { threadID, messageID, body } = event;
  if (!body) return;

  var dataThread = await Threads.getData(threadID);
  var data = dataThread.data || {};
  const threadSetting = global.data.threadData.get(parseInt(threadID)) || {};
  const globalPrefix = global.config.PREFIX;
  const threadPrefix = threadSetting.PREFIX || global.config.PREFIX;
  const botName = global.config.BOTNAME || "MOSTAKIM V2 BOT";

  const triggerWords = [
    "prefix", "Prefix", "bot", "bot prefix", "what is the prefix", "bot name",
    "how to use bot", "bot not working", "bot is offline", "/", "Bot",
    "perfix", "bot not talking", "where is bot", "bot dead", "bots dead",
    ".", "!", "what prefix", "MOSTAKIM V2 BOT", "what is bot", "what prefix bot",
    "how use bot", "where are the bots", "where prefix"
  ];

  let lowerBody = body.toLowerCase();
  if (triggerWords.includes(lowerBody)) {
    const senderInfo = await api.getUserInfo(event.senderID);
    const userName = senderInfo?.[event.senderID]?.name || "Friend";

    return api.sendMessage(
`👋 Hey ${userName}, did you ask for my prefix?
➥ 🌐 Global: ${globalPrefix}
➥ 💬 This Chat: ${threadPrefix}
I'm ${botName} at your service 🫡`,
      threadID,
      null
    );
  }
};

module.exports.run = async ({ event, api, Threads }) => {
  const { threadID } = event;
  const threadSetting = global.data.threadData.get(parseInt(threadID)) || {};
  const globalPrefix = global.config.PREFIX;
  const threadPrefix = threadSetting.PREFIX || global.config.PREFIX;
  const botName = global.config.BOTNAME || "MOSTAKIM V2 BOT";
  return api.sendMessage(
`🤖 ${botName}
➥ 🌐 Global Prefix: ${globalPrefix}
➥ 💬 This Chat Prefix: ${threadPrefix}
Use ${threadPrefix}help to see all commands!`,
    threadID
  );
};