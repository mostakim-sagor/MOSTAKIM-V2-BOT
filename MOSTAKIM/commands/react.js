module.exports.config = {
  name:            "react",
  aliases:         ["reactmode"],
  version:         "2.0.0",
  hasPermssion:    1,
  credits:         "MOSTAKIM",
  description:     "Group-এ কেউ react করলে bot সেই same emoji দিয়ে সেই message-এ react করবে। Default: OFF",
  commandCategory: "group",
  usages:          "[on/off/status]",
  cooldowns:       3,
};

module.exports.languages = {
  en: {
    turnedOn:   "✅ React Mirror turned ON.\nEখন থেকে কেউ কোনো message-এ react করলে bot-ও সেই same emoji দিয়ে react করবে।",
    turnedOff:  "🔕 React Mirror turned OFF.\nBot আর কারো reaction copy করবে না।",
    alreadyOn:  "ℹ️ React Mirror is already ON.",
    alreadyOff: "ℹ️ React Mirror is already OFF.",
    status:     "📊 React Mirror is currently: {status}\n\n▸ /react on  — enable\n▸ /react off — disable",
    invalidArg: "❌ Usage: /react on | /react off | /react (status)",
    adminOnly:  "❌ Only group admins can use this command.",
  }
};

module.exports.run = async function ({ api, event, args, Threads, getText }) {
  const { threadID, messageID, senderID } = event;

  const threadInfo   = await api.getThreadInfo(threadID).catch(() => null);
  const adminIDs     = (threadInfo && threadInfo.adminIDs)
    ? threadInfo.adminIDs.map(a => String(a.id)) : [];
  const globalAdmins = [
    ...(global.config.ADMINBOT   || []),
    ...(global.config.SUPERADMIN || []),
  ].map(String);

  const isAdmin = adminIDs.includes(String(senderID))
    || globalAdmins.includes(String(senderID));

  if (!isAdmin) return api.sendMessage(getText("adminOnly"), threadID, messageID);

  let data = (await Threads.getData(threadID)).data || {};
  const arg = (args[0] || "").toLowerCase();

  if (!arg) {
    const cur = data["react"] === true ? "ON ✅" : "OFF 🔕";
    return api.sendMessage(getText("status").replace("{status}", cur), threadID, messageID);
  }

  if (arg === "on") {
    if (data["react"] === true) return api.sendMessage(getText("alreadyOn"), threadID, messageID);
    data["react"] = true;
    await Threads.setData(threadID, { data });
    global.data.threadData.set(String(threadID), data);
    return api.sendMessage(getText("turnedOn"), threadID, messageID);
  }

  if (arg === "off") {
    if (data["react"] !== true) return api.sendMessage(getText("alreadyOff"), threadID, messageID);
    data["react"] = false;
    await Threads.setData(threadID, { data });
    global.data.threadData.set(String(threadID), data);
    return api.sendMessage(getText("turnedOff"), threadID, messageID);
  }

  return api.sendMessage(getText("invalidArg"), threadID, messageID);
};
