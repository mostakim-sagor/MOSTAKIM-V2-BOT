const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports.config = {
  name: "couple",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "SHAHADAT SAHU",
  description: "Generate a crush banner image using sender and target Facebook UID via Avatar Canvas API",
  commandCategory: "banner",
  usePrefix: true,
  usages: "[@mention | reply]",
  cooldowns: 5,
  dependencies: {
    "axios": "",
    "fs-extra": "",
    "path": ""
  }
};

const CRUSH2_CAPTIONS = [
`💛🌻
তোমার নামটা শুনলেই
মনটা কেমন জানি হালকা হয়ে যায় 🙂
এই অনুভূতিটাই হয়তো Crush 🫶`,

`🫶💛
চুপচাপ তাকিয়ে থাকি,
কারণ চোখের ভাষায়
সব বলা যায় না 🌼
Crush 💛`,

`🌻💛
ভালোবাসা না হয় পরে,
এই ভালো লাগাটুকু
এখনই খুব দামী 🫶`,

`💛🙂
তুমি জানো না,
কিন্তু তোমার একটা হাসিই
কারো পুরো দিন ভালো করে দেয় 🌸`,

`🫶🌼
তোমাকে পাওয়ার দাবি নেই,
শুধু মনে মনে
একটু ভালোবাসি 💛`,

`🌼💛
এই অনুভূতিটার কোনো নাম হয় না,
তবুও সবাই একে
Crush বলেই চেনে 🫶`,

`💛🌸
একটা মানুষ,
একটা অনুভূতি,
আর অজান্তেই
ভালো লেগে যাওয়া 🙂`
];

module.exports.run = async function ({ event, api }) {
  const { threadID, messageID, senderID, mentions, messageReply } = event;

  let targetID = null;

  if (mentions && Object.keys(mentions).length > 0) {
    targetID = Object.keys(mentions)[0];
  } else if (messageReply && messageReply.senderID) {
    targetID = messageReply.senderID;
  }

  if (!targetID) {
    return api.sendMessage(
      "Please reply or mention someone......",
      threadID,
      messageID
    );
  }

  try {
    const apiList = await axios.get(
      "https://raw.githubusercontent.com/shahadat-sahu/SAHU-API/refs/heads/main/SAHU-API.json"
    );

    const AVATAR_CANVAS_API = apiList.data.AvatarCanvas;

    const res = await axios.post(
      `${AVATAR_CANVAS_API}/api`,
      {
        cmd: "crush2",
        senderID,
        targetID
      },
      { responseType: "arraybuffer", timeout: 30000 }
    );

    const imgPath = path.join(
      __dirname,
      "cache",
      `crush2_${senderID}_${targetID}.png`
    );

    fs.writeFileSync(imgPath, res.data);

    const caption =
      CRUSH2_CAPTIONS[Math.floor(Math.random() * CRUSH2_CAPTIONS.length)];

    return api.sendMessage(
      {
        body: caption,
        attachment: fs.createReadStream(imgPath)
      },
      threadID,
      () => fs.unlinkSync(imgPath),
      messageID
    );

  } catch {
    return api.sendMessage(
      "API Error Call Boss SAHU",
      threadID,
      messageID
    );
  }
};
