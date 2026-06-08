module.exports.config = {
  name: "leave",
  eventType: ["log:unsubscribe"],
  version: "2.0.1",
  credits: "MOSTAKIM",
  description: "Notify when someone leaves the group",
  dependencies: {
    "fs-extra": "",
    "path": ""
  }
};

module.exports.run = async function({ api, event, Users, Threads }) {
  if (event.logMessageData.leftParticipantFbId == api.getCurrentUserID()) return;

  const { createReadStream, existsSync } = global.nodemodule["fs-extra"];
  const { join } = global.nodemodule["path"];
  const { threadID } = event;

  // ── Auto bot name from config ──
  const botName = global.config.BOTNAME || global.config.botName || "MOSTAKIM V2 BOT";

  const data = global.data.threadData.get(parseInt(threadID)) || (await Threads.getData(threadID)).data;
  const uid  = event.logMessageData.leftParticipantFbId;
  const name = global.data.userName.get(uid) || await Users.getNameUser(uid);

  const selfLeft = (event.author == uid);
  const typeLabel = selfLeft
    ? `╭─❍「 𝐌𝐄𝐌𝐁𝐄𝐑 𝐋𝐄𝐅𝐓 」\n│\n├ ✦ ${name} left the group!\n│\n╰───────────────⭓`
    : `╭─❍「 𝐌𝐄𝐌𝐁𝐄𝐑 𝐑𝐄𝐌𝐎𝐕𝐄𝐃 」\n│\n├ ✦ ${name} was kicked from the group.\n│\n╰───────────────⭓`;

  const gifDir  = join(__dirname, "mostakim", "leaveGif");
  const gifFile = join(gifDir, "leave.gif");
  const hasGif  = existsSync(gifFile);

  let msg = (typeof data.customLeave === "undefined")
    ? `${typeLabel}\n\n━━━━━━━━━━━━━━━━━━━━━━━\n✦─── ${botName} ───✦\n━━━━━━━━━━━━━━━━━━━━━━━`
    : data.customLeave.replace(/\{name}/g, name).replace(/\{type}/g, typeLabel);

  if (hasGif) {
    api.sendMessage({ body: "", attachment: createReadStream(gifFile) }, threadID);
  }

  return api.shareContact(msg, uid, threadID, (err) => {
    if (err) return console.log(err);
  });
};
