"use strict";

const { exec } = require("child_process");
const fs       = require("fs-extra");
const path     = require("path");
const os       = require("os");

module.exports.config = {
  name:            "shell",
  version:         "4.1.0",
  hasPermssion:    3,
  credits:         "MOSTAKIM",
  description:     "System shell — file explorer + 20+ system commands",
  commandCategory: "system",
  usages:          "shell <command> | shell help | sh (file explorer only)",
  aliases:         ["sh"],
  cooldowns:       2
};

const ROOT = process.cwd();

const IGNORE = new Set([
  "node_modules", ".git", ".cache", ".local", ".pythonlibs",
  ".agents", ".npm", ".config", "__pycache__"
]);

// ── Permission check ───────────────────────────────────────────────────────────
function isDev(senderID) {
  const ids = [
    ...(global.config?.DEV        || []),
    ...(global.config?.SUPERADMIN || []),
    ...(global.config?.ADMINBOT   || [])
  ].map(String);
  return ids.includes(String(senderID));
}

// ── File explorer helpers ──────────────────────────────────────────────────────
function readDir(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const folders = [], files = [];
    for (const e of entries) {
      if (IGNORE.has(e.name)) continue;
      if (e.isDirectory()) folders.push({ name: e.name, type: "dir" });
      else                  files.push({ name: e.name, type: "file" });
    }
    folders.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b)   => a.name.localeCompare(b.name));
    return [...folders, ...files];
  } catch { return []; }
}

function buildListing(items, currentPath) {
  const rel = path.relative(ROOT, currentPath) || ".";
  let msg = `📂 𝗣𝗥𝗢𝗝𝗘𝗖𝗧 𝗘𝗫𝗣𝗟𝗢𝗥𝗘𝗥\n`;
  msg    += `📍 Path: ${rel}\n`;
  msg    += `━━━━━━━━━━━━━━━━━━\n`;
  if (items.length === 0) {
    msg += "(empty directory)";
  } else {
    for (let i = 0; i < items.length; i++) {
      const icon = items[i].type === "dir" ? "📁" : "📄";
      msg += `${i + 1}. ${icon} ${items[i].name}\n`;
    }
  }
  msg += `━━━━━━━━━━━━━━━━━━\n`;
  msg += `💬 Number reply → open file/folder\n`;
  if (rel !== ".") msg += `⬆️ ".." reply → parent folder`;
  return msg;
}

function safeReadFile(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > 60 * 1024) {
      return `⚠️ File too large (${(stat.size / 1024).toFixed(1)} KB).\nUse: shell exec cat "${path.relative(ROOT, filePath)}"`;
    }
    const content = fs.readFileSync(filePath, "utf8");
    const MAX = 3000;
    return content.length > MAX
      ? content.slice(0, MAX) + `\n\n... (${content.length - MAX} chars truncated)`
      : content;
  } catch (e) { return `❌ Cannot read: ${e.message}`; }
}

// ── Shell executor ─────────────────────────────────────────────────────────────
const BLOCKED = [
  /rm\s+-rf\s+\//,
  /mkfs/, /dd\s+if=/, /shutdown/, /reboot/, /halt/,
  />\s*\/dev\/(sda|hda|nvme)/
];

function runShell(command, api, threadID, messageID, label) {
  for (const p of BLOCKED) {
    if (p.test(command)) {
      return api.sendMessage(`⛔ Blocked command: \`${command}\``, threadID, messageID);
    }
  }
  const start = Date.now();
  api.setMessageReaction("⏳", messageID, () => {}, true);
  exec(command, { timeout: 30000, cwd: ROOT, maxBuffer: 1024 * 512 }, (err, stdout, stderr) => {
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    let output = "";
    if (stdout) output += stdout.trim();
    if (stderr) output += (output ? "\n[STDERR]\n" : "[STDERR]\n") + stderr.trim();
    if (!output) output = err ? err.message : "(no output)";
    const MAX = 3500;
    if (output.length > MAX) output = output.slice(0, MAX) + `\n... (+${output.length - MAX} chars)`;
    api.sendMessage(
      `🖥️ ${label || "SHELL OUTPUT"}\n━━━━━━━━━━━━━━━━━━\n$ ${command}\n⏱ ${elapsed}s | ${err ? "❌ Error" : "✅ OK"}\n━━━━━━━━━━━━━━━━━━\n${output}`,
      threadID, messageID
    );
    api.setMessageReaction(err ? "❌" : "✅", messageID, () => {}, true);
  });
}

