"use strict";

const fs   = require("fs-extra");
const path = require("path");

module.exports.config = {
  name:            "file",
  version:         "2.0.0",
  hasPermssion:    2,
  credits:         "MOSTAKIM",
  description:     "List & delete command files (paginated)",
  commandCategory: "admin",
  usages:          "file | file <keyword> | file all",
  cooldowns:       0,
  usePrefix:       true
};

const CMD_DIR  = __dirname;
const PAGE_MAX = 30;

function buildPage(files, page) {
  const total  = files.length;
  const pages  = Math.ceil(total / PAGE_MAX);
  const start  = (page - 1) * PAGE_MAX;
  const slice  = files.slice(start, start + PAGE_MAX);

  let msg = `📁 𝗖𝗠𝗗 𝗙𝗜𝗟𝗘𝗦  [Page ${page}/${pages}]\n`;
  msg    += `📊 Total: ${total} items\n`;
  msg    += `━━━━━━━━━━━━━━━━━━\n`;

  for (let i = 0; i < slice.length; i++) {
    const f    = slice[i];
    const stat = fs.statSync(path.join(CMD_DIR, f));
    const icon = stat.isDirectory() ? "📁" : "📄";
    msg += `${start + i + 1}. ${icon} ${f}\n`;
  }

  msg += `━━━━━━━━━━━━━━━━━━\n`;
  if (pages > 1) {
    msg += `📄 Page ${page}/${pages} — reply "p2", "p3"... to navigate\n`;
  }
  msg += `🗑️ Reply number(s) to delete (space separated)`;
  return msg;
}

module.exports.handleReply = async function ({ api, event, handleReply }) {
  if (event.senderID !== handleReply.author) return;

  const { threadID, messageID } = event;
  const input = (event.body || "").trim().toLowerCase();

  // Page navigation
  const pageMatch = input.match(/^p(\d+)$/);
  if (pageMatch) {
    const page  = parseInt(pageMatch[1]);
    const pages = Math.ceil(handleReply.files.length / PAGE_MAX);
    if (page < 1 || page > pages) {
      return api.sendMessage(`❌ Page ${page} নেই। 1–${pages} এর মধ্যে দাও।`, threadID, messageID);
    }
    const msg = buildPage(handleReply.files, page);
    return api.sendMessage(msg, threadID, (err, info) => {
      if (!err && info) {
        global.client.handleReply.push({
          name:      module.exports.config.name,
          messageID: info.messageID,
          author:    event.senderID,
          files:     handleReply.files
        });
      }
    }, messageID);
  }

  // Delete by number(s)
  const nums = input
    .split(/\s+/)
    .map(n => parseInt(n))
    .filter(n => !isNaN(n) && n >= 1 && n <= handleReply.files.length);

  if (!nums.length) {
    return api.sendMessage("❌ সঠিক নম্বর দাও অথবা 'pN' দিয়ে page navigate করো।", threadID, messageID);
  }

  const deleted = [];
  const failed  = [];

  for (const num of nums) {
    const target     = handleReply.files[num - 1];
    const targetPath = path.join(CMD_DIR, target);
    try {
      if (!fs.existsSync(targetPath)) { failed.push(target); continue; }
      const stat = fs.statSync(targetPath);
      if (stat.isDirectory()) fs.rmSync(targetPath, { recursive: true, force: true });
      else                    fs.unlinkSync(targetPath);
      deleted.push(target);
    } catch (e) {
      failed.push(`${target} (${e.message})`);
    }
  }

  let msg = "";
  if (deleted.length) msg += `✅ Deleted:\n${deleted.map(f => `  • ${f}`).join("\n")}\n`;
  if (failed.length)  msg += `❌ Failed:\n${failed.map(f => `  • ${f}`).join("\n")}`;
  if (!msg) msg = "❌ Nothing deleted.";

  api.sendMessage(msg.trim(), threadID, messageID);
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;

  let files = fs.readdirSync(CMD_DIR);

  if (args[0] && args[0] !== "all") {
    const word = args.join(" ").toLowerCase();
    files = files.filter(f => f.toLowerCase().includes(word));
  }

  // Sort: folders first, then files alphabetically
  files.sort((a, b) => {
    const aDir = fs.statSync(path.join(CMD_DIR, a)).isDirectory();
    const bDir = fs.statSync(path.join(CMD_DIR, b)).isDirectory();
    if (aDir !== bDir) return aDir ? -1 : 1;
    return a.localeCompare(b);
  });

  if (!files.length) {
    return api.sendMessage("❌ No files found.", threadID, messageID);
  }

  const msg = buildPage(files, 1);

  api.sendMessage(msg, threadID, (err, info) => {
    if (!err && info) {
      global.client.handleReply.push({
        name:      module.exports.config.name,
        messageID: info.messageID,
        author:    event.senderID,
        files
      });
    }
  }, messageID);
};
