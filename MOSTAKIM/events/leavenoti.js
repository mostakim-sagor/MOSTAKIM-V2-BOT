module.exports.config = {
  name: "leave",
  eventType: ["log:unsubscribe"],
  version: "1.0.0",
  credits: "MOSTAKIM",  //please don't change credit
  description: "Thông báo bot hoặc người rời khỏi nhóm",
  dependencies: {
    "fs-extra": "",
    "path": ""
  }
};

module.exports.run = async function({ api, event, Users, Threads }) {
  if (event.logMessageData.leftParticipantFbId == api.getCurrentUserID()) return;

  const { createReadStream, existsSync, mkdirSync } = global.nodemodule["fs-extra"];
  const { join } = global.nodemodule["path"];
  const { threadID } = event;

  const data = global.data.threadData.get(parseInt(threadID)) || (await Threads.getData(threadID)).data;
  const uid = event.logMessageData.leftParticipantFbId;
  const name = global.data.userName.get(uid) || await Users.getNameUser(uid);

  const type = (event.author == uid)
    ? ` তোর সাহস কম না  গ্রুপের এডমিনের পারমিশন ছাড়া তুই লিভ  নিস!😠\n
✦─────𝐌𝐎𝐒𝐓𝐀𝐊𝐈𝐌 𝐕𝟐 𝐁𝐎𝐓────✦\n
››  ${name},\n›› fb.com/${uid}`
    : `তোমার এই গ্রুপে থাকার কোনো যোগ্যাতা নেই ছাগল😡\n
তাই তোমাকে লাথি মেরে গ্রুপ থেকে বের করে দেওয়া হলো🤪 \nWELLCOME REMOVE🤧\n
✦─────𝐌𝐎𝐒𝐓𝐀𝐊𝐈𝐌 𝐕𝟐 𝐁𝐎𝐓────✦\n
››  ${name},  \n›› fb.com/${uid}`;

  const path = join(__dirname, "mostakim", "leaveGif");
  const gifPath = join(path, "leave.gif");

  if (!existsSync(path)) mkdirSync(path, { recursive: true });

  let msg = (typeof data.customLeave == "undefined")
    ? "ইস {name} {type} "
    : data.customLeave;

  msg = msg.replace(/\{name}/g, name).replace(/\{type}/g, type);

  const formPush = existsSync(gifPath)
    ? { body: msg, attachment: createReadStream(gifPath) }
    : { body: msg };

  return api.sendMessage(formPush, threadID);
};