// ── Help / command list ────────────────────────────────────────────────────────
const HELP_TEXT =
`🖥️ 𝗦𝗛𝗘𝗟𝗟 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦
━━━━━━━━━━━━━━━━━━━━━━

📁 𝗙𝗜𝗟𝗘 𝗘𝗫𝗣𝗟𝗢𝗥𝗘𝗥
  shell              → Root folder browser
  shell commands     → Browse commands folder
  shell events       → Browse events folder
  shell <path>       → Browse any folder/file
  shell cat <file>   → Read file content

💻 𝗦𝗬𝗦𝗧𝗘𝗠 𝗜𝗡𝗙𝗢
  shell whoami       → Current user info
  shell uptime       → System uptime
  shell mem          → RAM & CPU info
  shell cpu          → Detailed CPU stats
  shell disk         → Disk usage (df -h)
  shell os           → OS & platform info
  shell pid          → Node.js process info

🌐 𝗡𝗘𝗧𝗪𝗢𝗥𝗞
  shell ip           → Public IP address
  shell netstat      → Open network ports
  shell ping <host>  → Ping a host

📦 𝗣𝗔𝗖𝗞𝗔𝗚𝗘𝗦
  shell node         → Node & npm version
  shell pkg          → package.json content
  shell modules      → Installed npm packages

🔄 𝗣𝗥𝗢𝗖𝗘𝗦𝗦
  shell ps           → Running processes
  shell kill <pid>   → Kill a process (careful!)
  shell log          → Recent bot log lines
  shell env          → Environment variables

⚡ 𝗘𝗫𝗘𝗖𝗨𝗧𝗘
  shell exec <cmd>   → Run any shell command
  shell run  <cmd>   → Alias for exec

━━━━━━━━━━━━━━━━━━━━━━
⚡ MOSTAKIM V2 BOT`;

