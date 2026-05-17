const moment = require('moment-timezone');
const chalk = require('chalk');

module.exports.config = {
  name: 'time',
  version: '2.2.0',
  hasPermssion: 0,
  credits: 'MOSTAKIM',
  description: 'Stylish Auto Time & Date Sender',
  commandCategory: 'system',
  usages: '[]',
  cooldowns: 3
};

function getTimeMessage() {
  const now  = moment().tz("Asia/Dhaka");
  const time = now.format("hh:mm A");
  const date = now.format("DD MMMM YYYY");
  const day  = now.format("dddd");

  return `✦••┈┈┈  𝗧𝗜𝗠𝗘  ┈┈┈••✦

✰ 𝗧𝗜𝗠𝗘 ➪ ${time}
✰ 𝗗𝗔𝗧𝗘 ➪ ${date}
✰ 𝗗𝗔𝗬 ➪ ${day}

✦••★ !  𝐌𝐎𝐒𝐓𝐀𝐊𝐈𝐌 𝐕𝟐 𝐁𝐎𝐓  ! ★••✦`;
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

      for (const threadID of global.data.allThreadID) {
        try {
          await api.sendMessage(msg, threadID);
        } catch (e) {
          console.log(chalk.red(`[TIME] Failed to send to ${threadID}: ${e.message}`));
        }
      }
    }
  }, 30 * 1000);
};

module.exports.run = async ({ api, event }) => {
  const { threadID, messageID } = event;
  return api.sendMessage(getTimeMessage(), threadID, messageID);
};
