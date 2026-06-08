/**
 * Global Telegram notification utility
 * Usage: global.sendTg("message") anywhere in the bot
 */
const axios = require("axios");

// ── In-memory circular log buffer (last 100 lines) ─────────────────────────
const LOG_BUFFER_SIZE = 100;
global._logBuffer = global._logBuffer || [];

function _pushLog(level, ...args) {
  const tz   = (global.config && global.config.timeZone) || "Asia/Dhaka";
  const time = new Date().toLocaleTimeString("en-US", { timeZone: tz, hour12: false });
  const text = args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
  const line = `[${time}] [${level}] ${text}`;
  global._logBuffer.push(line);
  if (global._logBuffer.length > LOG_BUFFER_SIZE) global._logBuffer.shift();
}

// ── Intercept console.log → buffer ────────────────────────────────────────
const _origLog = console.log.bind(console);
console.log = (...args) => {
  _origLog(...args);
  try { _pushLog("LOG", ...args); } catch (_) {}
};

function sendTelegram(text, botToken, chatId) {
  if (!botToken || !chatId) return;
  const MAX = 4000;
  const chunks = [];
  for (let i = 0; i < text.length; i += MAX) chunks.push(text.slice(i, i + MAX));
  for (const chunk of chunks) {
    axios.get(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      params: { chat_id: chatId, text: chunk, parse_mode: "" }
    }).catch(() => {});
  }
}

/**
 * Setup global.sendTg() using config and intercept console.error/warn
 * Call this once after global.config is populated.
 */
function setupTelegramConsole() {
  const cfg = global.config || {};
  const tg  = cfg.telegramNotify || {};
  if (!tg.enable || !tg.botToken || !tg.chatId) return;

  const token  = tg.botToken;
  const chatId = tg.chatId;

  // ── Global helper ──────────────────────────────────────────────────────
  global.sendTg = (msg) => sendTelegram(String(msg), token, chatId);

  // ── Noise filter: skip Node.js internal warnings & TLS notices ─────────
  const _shouldSkip = (msg) => {
    if (!msg) return false;
    const s = String(msg);
    if (/^\(node:\d+\) Warning:/i.test(s))          return true;
    if (s.includes("NODE_TLS_REJECT_UNAUTHORIZED"))  return true;
    if (s.includes("TLS connections and HTTPS"))     return true;
    if (s.includes("getAllowUnauthorized"))           return true;
    if (s.includes("DeprecationWarning"))            return true;
    if (s.includes("ExperimentalWarning"))           return true;
    return false;
  };

  // ── Override console.error → buffer + Telegram ────────────────────────
  const _origError = console.error.bind(console);
  console.error = (...args) => {
    _origError(...args);
    try {
      const combined = args.map(a => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a))).join(" ");
      _pushLog("ERR", combined);
      if (_shouldSkip(combined)) return;
      sendTelegram(`❌ ERROR\n${combined}`, token, chatId);
    } catch (_) {}
  };

  // ── Override console.warn → buffer + Telegram ─────────────────────────
  const _origWarn = console.warn.bind(console);
  console.warn = (...args) => {
    _origWarn(...args);
    try {
      const combined = args.map(a => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a))).join(" ");
      _pushLog("WARN", combined);
      if (_shouldSkip(combined)) return;
      sendTelegram(`⚠️ WARN\n${combined}`, token, chatId);
    } catch (_) {}
  };

  // ── Uncaught exceptions ────────────────────────────────────────────────
  process.removeAllListeners("uncaughtException");
  process.on("uncaughtException", (err) => {
    const text = `💥 UNCAUGHT EXCEPTION\n${err && err.message ? err.message : err}\n${err && err.stack ? err.stack.slice(0, 1500) : ""}`;
    sendTelegram(text, token, chatId);
  });

  // ── Unhandled promise rejections ───────────────────────────────────────
  process.removeAllListeners("unhandledRejection");
  process.on("unhandledRejection", (reason) => {
    const text = `🔴 UNHANDLED REJECTION\n${reason && reason.message ? reason.message : String(reason)}`;
    sendTelegram(text, token, chatId);
  });

  // ── Process exit / SIGTERM ─────────────────────────────────────────────
  process.on("exit", (code) => {
    if (code !== 0) sendTelegram(`🛑 BOT PROCESS EXITED — code: ${code}`, token, chatId);
  });
}

/**
 * Detect the type of Facebook login error and return a human-readable label.
 */
function classifyLoginError(err) {
  const str = (typeof err === "object" ? JSON.stringify(err) : String(err)).toLowerCase();
  if (str.includes("checkpoint") || str.includes("suspended") || str.includes("disabled"))
    return "🚫 FACEBOOK ACCOUNT CHECKPOINT/SUSPENDED";
  if (str.includes("incorrect password") || str.includes("wrong password"))
    return "🔑 WRONG PASSWORD";
  if (str.includes("two-factor") || str.includes("2fa") || str.includes("otp"))
    return "🔐 TWO-FACTOR AUTH REQUIRED";
  if (str.includes("logout") || str.includes("logged out") || str.includes("session"))
    return "🔓 SESSION EXPIRED / LOGGED OUT";
  if (str.includes("rate") || str.includes("limit") || str.includes("too many"))
    return "⏱️ RATE LIMITED BY FACEBOOK";
  if (str.includes("network") || str.includes("econnrefused") || str.includes("timeout"))
    return "🌐 NETWORK ERROR";
  return "❓ LOGIN FAILED";
}

module.exports = { sendTelegram, setupTelegramConsole, classifyLoginError };
