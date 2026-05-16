"use strict";

const fs      = require("fs-extra");
const path    = require("path");
const logger  = require("./utils/log");

// ═══════════════════════════════════════════════════════════
//  1. LOAD CONFIG.JSON  →  global.config (uppercase keys)
// ═══════════════════════════════════════════════════════════

const CONFIG_PATH = path.join(__dirname, "config.json");
const configJson  = require(CONFIG_PATH);

// Build the DATABASE object that includes/database/index.js expects:
// { sqlite: { storage: "mostakim.db" } }
const dbType = (configJson.database && configJson.database.type) || "sqlite";
const DATABASE = {};
DATABASE[dbType] = { storage: "mostakim.db" };

global.config = {
    // Uppercase keys used by handlers, commands, events
    PREFIX:       configJson.prefix       || "/",
    BOTNAME:      configJson.nickNameBot  || "MOSTAKIM V2 BOT",
    ADMINBOT:     configJson.adminBot     || [],
    ADMINID:      configJson.adminBot     || [],
    LANGUAGE:     configJson.language     || "en",
    NOPFX:        configJson.noPrefix     || false,
    APPSTATEPATH: "appstate.json",
    DATABASE,
    // Keep original config values accessible too
    ...configJson
};

// Path to config used by some commands (e.g. Info.js)
global.client = {
    commands:   new Map(),
    events:     new Map(),
    timeStart:  Date.now(),
    api:        null,
    configPath: CONFIG_PATH
};

// ═══════════════════════════════════════════════════════════
//  2. LANGUAGE  →  global.getText
// ═══════════════════════════════════════════════════════════

function loadLangDict(lang) {
    const langFile = path.join(__dirname, "languages", `${lang}.lang`);
    const fallback = path.join(__dirname, "languages", "en.lang");
    const file     = fs.existsSync(langFile) ? langFile : fallback;
    const lines    = fs.readFileSync(file, "utf8").split("\n");
    const dict     = {};
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const idx = trimmed.indexOf("=");
        if (idx === -1) continue;
        const key = trimmed.substring(0, idx).trim();
        const val = trimmed.substring(idx + 1).trim().replace(/\\n/g, "\n");
        dict[key] = val;
    }
    return dict;
}

const langDict = loadLangDict(global.config.LANGUAGE);

global.getText = function (category, key, ...args) {
    const fullKey = `${category}.${key}`;
    let text = langDict[fullKey] || fullKey;
    args.forEach((arg, i) => {
        text = text.replace(new RegExp(`%${i + 1}`, "g"), String(arg));
    });
    return text;
};

// ═══════════════════════════════════════════════════════════
//  3. GLOBAL DATA STORE
// ═══════════════════════════════════════════════════════════

global.data = {
    threadData:      new Map(),
    userData:        new Map(),
    currenciesData:  new Map(),
    allThreadID:     [],
    allUserID:       [],
    allCurrenciesID: [],
    threadName:      new Map(),
    userName:        new Map(),
    commandBanned:   new Map(),
    threadBanned:    new Map(),
    userBanned:      new Map(),
};

// ═══════════════════════════════════════════════════════════
//  4. PRE-LOAD NODE MODULES  →  global.nodemodule
// ═══════════════════════════════════════════════════════════

global.nodemodule = {};
const preloadMods = [
    "fs-extra", "path", "axios", "moment-timezone",
    "jimp", "request", "cheerio", "fs", "child_process",
    "semver", "ms", "minimist", "node-schedule", "image-downloader"
];
for (const mod of preloadMods) {
    try { global.nodemodule[mod] = require(mod); } catch {}
}

// global.utils — used by some commands (e.g. love.js uses global.utils.downloadFile)
global.utils = require("./utils/index");

// global.moduleData — shared runtime store for commands (e.g. shortcut.js)
global.moduleData = {};

// ═══════════════════════════════════════════════════════════
//  5. LOAD COMMANDS & EVENTS  →  global.client.commands / events
// ═══════════════════════════════════════════════════════════

function loadModules() {
    const cmdDir = path.join(__dirname, "MOSTAKIM", "commands");
    const evtDir = path.join(__dirname, "MOSTAKIM", "events");
    let cmdCount = 0, evtCount = 0;

    // Commands
    for (const file of fs.readdirSync(cmdDir)) {
        if (!file.endsWith(".js")) continue;
        try {
            const mod = require(path.join(cmdDir, file));
            if (!mod.config || !mod.config.name) continue;

            // Try to pre-load declared dependencies
            if (mod.config.dependencies) {
                for (const [pkg] of Object.entries(mod.config.dependencies)) {
                    if (pkg && !global.nodemodule[pkg]) {
                        try { global.nodemodule[pkg] = require(pkg); } catch {}
                    }
                }
            }

            global.client.commands.set(mod.config.name.toLowerCase(), mod);
            cmdCount++;
        } catch (e) {
            logger(`Cannot load command ${file}: ${e.message}`, "[ LOADER ]");
        }
    }

    // Events
    for (const file of fs.readdirSync(evtDir)) {
        if (!file.endsWith(".js")) continue;
        try {
            const mod = require(path.join(evtDir, file));
            if (!mod.config || !mod.config.name) continue;
            global.client.events.set(mod.config.name.toLowerCase(), mod);
            evtCount++;
        } catch (e) {
            logger(`Cannot load event ${file}: ${e.message}`, "[ LOADER ]");
        }
    }

    logger(`Loaded ${cmdCount} commands and ${evtCount} events`, "[ LOADER ]");
    return { cmdCount, evtCount };
}

