const fs    = require("fs-extra");
const path  = require("path");
const http  = require("http");
const https = require("https");

const CONFIG_PATH = path.join(__dirname, "../../config.json");

function readConfig() {
	return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
}

function saveConfig(cfg) {
	fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf-8");
}

function pingUrl(url) {
	return new Promise((resolve) => {
		try {
			const mod   = url.startsWith("https") ? https : http;
			const start = Date.now();
			const req   = mod.get(url, { timeout: 8000 }, (res) => {
				resolve({ ok: true, status: res.statusCode, ms: Date.now() - start });
			});
			req.on("error",   (e) => resolve({ ok: false, error: e.message }));
			req.on("timeout", ()  => { req.destroy(); resolve({ ok: false, error: "Request timed out" }); });
		} catch (e) {
			resolve({ ok: false, error: e.message });
		}
	});
}

function getAutoUrl() {
	if (process.env.RENDER_EXTERNAL_URL)   return process.env.RENDER_EXTERNAL_URL;
	if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
	if (process.env.REPLIT_DEV_DOMAIN)     return `https://${process.env.REPLIT_DEV_DOMAIN}`;
	if (process.env.REPLIT_DOMAINS)        return `https://${process.env.REPLIT_DOMAINS.split(",")[0].trim()}`;
	if (process.env.KOYEB_PUBLIC_DOMAIN)   return `https://${process.env.KOYEB_PUBLIC_DOMAIN}`;
	if (process.env.FLY_APP_NAME)          return `https://${process.env.FLY_APP_NAME}.fly.dev`;
	if (process.env.HEROKU_APP_NAME)       return `https://${process.env.HEROKU_APP_NAME}.herokuapp.com`;
	return null;
}

