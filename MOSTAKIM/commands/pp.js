module.exports.config = {
 name: "pp",
 version: "1.0.0",
 hasPermssion: 0,
 credits: "MOSTAKIM",
 description: "Show profile picture",
 commandCategory: "utility",
 cooldowns: 0
};

module.exports.run = async function({ event, api, args, Users }) {
  const fs = global.nodemodule["fs-extra"];
  const request = global.nodemodule["request"];

  let uid;

  if (event.type == "message_reply") {
    uid = event.messageReply.senderID;
  } else if (args[0] && args[0].indexOf(".com/") !== -1) {
    try {
      uid = await api.getUID(args[0]);
    } catch (e) {
      return api.sendMessage("UID বের করতে সমস্যা হয়েছে!", event.threadID, event.messageID);
    }
  } else if (args[0] && Object.keys(event.mentions).length > 0) {
    uid = Object.keys(event.mentions)[0];
  } else {
    uid = event.senderID;
  }

  const avatarUrl = encodeURI(`https://graph.facebook.com/${uid}/picture?height=1500&width=1500&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`);
  const filePath = __dirname + "/cache/pp_temp.png";

  const callback = () => api.sendMessage(
    { body: `==profile==━`, attachment: fs.createReadStream(filePath) },
    event.threadID,
    () => { try { fs.unlinkSync(filePath); } catch (e) {} },
    event.messageID
  );

  request(avatarUrl).pipe(fs.createWriteStream(filePath)).on("close", () => callback());
};
