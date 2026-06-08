const moment = require('moment-timezone');
const chalk = require('chalk');

module.exports.config = {
  name: 'time',
  version: '3.1.0',
  hasPermssion: 0,
  credits: 'MOSTAKIM',
  description: 'Auto Time & Date Sender — can be turned on/off by admin',
  commandCategory: 'system',
  usages: '[on | off | status]',
  cooldowns: 3
};

function getTimeMessage() {
  const now      = moment().tz("Asia/Dhaka");
  const time     = now.format("hh:mm A");
  const date     = now.format("DD MMMM YYYY");
  const day      = now.format("dddd");
  const botName  = (global.config && global.config.BOTNAME) || "MOSTAKIM V2 BOT";

  return `✦••┈┈┈  𝗧𝗜𝗠𝗘  ┈┈┈••✦

✰ 𝗧𝗜𝗠𝗘 ➪ ${time}
✰ 𝗗𝗔𝗧𝗘 ➪ ${date}
✰ 𝗗𝗔𝗬 ➪  ${day}

✦••★ !  ${botName}  ! ★••✦`;
}

module.exports.onLoad = async ({ api }) => {
  console.log(chalk.bold.green("====== STYLISH AUTO TIME SYSTEM LOADED ======"));

  if (global.data.timeAutoSend === undefined) {
    global.data.timeAutoSend = true;
  }

  let lastSentHour = -1;

  setInterval(async () => {
    if (!global.data.timeAutoSend) return;

    const now         = moment().tz("Asia/Dhaka");
    const currentHour = parseInt(now.format("HH"));
    const currentMin  = parseInt(now.format("mm"));

    if (currentMin <= 2 && currentHour !== lastSentHour) {
      lastSentHour = currentHour;
      if (!global.data || !global.data.allThreadID) return;
      const msg = getTimeMessage();
      for (const threadID of global.data.allThreadID) {
        try { await api.sendMessage(msg, threadID); }
        catch (e) { console.log(chalk.red(`[TIME] Failed: ${threadID} — ${e.message}`)); }
      }
    }
  }, 30 * 1000);
};

module.exports.run = async ({ api, event, args }) => {
  const { threadID, messageID, senderID } = event;
  const out = (msg) => api.sendMessage(msg, threadID, messageID);

  const sub = (args[0] || "").toLowerCase();

  if (sub === "on" || sub === "off") {
    const isAdmin =
      (global.config.ADMINBOT   || []).includes(String(senderID)) ||
      (global.config.SUPERADMIN || []).includes(String(senderID)) ||
      (global.config.DEV        || []).includes(String(senderID));

    if (!isAdmin) return out("❌ Only admins can change the auto time sender setting.");

    global.data.timeAutoSend = (sub === "on");

    if (sub === "on") {
      return out(
        `[ AUTO TIME SENDER: ON ]\n` +
        `─────────────────────\n` +
        `The bot will now send a time message\n` +
        `to all groups every hour.\n\n` +
        `To disable: /time off`
      );
    } else {
      return out(
        `[ AUTO TIME SENDER: OFF ]\n` +
        `─────────────────────\n` +
        `Auto time messages are now disabled.\n` +
        `You can still use /time to check the time.\n\n` +
        `To enable: /time on`
      );
    }
  }

  if (sub === "status") {
    const isOn = global.data.timeAutoSend !== false;
    return out(
      `[ AUTO TIME STATUS ]\n` +
      `─────────────────────\n` +
      `Auto Sender: ${isOn ? 'ON' : 'OFF'}\n\n` +
      `/time on  — enable auto sender\n` +
      `/time off — disable auto sender`
    );
  }

  return out(getTimeMessage());
};