// ── Main run ───────────────────────────────────────────────────────────────────
module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  const out = (msg) => api.sendMessage(msg, threadID, messageID);

  if (!isDev(senderID)) return out("❌ শুধুমাত্র Developer ব্যবহার করতে পারবে!");

  const sub = (args[0] || "").toLowerCase();

  // Detect if called via "sh" alias (body starts with prefix + "sh")
  const prefix    = global.config?.PREFIX || "/";
  const rawBody   = (event.body || "").trim();
  const calledAsSh = new RegExp(`^[${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}]sh(\\s|$)`, "i").test(rawBody)
                     || rawBody.toLowerCase() === "sh";

  // ── info ─────────────────────────────────────────────────────────────────────
  if (sub === "info") {
    return out(
      `📂 𝗦𝗛𝗘𝗟𝗟 𝗙𝗜𝗟𝗘 𝗘𝗫𝗣𝗟𝗢𝗥𝗘𝗥\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📌 Command: shell (alias: sh)\n` +
      `📌 Permission: DEV / SUPERADMIN / ADMINBOT\n\n` +
      `🔍 𝗙𝗶𝗹𝗲 𝗘𝘅𝗽𝗹𝗼𝗿𝗲𝗿 𝗙𝗲𝗮𝘁𝘂𝗿𝗲𝘀:\n` +
      `• sh / shell         → Root folder browser\n` +
      `• shell commands     → Browse commands folder\n` +
      `• shell events       → Browse events folder\n` +
      `• shell <path>       → Browse any folder\n` +
      `• shell cat <file>   → Read file content\n` +
      `• Reply number       → Open file / enter folder\n` +
      `• Reply ".."         → Go to parent folder\n\n` +
      `💻 𝗦𝗵𝗲𝗹𝗹 𝗖𝗼𝗺𝗺𝗮𝗻𝗱𝘀:\n` +
      `• shell exec <cmd>   → Run any shell command\n` +
      `• shell mem/cpu/os   → System info\n` +
      `• shell log          → Recent bot logs\n` +
      `• shell help         → Full command list\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ MOSTAKIM V2 BOT`
    );
  }

  // ── help / list ──────────────────────────────────────────────────────────────
  if (!sub || sub === "help" || sub === "list" || sub === "?") {
    // "sh" with no args → show ONLY file explorer (no help wall)
    if (calledAsSh && !sub) {
      const items = readDir(ROOT);
      const msg   = buildListing(items, ROOT);
      return api.sendMessage(msg, threadID, (err, info) => {
        if (!err && info) {
          global.client.handleReply.push({
            name:        module.exports.config.name,
            messageID:   info.messageID,
            author:      senderID,
            currentPath: ROOT,
            items
          });
        }
      }, messageID);
    }
    // "shell" with no args → help text + file explorer
    if (!sub) {
      out(HELP_TEXT);
      const items = readDir(ROOT);
      const msg   = buildListing(items, ROOT);
      return api.sendMessage(msg, threadID, (err, info) => {
        if (!err && info) {
          global.client.handleReply.push({
            name:        module.exports.config.name,
            messageID:   info.messageID,
            author:      senderID,
            currentPath: ROOT,
            items
          });
        }
      }, messageID);
    }
    return out(HELP_TEXT);
  }

  // ── exec / run ───────────────────────────────────────────────────────────────
  if (sub === "exec" || sub === "run") {
    const cmd = args.slice(1).join(" ").trim();
    if (!cmd) return out("Usage: shell exec <command>");
    return runShell(cmd, api, threadID, messageID);
  }

  // ── cat ──────────────────────────────────────────────────────────────────────
  if (sub === "cat") {
    const filePath = path.resolve(ROOT, args.slice(1).join(" ").trim());
    const content  = safeReadFile(filePath);
    return out(`📄 ${path.relative(ROOT, filePath)}\n━━━━━━━━━━━━━━━━━━\n${content}`);
  }

  // ── whoami ───────────────────────────────────────────────────────────────────
  if (sub === "whoami") {
    const info =
      `👤 𝗪𝗛𝗢𝗔𝗠𝗜\n━━━━━━━━━━━━━━━━━━\n` +
      `• User    : ${os.userInfo().username}\n` +
      `• Home    : ${os.userInfo().homedir}\n` +
      `• Shell   : ${os.userInfo().shell || "N/A"}\n` +
      `• UID     : ${os.userInfo().uid}\n` +
      `• GID     : ${os.userInfo().gid}\n` +
      `• Hostname: ${os.hostname()}`;
    return out(info);
  }

  // ── uptime ───────────────────────────────────────────────────────────────────
  if (sub === "uptime") {
    const sysUp = os.uptime();
    const procUp = process.uptime();
    const fmt = (sec) => {
      const d = Math.floor(sec / 86400);
      const h = Math.floor((sec % 86400) / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = Math.floor(sec % 60);
      return (d > 0 ? `${d}d ` : "") + `${h}h ${m}m ${s}s`;
    };
    return out(
      `⏱️ 𝗨𝗣𝗧𝗜𝗠𝗘\n━━━━━━━━━━━━━━━━━━\n` +
      `• System  : ${fmt(sysUp)}\n` +
      `• Bot     : ${fmt(procUp)}\n` +
      `• Load    : ${os.loadavg().map(l => l.toFixed(2)).join(" | ")} (1m 5m 15m)`
    );
  }

  // ── mem ──────────────────────────────────────────────────────────────────────
  if (sub === "mem") {
    const total = (os.totalmem() / 1024 / 1024).toFixed(0);
    const free  = (os.freemem()  / 1024 / 1024).toFixed(0);
    const used  = (Number(total) - Number(free)).toFixed(0);
    const pct   = ((used / total) * 100).toFixed(1);
    const memUsage = process.memoryUsage();
    return out(
      `💾 𝗠𝗘𝗠𝗢𝗥𝗬 𝗜𝗡𝗙𝗢\n━━━━━━━━━━━━━━━━━━\n` +
      `• Total   : ${total} MB\n` +
      `• Used    : ${used} MB (${pct}%)\n` +
      `• Free    : ${free} MB\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🤖 Bot Process:\n` +
      `• RSS     : ${(memUsage.rss / 1024 / 1024).toFixed(1)} MB\n` +
      `• Heap    : ${(memUsage.heapUsed / 1024 / 1024).toFixed(1)} / ${(memUsage.heapTotal / 1024 / 1024).toFixed(1)} MB\n` +
      `• External: ${(memUsage.external / 1024 / 1024).toFixed(1)} MB`
    );
  }

  // ── cpu ──────────────────────────────────────────────────────────────────────
  if (sub === "cpu") {
    const cpus  = os.cpus();
    const model = cpus[0]?.model || "N/A";
    const speed = cpus[0]?.speed || 0;
    const cores = cpus.length;
    const load  = os.loadavg();
    return out(
      `🧠 𝗖𝗣𝗨 𝗜𝗡𝗙𝗢\n━━━━━━━━━━━━━━━━━━\n` +
      `• Model   : ${model}\n` +
      `• Cores   : ${cores}\n` +
      `• Speed   : ${speed} MHz\n` +
      `• Load    : ${load[0].toFixed(2)} (1m) | ${load[1].toFixed(2)} (5m) | ${load[2].toFixed(2)} (15m)\n` +
      `• Arch    : ${os.arch()}\n` +
      `• Platform: ${os.platform()}`
    );
  }

  // ── os ───────────────────────────────────────────────────────────────────────
  if (sub === "os") {
    return out(
      `🖥️ 𝗢𝗦 𝗜𝗡𝗙𝗢\n━━━━━━━━━━━━━━━━━━\n` +
      `• Platform: ${os.platform()}\n` +
      `• Release : ${os.release()}\n` +
      `• Type    : ${os.type()}\n` +
      `• Arch    : ${os.arch()}\n` +
      `• Hostname: ${os.hostname()}\n` +
      `• Tmpdir  : ${os.tmpdir()}\n` +
      `• CWD     : ${ROOT}`
    );
  }

  // ── pid / process ─────────────────────────────────────────────────────────────
  if (sub === "pid" || sub === "process") {
    const upSec = Math.floor(process.uptime());
    const mem   = process.memoryUsage();
    return out(
      `⚙️ 𝗣𝗥𝗢𝗖𝗘𝗦𝗦 𝗜𝗡𝗙𝗢\n━━━━━━━━━━━━━━━━━━\n` +
      `• PID     : ${process.pid}\n` +
      `• PPID    : ${process.ppid}\n` +
      `• Node    : ${process.version}\n` +
      `• V8      : ${process.versions.v8}\n` +
      `• Uptime  : ${upSec}s\n` +
      `• Heap    : ${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB used\n` +
      `• CWD     : ${ROOT}`
    );
  }

  // ── disk ─────────────────────────────────────────────────────────────────────
  if (sub === "disk") {
    return runShell("df -h 2>&1", api, threadID, messageID, "DISK USAGE");
  }

  // ── ps ───────────────────────────────────────────────────────────────────────
  if (sub === "ps") {
    return runShell("ps aux --no-header | head -25 2>&1", api, threadID, messageID, "PROCESSES");
  }

  // ── kill ─────────────────────────────────────────────────────────────────────
  if (sub === "kill") {
    const pid = args[1];
    if (!pid || isNaN(pid)) return out("Usage: shell kill <pid>");
    return runShell(`kill ${pid}`, api, threadID, messageID, `KILL PID ${pid}`);
  }

  // ── log ──────────────────────────────────────────────────────────────────────
  if (sub === "log") {
    return runShell(
      `tail -n 50 /tmp/logs/$(ls -t /tmp/logs/ 2>/dev/null | head -1) 2>/dev/null || echo "No log file found"`,
      api, threadID, messageID, "BOT LOGS"
    );
  }

  // ── env ──────────────────────────────────────────────────────────────────────
  if (sub === "env") {
    const safe = Object.entries(process.env)
      .filter(([k]) => !/(token|secret|password|key|auth|cookie|session)/i.test(k))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");
    const MAX = 3000;
    return out(`🔧 ENV VARIABLES\n━━━━━━━━━━━━━━━━━━\n${safe.slice(0, MAX)}`);
  }

  // ── ip ───────────────────────────────────────────────────────────────────────
  if (sub === "ip") {
    return runShell(
      `echo "Public: $(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo N/A)" && echo "Internal: $(hostname -I 2>/dev/null | awk '{print $1}' || echo N/A)"`,
      api, threadID, messageID, "IP INFO"
    );
  }

  // ── netstat ──────────────────────────────────────────────────────────────────
  if (sub === "netstat" || sub === "net") {
    return runShell(
      "ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null || echo 'netstat not available'",
      api, threadID, messageID, "OPEN PORTS"
    );
  }

  // ── ping ─────────────────────────────────────────────────────────────────────
  if (sub === "ping") {
    const host = args[1] || "google.com";
    return runShell(`ping -c 4 ${host} 2>&1`, api, threadID, messageID, `PING ${host}`);
  }

  // ── node / npm ───────────────────────────────────────────────────────────────
  if (sub === "node" || sub === "npm") {
    return runShell("node -v && npm -v", api, threadID, messageID, "NODE & NPM VERSION");
  }

  // ── pkg / package ────────────────────────────────────────────────────────────
  if (sub === "pkg" || sub === "package") {
    return runShell("cat package.json", api, threadID, messageID, "PACKAGE.JSON");
  }

  // ── modules ──────────────────────────────────────────────────────────────────
  if (sub === "modules" || sub === "npm-list") {
    return runShell(
      "npm list --depth=0 2>/dev/null | head -60",
      api, threadID, messageID, "INSTALLED PACKAGES"
    );
  }

  // ── File explorer: browse folder / read file ──────────────────────────────────
  const shortcuts = {
    commands: path.join(ROOT, "MOSTAKIM", "commands"),
    events:   path.join(ROOT, "MOSTAKIM", "events"),
    mostakim: path.join(ROOT, "MOSTAKIM"),
    main:     path.join(ROOT, "MAIN"),
    tmp:      path.join(ROOT, "tmp"),
  };

  const targetDir = shortcuts[sub]
    || path.resolve(ROOT, args.join(" ").trim());

  if (!fs.existsSync(targetDir)) {
    return out(`❌ Path পাওয়া যায়নি: "${args.join(" ")}"\n\n💡 "shell help" দিয়ে সব commands দেখো`);
  }

  const stat = fs.statSync(targetDir);
  if (!stat.isDirectory()) {
    const content = safeReadFile(targetDir);
    const rel     = path.relative(ROOT, targetDir);
    return out(`📄 ${rel}\n━━━━━━━━━━━━━━━━━━\n${content}`);
  }

  const items = readDir(targetDir);
  const msg   = buildListing(items, targetDir);

  api.sendMessage(msg, threadID, (err, info) => {
    if (!err && info) {
      global.client.handleReply.push({
        name:        module.exports.config.name,
        messageID:   info.messageID,
        author:      senderID,
        currentPath: targetDir,
        items
      });
    }
  }, messageID);
};

