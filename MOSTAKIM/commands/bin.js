const fs    = require("fs");
const path  = require("path");
const https = require("https");

module.exports.config = {
  name: "bin",
  version: "2.0.0",
  hasPermssion: 0,
  credits: "SAGOR",
  description: "Upload cmd/text to pastebin",
  commandCategory: "utility",
  usages: "bin <cmdname> / bin text <your text>",
  cooldowns: 5
};

// ── HTTPS POST helper ──────────────────────────────────────────────────────
function httpsPost(hostname, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname,
      path: urlPath,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", chunk => raw += chunk);
      res.on("end", () => {
        try { resolve(JSON.parse(raw)); }
        catch { reject(new Error(`Invalid JSON response: ${raw.slice(0, 200)}`)); }
      });
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

// ── Run ────────────────────────────────────────────────────────────────────
module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;

  if (!args.length) {
    return api.sendMessage(
      "⚠️ Usage:\n• bin <cmdname>\n• bin text <your text>",
      threadID, messageID
    );
  }

  const loading = await api.sendMessage("⏳ Processing...", threadID);

  try {
    let content = "";
    let title   = "text";

    // ── Mode: text ──
    if (args[0].toLowerCase() === "text") {
      content = args.slice(1).join(" ").trim();

      if (!content) {
        await api.unsendMessage(loading.messageID);
        return api.sendMessage("❌ Please provide text after 'text'.", threadID, messageID);
      }

    // ── Mode: command file ──
    } else {
      const rawName = path.basename(args[0].replace(/\.js$/i, "")) + ".js";

      if (!/^[\w\-. ]+\.js$/.test(rawName)) {
        await api.unsendMessage(loading.messageID);
        return api.sendMessage("❌ Invalid command name.", threadID, messageID);
      }

      const possiblePaths = [
        path.join(__dirname, rawName),
        path.join(__dirname, "..", "cmds", rawName),
        path.join(process.cwd(), "src", "cmds", rawName),
        path.join(process.cwd(), "modules", "commands", rawName),
        path.join(process.cwd(), "cmds", rawName),
        path.join(process.cwd(), "commands", rawName)
      ];

      const filePath = possiblePaths.find(f => fs.existsSync(f));

      if (!filePath) {
        await api.unsendMessage(loading.messageID);
        return api.sendMessage(`❌ Command not found: ${rawName}`, threadID, messageID);
      }

      content = fs.readFileSync(filePath, "utf8").trim();
      title   = rawName;

      if (!content) {
        await api.unsendMessage(loading.messageID);
        return api.sendMessage(`❌ File is empty: ${rawName}`, threadID, messageID);
      }
    }

    // ── Upload to pastebin ──
    const data = await httpsPost(
      "sagor.nav.bd",
      "/sagor/pastebin",
      { key: "sagor", text: content, title }
    );

    await api.unsendMessage(loading.messageID);

    if (!data || data.status !== "success") {
      return api.sendMessage(
        `❌ Upload failed.\nResponse: ${JSON.stringify(data)}`,
        threadID, messageID
      );
    }

    return api.sendMessage(`🔗 Raw: ${data.raw}`, threadID, messageID);

  } catch (err) {
    try { await api.unsendMessage(loading.messageID); } catch (_) {}
    console.error("[bin] Error:", err.message);
    return api.sendMessage(`❌ Error: ${err.message}`, threadID, messageID);
  }
};
