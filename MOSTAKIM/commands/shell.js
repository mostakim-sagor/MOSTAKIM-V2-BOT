const { exec } = require('child_process');

module.exports.config = {
  name: 'shell',
  version: '1.0.0',
  hasPermssion: 4,
  credits: 'MOSTAKIM',
  description: 'Execute shell commands from Messenger (Developer only)',
  commandCategory: 'admin',
  usages: '/shell <command>',
  cooldowns: 3
};

module.exports.run = async ({ api, event, args }) => {
  const { threadID, messageID, senderID } = event;

  // Only devUsers / highest permission can use this
  const devUsers = (global.config.devUsers || global.config.ADMINBOT || []).map(String);
  if (!devUsers.includes(String(senderID))) {
    return api.sendMessage("❌ তুমি এই command ব্যবহার করার অনুমতি রাখো না!", threadID, messageID);
  }

  let command = args.join(" ").trim();
  if (!command) {
    return api.sendMessage(
      `🖥️ 𝗦𝗛𝗘𝗟𝗟 𝗖𝗢𝗠𝗠𝗔𝗡𝗗\n\n📌 Usage: /shell <command>\n\n🔹 Example:\n/shell ls\n/shell ls MOSTAKIM/commands\n/shell node -v\n/shell cat config.json\n/shell ps aux`,
      threadID, messageID
    );
  }

  // Special: "ls" alone → full project tree (exclude noisy folders)
  if (command === "ls") {
    command = `find . -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.cache/*" -not -path "*/.local/*" -not -path "*/.pythonlibs/*" -not -path "*/.agents/*" | sort`;
  }
  // Special: "ls <path>" → ls -la on that path
  else if (/^ls\s+/.test(command) && !/^ls\s+-/.test(command)) {
    const target = command.slice(3).trim();
    command = `ls -la "${target}" 2>&1 || find "${target}" | sort`;
  }

  // Block dangerous commands
  const BLOCKED = [
    /rm\s+-rf\s+\//,
    /mkfs/,
    /dd\s+if=/,
    />\s*\/dev\/(sda|hda|nvme)/,
    /shutdown/,
    /reboot/,
    /halt/,
  ];

  for (const pattern of BLOCKED) {
    if (pattern.test(command)) {
      return api.sendMessage(`⛔ Blocked: এই command টি নিষিদ্ধ!\n\`${command}\``, threadID, messageID);
    }
  }

  const startTime = Date.now();
  api.setMessageReaction("⏳", messageID, () => {}, true);

  exec(command, { timeout: 30000, cwd: process.cwd(), maxBuffer: 1024 * 512 }, (err, stdout, stderr) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    let output = "";
    if (stdout) output += stdout.trim();
    if (stderr) output += (output ? "\n\n[STDERR]\n" : "[STDERR]\n") + stderr.trim();
    if (!output) output = err ? err.message : "(কোনো output নেই)";

    // Trim if too long for Messenger
    const MAX = 2000;
    if (output.length > MAX) {
      output = output.slice(0, MAX) + `\n\n... (${output.length - MAX} characters truncated)`;
    }

    const result =
      `🖥️ 𝗦𝗛𝗘𝗟𝗟 𝗢𝗨𝗧𝗣𝗨𝗧\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `📌 $ ${command}\n` +
      `⏱️ ${elapsed}s | ${err ? "❌ Error" : "✅ Success"}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `${output}`;

    api.sendMessage(result, threadID, messageID);
    api.setMessageReaction(err ? "❌" : "✅", messageID, () => {}, true);
  });
};