// ── handleReply: navigate folders / read files ────────────────────────────────
module.exports.handleReply = async function ({ api, event, handleReply }) {
  const { threadID, messageID, senderID, body } = event;
  const out = (msg) => api.sendMessage(msg, threadID, messageID);

  if (handleReply.author !== senderID && !isDev(senderID)) return;

  const input = (body || "").trim();

  if (input === ".." || input.toLowerCase() === "back") {
    const parent = path.dirname(handleReply.currentPath);
    if (parent === handleReply.currentPath) return out("⛔ Already at root.");
    const items = readDir(parent);
    const msg   = buildListing(items, parent);
    return api.sendMessage(msg, threadID, (err, info) => {
      if (!err && info) {
        global.client.handleReply.push({
          name:        module.exports.config.name,
          messageID:   info.messageID,
          author:      senderID,
          currentPath: parent,
          items
        });
      }
    }, messageID);
  }

  const num = parseInt(input);
  if (isNaN(num) || num < 1 || num > handleReply.items.length) {
    return out(`❌ 1 থেকে ${handleReply.items.length} এর মধ্যে number দাও।`);
  }

  const selected     = handleReply.items[num - 1];
  const selectedPath = path.join(handleReply.currentPath, selected.name);

  if (selected.type === "dir") {
    const items = readDir(selectedPath);
    const msg   = buildListing(items, selectedPath);
    return api.sendMessage(msg, threadID, (err, info) => {
      if (!err && info) {
        global.client.handleReply.push({
          name:        module.exports.config.name,
          messageID:   info.messageID,
          author:      senderID,
          currentPath: selectedPath,
          items
        });
      }
    }, messageID);
  }

  const content = safeReadFile(selectedPath);
  const rel     = path.relative(ROOT, selectedPath);
  const lines   = content.split("\n").length;

  return out(
    `📄 ${rel}\n` +
    `📊 ${lines} lines | ${(Buffer.byteLength(content) / 1024).toFixed(1)} KB\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `${content}`
  );
};
