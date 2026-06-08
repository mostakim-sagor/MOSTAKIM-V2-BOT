const fs = require("fs-extra");
const axios = require("axios");

module.exports.config = {
  name: "resend",
  version: "1.2.0",
  hasPermssion: 0,
  credits: "MOSTAKIM",
  description: "Auto resend removed messages",
  commandCategory: "utility",
  cooldowns: 0,
  hide: true
};

module.exports.handleEvent = async function ({ event, api, Users }) {
  const { threadID, messageID, senderID, body, attachments, type } = event;

  if (!global.logMessage) global.logMessage = new Map();
  if (!global.data.botID) global.data.botID = api.getCurrentUserID();

  const data = global.data.threadData.get(threadID) || {};

  if (data.resend === true && senderID !== global.data.botID) {

    if (type !== "message_unsend") {
      global.logMessage.set(messageID, { msgBody: body, attachment: attachments });
    }

    if (type === "message_unsend") {
      const msg = global.logMessage.get(messageID);
      if (!msg) return;
      const userName = await Users.getNameUser(senderID);

      if (!msg.attachment || msg.attachment.length === 0) {
        return api.sendMessage(
          `সবাই দেখেন নাও\n${userName} রিমুভ করেছে:\n${msg.msgBody || ""}`,
          threadID
        );
      }

      let attachmentsList = [];
      let count = 0;

      for (const file of msg.attachment) {
        count++;
        const ext = file.url.split(".").pop();
        const filePath = __dirname + `/cache/resend_${count}.${ext}`;
        const fileData = (await axios.get(file.url, { responseType: "arraybuffer" })).data;
        fs.writeFileSync(filePath, Buffer.from(fileData));
        attachmentsList.push(fs.createReadStream(filePath));
      }

      return api.sendMessage(
        {
          body: `সবাই দেখেন নাও\n${userName} রিমুভ করেছে:\n${msg.msgBody || ""}`,
          attachment: attachmentsList
        },
        threadID
      );
    }
  }
};

module.exports.run = async function ({ api, event, args, Threads }) {
  const { threadID, messageID } = event;
  let data = (await Threads.getData(threadID)).data || {};

  const input = (args[0] || "").toLowerCase();

  if (input === "on") {
    data.resend = true;
  } else if (input === "off") {
    data.resend = false;
  } else {
    data.resend = !data.resend;
  }

  await Threads.setData(threadID, { data });
  global.data.threadData.set(threadID, data);

  return api.sendMessage(
    `✅ Resend mode: ${data.resend ? "ON 🟢" : "OFF 🔴"}`,
    threadID,
    messageID
  );
};