module.exports = {
	config: {
		name:             "keepalive",
		aliases:          ["alive", "uptset"],
		version:          "1.0.0",
		author:           "MOSTAKIM",
		countDown:        5,
		role:             2,
		shortDescription: "Manage bot keep-alive / uptime monitor",
		longDescription:  "Set a self-ping URL to keep the bot alive on Render, Railway, Koyeb, and other cloud platforms.",
		category:         "owner",
		guide:
			"{pn} status           - Show current keep-alive settings\n" +
			"{pn} set <url>        - Set the ping URL\n" +
			"{pn} interval <sec>   - Set ping interval in seconds\n" +
			"{pn} on               - Enable keep-alive\n" +
			"{pn} off              - Disable keep-alive\n" +
			"{pn} ping             - Send a ping right now\n" +
			"{pn} reset            - Reset all settings to default"
	},

	run: async ({ api, event, args }) => {
		const { threadID, messageID } = event;
		const sub    = (args[0] || "status").toLowerCase();
		const PREFIX = global.config?.PREFIX || "/";

		let cfg;
		try {
			cfg = readConfig();
		} catch (e) {
			return api.sendMessage(`❌ Failed to read config.json: ${e.message}`, threadID, messageID);
		}

		if (!cfg.autoUptime) cfg.autoUptime = {};

		// ── STATUS ──
		if (sub === "status") {
			const au      = cfg.autoUptime;
			const autoUrl = getAutoUrl();
			const active  = (au.url || autoUrl || "").replace(/\/$/, "");
			return api.sendMessage(
				`🔄 KEEP-ALIVE STATUS\n` +
				`${"─".repeat(30)}\n` +
				`📡 Enabled    : ${au.enable !== false ? "✅ Yes" : "❌ No"}\n` +
				`⏱️  Interval   : ${au.timeInterval || 180}s (every ${Math.floor((au.timeInterval || 180) / 60)} min)\n` +
				`🌐 Custom URL : ${au.url || "(not set)"}\n` +
				`🤖 Auto URL   : ${autoUrl || "(not detected)"}\n` +
				`✅ Active URL : ${active ? active + "/ping" : "None"}\n` +
				`${"─".repeat(30)}\n` +
				`💡 To set URL:\n${PREFIX}keepalive set https://your-app.onrender.com`,
				threadID, messageID
			);
		}

		// ── SET ──
		if (sub === "set") {
			const url = args[1];
			if (!url || !url.startsWith("http")) {
				return api.sendMessage(
					`❌ Please provide a valid URL.\n\nExample:\n${PREFIX}keepalive set https://mybot.onrender.com`,
					threadID, messageID
				);
			}
			api.sendMessage(`⏳ Testing URL: ${url}/ping ...`, threadID, messageID);
			const result = await pingUrl(url.replace(/\/$/, "") + "/ping");
			cfg.autoUptime.url    = url.replace(/\/$/, "");
			cfg.autoUptime.enable = true;
			try { saveConfig(cfg); } catch (e) {
				return api.sendMessage(`❌ Failed to save config: ${e.message}`, threadID, messageID);
			}
			return api.sendMessage(
				`✅ Keep-alive URL saved!\n\n` +
				`🌐 URL  : ${url}\n` +
				`📡 Test : ${result.ok
					? `✅ OK — ${result.ms}ms (HTTP ${result.status})`
					: `⚠️ Failed — ${result.error}`}\n\n` +
				`${result.ok
					? "🎉 Bot will now ping itself to stay alive!"
					: "⚠️ URL saved but ping failed. Double-check the URL."}`,
				threadID, messageID
			);
		}

		// ── INTERVAL ──
		if (sub === "interval") {
			const sec = parseInt(args[1]);
			if (isNaN(sec) || sec < 30) {
				return api.sendMessage(
					`❌ Minimum interval is 30 seconds.\n\nExample:\n${PREFIX}keepalive interval 120`,
					threadID, messageID
				);
			}
			cfg.autoUptime.timeInterval = sec;
			try { saveConfig(cfg); } catch (e) {
				return api.sendMessage(`❌ Failed to save config: ${e.message}`, threadID, messageID);
			}
			return api.sendMessage(
				`✅ Ping interval updated!\n\n` +
				`⏱️ Every ${sec}s (${Math.floor(sec / 60)}m ${sec % 60}s)\n\n` +
				`⚠️ Restart the bot to apply.`,
				threadID, messageID
			);
		}

		// ── ON ──
		if (sub === "on") {
			cfg.autoUptime.enable = true;
			try { saveConfig(cfg); } catch (e) {
				return api.sendMessage(`❌ Failed to save config: ${e.message}`, threadID, messageID);
			}
			return api.sendMessage(`✅ Keep-alive enabled!\n\n⚠️ Restart the bot to apply.`, threadID, messageID);
		}

		// ── OFF ──
		if (sub === "off") {
			cfg.autoUptime.enable = false;
			try { saveConfig(cfg); } catch (e) {
				return api.sendMessage(`❌ Failed to save config: ${e.message}`, threadID, messageID);
			}
			return api.sendMessage(`🔴 Keep-alive disabled.`, threadID, messageID);
		}

		// ── PING ──
		if (sub === "ping") {
			const url = (cfg.autoUptime?.url || getAutoUrl() || "").replace(/\/$/, "");
			if (!url) {
				return api.sendMessage(
					`❌ No URL configured.\n\nUse ${PREFIX}keepalive set <url> first.`,
					threadID, messageID
				);
			}
			api.sendMessage(`⏳ Sending ping to: ${url}/ping`, threadID, messageID);
			const result = await pingUrl(url + "/ping");
			return api.sendMessage(
				`📡 PING RESULT\n` +
				`${"─".repeat(28)}\n` +
				`🌐 URL    : ${url}/ping\n` +
				`${result.ok
					? `✅ Status : HTTP ${result.status}\n⚡ Speed  : ${result.ms}ms\n📶 Result : Success`
					: `❌ Failed : ${result.error}`}`,
				threadID, messageID
			);
		}

		// ── RESET ──
		if (sub === "reset") {
			cfg.autoUptime = { enable: true, timeInterval: 180, url: "", notes: "Auto-detected platform URL will be used if url is empty." };
			try { saveConfig(cfg); } catch (e) {
				return api.sendMessage(`❌ Failed to save config: ${e.message}`, threadID, messageID);
			}
			return api.sendMessage(
				`🔄 Reset to defaults!\n\n✅ Enabled  : Yes\n⏱️ Interval : 180s\n🌐 URL      : auto-detect`,
				threadID, messageID
			);
		}

		// ── UNKNOWN ──
		return api.sendMessage(
			`❓ Unknown subcommand: "${args[0]}"\n\n` +
			`Available: status | set | interval | on | off | ping | reset\n\n` +
			`Example: ${PREFIX}keepalive status`,
			threadID, messageID
		);
	}
};