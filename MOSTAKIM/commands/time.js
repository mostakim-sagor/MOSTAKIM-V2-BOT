const moment = require('moment-timezone');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

module.exports.config = {
  name: 'time',
  version: '2.1.0',
  hasPermssion: 0,
  credits: 'MOSTAKIM',
  description: 'Stylish Auto Time & Date Sender',
  commandCategory: 'system',
  usages: '[]',
  cooldowns: 3
};

function getTimeMessage() {
  const now = moment().tz("Asia/Dhaka");
  const time = now.format("hh:mm A");
  const date = now.format("DD MMMM YYYY");
  const day  = now.format("dddd");

  return `✦••┈┈┈  𝗧𝗜𝗠𝗘  ┈┈┈••✦

✰ 𝗧𝗜𝗠𝗘 ➪ ${time}
✰ 𝗗𝗔𝗧𝗘 ➪ ${date}
✰ 𝗗𝗔𝗬 ➪ ${day}

✦••★ !  𝐌𝐎𝐒𝐓𝐀𝐊𝐈𝐌 𝐕𝟐 𝐁𝐎𝐓  ! ★••✦`;
}

function getRandomImagePath() {
  const folder = path.join(__dirname, "cache");
  const supported = [".png", ".jpg", ".jpeg", ".gif", ".mp4", ".webp"];
  try {
    if (!fs.existsSync(folder)) return null;
    const files = fs.readdirSync(folder).filter(f =>
      supported.includes(path.extname(f).toLowerCase())
    );
    if (!files.length) return null;
    return path.join(folder, files[Math.floor(Math.random() * files.length)]);
  } catch (_) {
    return null;
  }
}

// Send to a single thread — always sends body, attachment is optional
async function sendTimeMessage(api, threadID, msg, filePath) {
  const messageData = { body: msg };

  if (filePath) {
    try {
      messageData.attachment = fs.createReadStream(filePath);
    } catch (e) {
      console.log(chalk.yellow(`[TIME] Attachment failed, sending text only to ${threadID}: ${e.message}`));
    }
  }

  try {
    await api.sendMessage(messageData, threadID);
  } catch (e) {
    console.log(chalk.red(`[TIME] Failed to send to ${threadID}: ${e.message}`));
  }
}

module.exports.onLoad = async ({ api }) => {
  console.log(chalk.bold.green("====== STYLISH AUTO TIME SYSTEM LOADED ======"));

  let lastSentHour = -1;

  setInterval(async () => {
    const now = moment().tz("Asia/Dhaka");
    const currentHour = parseInt(now.format("HH"));
    const currentMin  = parseInt(now.format("mm"));

    if (currentMin <= 2 && currentHour !== lastSentHour) {
      lastSentHour = currentHour;

      if (!global.data || !global.data.allThreadID) return;

      const msg = getTimeMessage();
      const filePath = getRandomImagePath();

      for (const threadID of global.data.allThreadID) {
        await sendTimeMessage(api, threadID, msg, filePath);
      }
    }
  }, 30 * 1000);
};

module.exports.run = async ({ api, event }) => {
  const { threadID, messageID } = event;
  const msg = getTimeMessage();
  const filePath = getRandomImagePath();
  await sendTimeMessage(api, threadID, msg, filePath);
};