// Run onLoad for all commands after api is ready
function runOnLoad(api) {
    const safeRun = (name, fn) => {
        try {
            const result = fn();
            // Handle async onLoad — catch rejected promise silently
            if (result && typeof result.catch === "function") {
                result.catch(e => logger(`onLoad async error [${name}]: ${e.message}`, "[ LOADER ]"));
            }
        } catch (e) {
            logger(`onLoad error [${name}]: ${e.message}`, "[ LOADER ]");
        }
    };

    for (const [name, mod] of global.client.commands) {
        if (typeof mod.onLoad === "function") safeRun(name, () => mod.onLoad({ api }));
    }
    for (const [name, mod] of global.client.events) {
        if (typeof mod.onLoad === "function") safeRun(`event:${name}`, () => mod.onLoad({ api }));
    }
}

// ═══════════════════════════════════════════════════════════
//  6. DATABASE INIT
// ═══════════════════════════════════════════════════════════

async function initDatabase() {
    try {
        // global.config.DATABASE must be set before requiring this module
        const db     = require("./includes/database/index");
        const models = require("./includes/database/model")(db);
        await db.sequelize.authenticate();
        await db.sequelize.sync({ force: false });
        logger("Database connected & synced", "[ DATABASE ]");
        return { sequelize: db.sequelize, models };
    } catch (e) {
        logger(`Database error: ${e.message}`, "[ DATABASE ]");
        throw e;
    }
}

// ═══════════════════════════════════════════════════════════
//  7. MAIN START
// ═══════════════════════════════════════════════════════════

async function start() {
    logger("Starting MOSTAKIM V2 BOT...", "[ Starting ]");
    logger(`Prefix: ${global.config.PREFIX} | Language: ${global.config.LANGUAGE}`, "[ Config ]");

    // ── Check appstate ────────────────────────────────────────
    const appstatePath = path.join(__dirname, global.config.APPSTATEPATH);
    const rawAppstate  = fs.existsSync(appstatePath)
        ? fs.readFileSync(appstatePath, "utf8").trim()
        : "";

    if (!rawAppstate || rawAppstate === "FB ID Cookie !!" || rawAppstate.startsWith("FB ID")) {
        logger(
            "appstate.json is empty or invalid.\n" +
            "Please run: node login.js\n" +
            "Or paste your Facebook appstate JSON into appstate.json",
            "[ ERROR ]"
        );
        process.exit(1);
    }

    let appstate;
    try {
        appstate = JSON.parse(rawAppstate);
    } catch {
        logger("appstate.json contains invalid JSON. Please regenerate it.", "[ ERROR ]");
        process.exit(1);
    }

    // ── Init database ─────────────────────────────────────────
    const { models } = await initDatabase();

    // ── Load commands & events ────────────────────────────────
    const { cmdCount, evtCount } = loadModules();
    logger(`${cmdCount} commands | ${evtCount} events loaded`, "[ BOT ]");

    // ── FCA login options ─────────────────────────────────────
    let fcaOptions = {};
    try {
        const fcaJson = require("./mostakim-fca.json");
        for (const [k, v] of Object.entries(fcaJson)) {
            if (!k.startsWith("_")) fcaOptions[k] = v;
        }
    } catch {}

    // Merge optionsFca from config.json (override mostakim-fca.json)
    if (configJson.optionsFca) {
        Object.assign(fcaOptions, configJson.optionsFca);
    }
    fcaOptions.logLevel = "silent";

    // ── Login ─────────────────────────────────────────────────
    logger("Logging in to Facebook...", "[ LOGIN ]");
    const login = require("mostakim-fca");

    login({ appState: appstate }, fcaOptions, async (loginErr, api) => {
        if (loginErr) {
            switch (loginErr.error) {
                case "login-approval":
                    logger("2FA required. Please add your 2FASecret to config.json or use login.js", "[ 2FA ]");
                    break;
                default:
                    logger(`Login failed: ${loginErr.error || loginErr.message || loginErr}`, "[ LOGIN ERROR ]");
            }
            return process.exit(1);
        }

        global.client.api = api;
        const botID = api.getCurrentUserID();
        logger(`Logged in as UID: ${botID}`, "[ LOGIN ]");

        // Run onLoad hooks now that api is available
        runOnLoad(api);

        // ── Set up listener ───────────────────────────────────
        const listenHandler = require("./includes/listen")({ api, models });

        function startListening() {
            api.listen((err, event) => {
                if (err) {
                    logger(`Listen error: ${err.error || err.message || err}`, "[ LISTEN ]");
                    return;
                }
                try { listenHandler(event); } catch (e) {
                    logger(`Handler error: ${e.message}`, "[ HANDLE ]");
                }
            });
        }

        startListening();
        logger(`Bot is running! Prefix: [ ${global.config.PREFIX} ]`, "[ BOT READY ]");

        // ── Auto-save appstate every hour ─────────────────────
        if (configJson.autoRefreshFbstate !== false) {
            setInterval(() => {
                try {
                    const newState = api.getAppState();
                    if (newState) {
                        fs.writeFileSync(appstatePath, JSON.stringify(newState, null, 4));
                    }
                } catch {}
            }, 60 * 60 * 1000);
        }

        // ── Auto-restart MQTT listener ────────────────────────
        if (configJson.restartListenMqtt && configJson.restartListenMqtt.enable) {
            const restartInterval = configJson.restartListenMqtt.timeRestart    || 3600000;
            const restartDelay    = configJson.restartListenMqtt.delayAfterStopListening || 2000;

            setInterval(() => {
                try {
                    api.stopListening();
                    setTimeout(() => {
                        startListening();
                        if (configJson.restartListenMqtt.logNoti) {
                            logger("MQTT listener restarted", "[ MQTT ]");
                        }
                    }, restartDelay);
                } catch {}
            }, restartInterval);
        }
    });
}

start().catch(err => {
    logger(`Fatal error: ${err.message || err}`, "[ FATAL ]");
    process.exit(1);
});
