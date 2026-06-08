const moment = require("moment-timezone");
const { readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync, rm } = require("fs-extra");
const { join, resolve } = require("path");
const { execSync } = require('child_process');
const logger = require("./utils/log.js");
const login = require("mostakim-fca"); 
const axios = require("axios");
const listPackage = JSON.parse(readFileSync('./package.json')).dependencies;
const listbuiltinModules = require("module").builtinModules;
const { sendTelegram, setupTelegramConsole, classifyLoginError } = require("./utils/telegram");

global.client = new Object({
    commands: new Map(),
    aliases: new Map(),
    events: new Map(),
    cooldowns: new Map(),
    eventRegistered: new Array(),
    handleSchedule: new Array(),
    handleReaction: new Array(),
    handleReply: new Array(),
    mainPath: process.cwd(),
    configPath: new String(),
  getTime: function (option) {
        switch (option) {
            case "seconds":
                return `${moment.tz("Asia/Dhaka").format("ss")}`;
            case "minutes":
                return `${moment.tz("Asia/Dhaka").format("mm")}`;
            case "hours":
                return `${moment.tz("Asia/Dhaka").format("HH")}`;
            case "date": 
                return `${moment.tz("Asia/Dhaka").format("DD")}`;
            case "month":
                return `${moment.tz("Asia/Dhaka").format("MM")}`;
            case "year":
                return `${moment.tz("Asia/Dhaka").format("YYYY")}`;
            case "fullHour":
                return `${moment.tz("Asia/Dhaka").format("HH:mm:ss")}`;
            case "fullYear":
                return `${moment.tz("Asia/Dhaka").format("DD/MM/YYYY")}`;
            case "fullTime":
                return `${moment.tz("Asia/Dhaka").format("HH:mm:ss DD/MM/YYYY")}`;
        }
  }
});

global.data = new Object({
    threadInfo: new Map(),
    threadData: new Map(),
    userName: new Map(),
    userBanned: new Map(),
    threadBanned: new Map(),
    commandBanned: new Map(),
    threadAllowNSFW: new Array(),
    allUserID: new Array(),
    allCurrenciesID: new Array(),
    allThreadID: new Array()
});

global.utils = require("./utils");

global.nodemodule = new Object();

global.config = new Object();

global.configModule = new Object();

global.moduleData = new Array();

global.language = new Object();

//////////////////////////////////////////////////////////
//========= Find and get variable from Config =========//
/////////////////////////////////////////////////////////

var configValue;
try {
    global.client.configPath = join(global.client.mainPath, "config.json");
    configValue = require(global.client.configPath);
    logger.loader("Found file config: config.json");
}
catch {
    if (existsSync(global.client.configPath.replace(/\.json/g,"") + ".temp")) {
        configValue = readFileSync(global.client.configPath.replace(/\.json/g,"") + ".temp");
        configValue = JSON.parse(configValue);
        logger.loader(`Found: ${global.client.configPath.replace(/\.json/g,"") + ".temp"}`);
    }
    else return logger.loader("config.json not found!", "error");
}

try {
    for (const key in configValue) global.config[key] = configValue[key];
    logger.loader("Config Loaded!");
    setupTelegramConsole();
}
catch { return logger.loader("Can't load file config!", "error") }

const { Sequelize, sequelize } = require("./MAIN/database");

writeFileSync(global.client.configPath + ".temp", JSON.stringify(global.config, null, 4), 'utf8');

/////////////////////////////////////////
//========= Load language use =========//
/////////////////////////////////////////

const langFile = (readFileSync(`${__dirname}/languages/${global.config.language || "en"}.lang`, { encoding: 'utf-8' })).split(/\r?\n|\r/);
const langData = langFile.filter(item => item.indexOf('#') != 0 && item != '');
for (const item of langData) {
    const getSeparator = item.indexOf('=');
    const itemKey = item.slice(0, getSeparator);
    const itemValue = item.slice(getSeparator + 1, item.length);
    const head = itemKey.slice(0, itemKey.indexOf('.'));
    const key = itemKey.replace(head + '.', '');
    const value = itemValue.replace(/\\n/gi, '\n');
    if (typeof global.language[head] == "undefined") global.language[head] = new Object();
    global.language[head][key] = value;
}

global.getText = function (...args) {
    const langText = global.language;
    const headKey = (args[0] || '').toLowerCase();
    if (!langText.hasOwnProperty(headKey)) throw `${__filename} - Not found key language: ${args[0]}`;
    var text = langText[headKey][args[1]];
    for (var i = args.length - 1; i > 0; i--) {
        const regEx = RegExp(`%${i}`, 'g');
        text = text.replace(regEx, args[i + 1]);
    }
    return text;
}

try {
    var appStateFile = resolve(join(global.client.mainPath, global.config.APPSTATEPATH || "appstate.json"));
    var appState = require(appStateFile);
    logger.loader(global.getText("MOSTAKIM", "foundPathAppstate"))
}
catch { return logger.loader(global.getText("MOSTAKIM", "notFoundPathAppstate"), "error") }

//========= Login account and start Listen Event =========//

function onBot({ models: botModel }) {
    const loginData = {};
    loginData['appState'] = appState;
    login(loginData, async(loginError, loginApiData) => {
        if (loginError) {
            const errStr   = typeof loginError === "object" ? JSON.stringify(loginError, null, 2) : String(loginError);
            const label    = classifyLoginError(loginError);
            const tg       = global.config.telegramNotify || {};
            const _tz      = global.config.timeZone || "Asia/Dhaka";
            const _time    = new Date().toLocaleString("en-GB", { timeZone: _tz, hour12: false });
            const tgMsg    =
                `${label}\n\n` +
                `🤖 Bot: ${global.config.BOTNAME || "Bot"}\n` +
                `⏰ Time: ${_time}\n` +
                `📋 Detail: ${errStr.slice(0, 800)}`;
            logger(errStr, `ERROR`);
            if (tg.enable && tg.botToken && tg.chatId)
                sendTelegram(tgMsg, tg.botToken, tg.chatId);
            return;
        }
        loginApiData.setOptions(global.config.FCAOption)
        writeFileSync(appStateFile, JSON.stringify(loginApiData.getAppState(), null, '\x09'))
        global.client.api = loginApiData
        global.config.version = '1.2.14'
        global.client.timeStart = new Date().getTime(),
            function () {
                const listCommand = readdirSync(global.client.mainPath + '/MOSTAKIM/commands').filter(command => command.endsWith('.js') && !command.includes('example') && !global.config.commandDisabled.includes(command));
                for (const command of listCommand) {
                    try {
                        var module = require(global.client.mainPath + '/MOSTAKIM/commands/' + command);
                        // Accept onStart (GoatBot style) as equivalent to run
                        if (module.onStart && !module.run) module.run = module.onStart;
                        // Accept category (GoatBot style) as equivalent to commandCategory
                        if (module.config && module.config.category && !module.config.commandCategory)
                            module.config.commandCategory = module.config.category;
                        if (!module.config || !module.run || !module.config.commandCategory) throw new Error(global.getText('MOSTAKIM', 'errorFormat'));
                        if (global.client.commands.has(module.config.name || '')) throw new Error(global.getText('MOSTAKIM', 'nameExist'));
                        if (!module.languages || typeof module.languages != 'object' || Object.keys(module.languages).length == 0) logger.loader(global.getText('MOSTAKIM', 'notFoundLanguage', module.config.name), 'warn');
                        if (module.config.dependencies && typeof module.config.dependencies == 'object') {
                            for (const reqDependencies in module.config.dependencies) {
                                const reqDependenciesPath = join(__dirname, 'nodemodules', 'node_modules', reqDependencies);
                                try {
                                    if (!global.nodemodule.hasOwnProperty(reqDependencies)) {
                                        if (listPackage.hasOwnProperty(reqDependencies) || listbuiltinModules.includes(reqDependencies)) global.nodemodule[reqDependencies] = require(reqDependencies);
                                        else global.nodemodule[reqDependencies] = require(reqDependenciesPath);
                                    } else '';
                                } catch {
                                    var check = false;
                                    var isError;
                                    logger.loader(global.getText('MOSTAKIM', 'notFoundPackage', reqDependencies, module.config.name), 'warn');
                                    execSync('npm --no-package-lock --save install ' + reqDependencies + (module.config.dependencies[reqDependencies] == '*' || module.config.dependencies[reqDependencies] == '' ? '' : '@' + module.config.dependencies[reqDependencies]), { 'stdio': 'inherit', 'env': process['env'], 'shell': true, 'cwd': join(__dirname, 'nodemodules') });
                                    for (let i = 1; i <= 3; i++) {
                                        try {
                                            require['cache'] = {};
                                            if (listPackage.hasOwnProperty(reqDependencies) || listbuiltinModules.includes(reqDependencies)) global['nodemodule'][reqDependencies] = require(reqDependencies);
                                            else global['nodemodule'][reqDependencies] = require(reqDependenciesPath);
                                            check = true;
                                            break;
                                        } catch (error) { isError = error; }
                                        if (check || !isError) break;
                                    }
                                    if (!check || isError) throw global.getText('MOSTAKIM', 'cantInstallPackage', reqDependencies, module.config.name, isError);
                                }
                            }
                            logger.loader(global.getText('MOSTAKIM', 'loadedPackage', module.config.name));
                        }
                        if (module.config.envConfig) try {
                            for (const envConfig in module.config.envConfig) {
                                if (typeof global.configModule[module.config.name] == 'undefined') global.configModule[module.config.name] = {};
                                if (typeof global.config[module.config.name] == 'undefined') global.config[module.config.name] = {};
                                if (typeof global.config[module.config.name][envConfig] !== 'undefined') global['configModule'][module.config.name][envConfig] = global.config[module.config.name][envConfig];
                                else global.configModule[module.config.name][envConfig] = module.config.envConfig[envConfig] || '';
                                if (typeof global.config[module.config.name][envConfig] == 'undefined') global.config[module.config.name][envConfig] = module.config.envConfig[envConfig] || '';
                            }
                            logger.loader(global.getText('MOSTAKIM', 'loadedConfig', module.config.name));
                        } catch (error) {
                            throw new Error(global.getText('MOSTAKIM', 'loadedConfig', module.config.name, JSON.stringify(error)));
                        }
                        if (module.onLoad) {
                            try {
                                const moduleData = {};
                                moduleData.api = loginApiData;
                                moduleData.models = botModel;
                                module.onLoad(moduleData);
                            } catch (_0x20fd5f) {
                                throw new Error(global.getText('MOSTAKIM', 'cantOnload', module.config.name, JSON.stringify(_0x20fd5f)), 'error');
                            };
                        }
                        if (module.handleEvent) global.client.eventRegistered.push(module.config.name);
                        global.client.commands.set(module.config.name, module);
                        // Register aliases in separate map (keeps help list clean)
                        if (Array.isArray(module.config.aliases)) {
                            for (const alias of module.config.aliases) {
                                if (alias && !global.client.aliases.has(alias))
                                    global.client.aliases.set(alias.toLowerCase(), module.config.name);
                            }
                        }
                        logger.loader(global.getText('MOSTAKIM', 'successLoadModule', module.config.name));
                    } catch (error) {
                        const _cmdName = (module && module.config && module.config.name) ? module.config.name : '(unknown)';
                        const _reason  = error && error.message ? error.message : String(error);
                        logger.loader(
                            `❌ COMMAND FAILED TO LOAD\n` +
                            `  📄 File    : MOSTAKIM/commands/${command}\n` +
                            `  🏷️  Module  : ${_cmdName}\n` +
                            `  ⚠️  Reason  : ${_reason}`,
                            'error'
                        );
                        if (global.sendTg) global.sendTg(
                            `❌ COMMAND LOAD FAILED\n📄 File: MOSTAKIM/commands/${command}\n🏷️ Module: ${_cmdName}\n⚠️ Reason: ${_reason.slice(0, 600)}`
                        );
                    };
                }
            }(),
            function() {
                const events = readdirSync(global.client.mainPath + '/MOSTAKIM/events').filter(event => event.endsWith('.js') && !global.config.eventDisabled.includes(event));
                for (const ev of events) {
                    try {
                        var event = require(global.client.mainPath + '/MOSTAKIM/events/' + ev);
                        if (!event.config || !event.run) throw new Error(global.getText('MOSTAKIM', 'errorFormat'));
                        if (global.client.events.has(event.config.name) || '') throw new Error(global.getText('MOSTAKIM', 'nameExist'));
                        if (event.config.dependencies && typeof event.config.dependencies == 'object') {
                            for (const dependency in event.config.dependencies) {
                                const _0x21abed = join(__dirname, 'nodemodules', 'node_modules', dependency);
                                try {
                                    if (!global.nodemodule.hasOwnProperty(dependency)) {
                                        if (listPackage.hasOwnProperty(dependency) || listbuiltinModules.includes(dependency)) global.nodemodule[dependency] = require(dependency);
                                        else global.nodemodule[dependency] = require(_0x21abed);
                                    } else '';
                                } catch {
                                    let check = false;
                                    let isError;
                                    logger.loader(global.getText('MOSTAKIM', 'notFoundPackage', dependency, event.config.name), 'warn');
                                    execSync('npm --no-package-lock --save install ' + dependency + (event.config.dependencies[dependency] == '*' || event.config.dependencies[dependency] == '' ? '' : '@' + event.config.dependencies[dependency]), { 'stdio': 'inherit', 'env': process['env'], 'shell': true, 'cwd': join(__dirname, 'nodemodules') });
                                    for (let i = 1; i <= 3; i++) {
                                        try {
                                            require['cache'] = {};
                                            if (global.nodemodule.hasOwnProperty(dependency)) break;
                                            if (listPackage.hasOwnProperty(dependency) || listbuiltinModules.includes(dependency)) global.nodemodule[dependency] = require(dependency);
                                            else global.nodemodule[dependency] = require(_0x21abed);
                                            check = true;
                                            break;
                                        } catch (error) { isError = error; }
                                        if (check || !isError) break;
                                    }
                                    if (!check || isError) throw global.getText('MOSTAKIM', 'cantInstallPackage', dependency, event.config.name);
                                }
                            }
                            logger.loader(global.getText('MOSTAKIM', 'loadedPackage', event.config.name));
                        }
                        if (event.config.envConfig) try {
                            for (const _0x5beea0 in event.config.envConfig) {
                                if (typeof global.configModule[event.config.name] == 'undefined') global.configModule[event.config.name] = {};
                                if (typeof global.config[event.config.name] == 'undefined') global.config[event.config.name] = {};
                                if (typeof global.config[event.config.name][_0x5beea0] !== 'undefined') global.configModule[event.config.name][_0x5beea0] = global.config[event.config.name][_0x5beea0];
                                else global.configModule[event.config.name][_0x5beea0] = event.config.envConfig[_0x5beea0] || '';
                                if (typeof global.config[event.config.name][_0x5beea0] == 'undefined') global.config[event.config.name][_0x5beea0] = event.config.envConfig[_0x5beea0] || '';
                            }
                            logger.loader(global.getText('MOSTAKIM', 'loadedConfig', event.config.name));
                        } catch (error) {
                            throw new Error(global.getText('MOSTAKIM', 'loadedConfig', event.config.name, JSON.stringify(error)));
                        }
                        if (event.onLoad) try {
                            const eventData = {};
                            eventData.api = loginApiData, eventData.models = botModel;
                            event.onLoad(eventData);
                        } catch (error) {
                            throw new Error(global.getText('MOSTAKIM', 'cantOnload', event.config.name, JSON.stringify(error)), 'error');
                        }
                        global.client.events.set(event.config.name, event);
                        logger.loader(global.getText('MOSTAKIM', 'successLoadModule', event.config.name));
                    } catch (error) {
                        const _evName = (event && event.config && event.config.name) ? event.config.name : '(unknown)';
                        const _reason = error && error.message ? error.message : String(error);
                        logger.loader(
                            `❌ EVENT FAILED TO LOAD\n` +
                            `  📄 File    : MOSTAKIM/events/${ev}\n` +
                            `  🏷️  Module  : ${_evName}\n` +
                            `  ⚠️  Reason  : ${_reason}`,
                            'error'
                        );
                        if (global.sendTg) global.sendTg(
                            `❌ EVENT LOAD FAILED\n📄 File: MOSTAKIM/events/${ev}\n🏷️ Module: ${_evName}\n⚠️ Reason: ${_reason.slice(0, 600)}`
                        );
                    }
                }
            }()
        logger.loader(global.getText('MOSTAKIM', 'finishLoadModule', global.client.commands.size, global.client.events.size)) 
        logger.loader(`Startup Time: ${((Date.now() - global.client.timeStart) / 1000).toFixed()}s`)   
        logger.loader('===== [ ' + (Date.now() - global.client.timeStart) + 'ms ] =====')
        writeFileSync(global.client['configPath'], JSON['stringify'](global.config, null, 4), 'utf8') 
        unlinkSync(global['client']['configPath'] + '.temp');        
        const listenerData = {};
        listenerData.api = loginApiData; 
        listenerData.models = botModel;
        const listener = require('./MAIN/listen')(listenerData);

        function listenerCallback(error, message) {
            if (error && error !== null && !(error.type === 'ready' && error.error === null)) {
                const errStr  = JSON.stringify(error);
                const errType = (error && error.type) ? error.type : "unknown";
                logger(global.getText('MOSTAKIM', 'handleListenError', errStr), 'error');
                if (global.client.notifyMqttError) global.client.notifyMqttError(errStr);
                // ── Classify & send detailed TG alert ────────────────────────
                const tg = global.config.telegramNotify || {};
                if (tg.enable && tg.botToken && tg.chatId) {
                    const _tz   = global.config.timeZone || "Asia/Dhaka";
                    const _time = new Date().toLocaleString("en-GB", { timeZone: _tz, hour12: false });
                    const isLogout = errStr.includes("logout") || errStr.includes("session") || errStr.includes("logged");
                    const isCheckpoint = errStr.includes("checkpoint") || errStr.includes("disabled") || errStr.includes("suspended");
                    const emoji = isCheckpoint ? "🚫" : isLogout ? "🔓" : "⚠️";
                    const label = isCheckpoint ? "ACCOUNT CHECKPOINT/BANNED" : isLogout ? "ACCOUNT LOGGED OUT" : "MQTT LISTEN ERROR";
                    sendTelegram(
                        `${emoji} ${label}\n\n🤖 Bot: ${global.config.BOTNAME || "Bot"}\n⏰ Time: ${_time}\n📋 Error type: ${errType}\n📝 Detail: ${errStr.slice(0, 600)}`,
                        tg.botToken, tg.chatId
                    );
                }
                if (global.config.autoRestartWhenListenMqttError === true) {
                    logger('Auto-restarting due to MQTT error...', '[ AutoRestart ]');
                    setTimeout(() => process.exit(1), 3000);
                }
                return;
            }
            if (!message || ['presence', 'typ', 'read_receipt'].some(data => data == message.type)) return;
            if (global.config.DeveloperMode == true) console.log(message);
            // ── Activity console log ──────────────────────────────────────────
            try {
                const _tz  = global.config.timeZone || 'Asia/Dhaka';
                const _ts  = new Date().toLocaleTimeString('en-US', { timeZone: _tz, hour12: false });
                if (message.type === 'message' || message.type === 'message_reply') {
                    const _body = (message.body || '').substring(0, 70);
                    const _tag  = message.type === 'message_reply' ? '\x1b[32mREPLY\x1b[0m' : '\x1b[36mMSG\x1b[0m';
                    console.log(`[\x1b[90m${_ts}\x1b[0m] ${_tag} | TID: ${message.threadID} | UID: ${message.senderID}${_body ? ' | ' + _body : ''}`);
                } else if (message.type === 'message_reaction') {
                    console.log(`[\x1b[90m${_ts}\x1b[0m] \x1b[35mREACT\x1b[0m | TID: ${message.threadID} | UID: ${message.senderID} | ${message.reaction || '(removed)'}`);
                } else if (message.type === 'message_unsend') {
                    console.log(`[\x1b[90m${_ts}\x1b[0m] \x1b[31mUNSEND\x1b[0m | TID: ${message.threadID} | UID: ${message.senderID}`);
                } else if (message.type === 'event') {
                    console.log(`[\x1b[90m${_ts}\x1b[0m] \x1b[33mEVENT\x1b[0m | TID: ${message.threadID} | ${message.logMessageType || message.type}`);
                }
            } catch (_) {}
            return listener(message);
        };
        global.handleListen = loginApiData.listenMqtt(listenerCallback);

        // ── Telegram startup notification ─────────────────────────────────────
        const tgNotify = global.config.telegramNotify || {};
        if (tgNotify.enable && tgNotify.botToken && tgNotify.chatId) {
            const _detectPlatform = () => {
                if (process.env.RENDER_EXTERNAL_URL)   return 'Render ☁️';
                if (process.env.RAILWAY_PUBLIC_DOMAIN) return 'Railway 🚂';
                if (process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS) return 'Replit 🌀';
                if (process.env.KOYEB_PUBLIC_DOMAIN)   return 'Koyeb 🟢';
                if (process.env.FLY_APP_NAME)          return 'Fly.io ✈️';
                if (process.env.HEROKU_APP_NAME)       return 'Heroku 💜';
                if (process.env.CYCLIC_APP_ID)         return 'Cyclic 🔁';
                return process.platform === 'win32' ? 'Windows 🪟' : process.platform === 'darwin' ? 'macOS 🍎' : 'Linux / VPS 🐧';
            };
            const _botUID    = loginApiData.getCurrentUserID ? String(loginApiData.getCurrentUserID()) : 'Unknown';
            const _prefix    = global.config.PREFIX || '/';
            const _tz        = global.config.timeZone || 'Asia/Dhaka';
            const _time      = new Date().toLocaleString('en-GB', { timeZone: _tz, hour12: false });
            const _platform  = _detectPlatform();
            const _botName   = global.config.BOTNAME || 'Bot';
            const _tgMsg     = `✅ "${_botName}" is now online!\n\n🤖 UID: ${_botUID}\n🔧 Prefix: ${_prefix}\n⏰ Time: ${_time}\n🌐 Platform: ${_platform}`;
            axios.get(`https://api.telegram.org/bot${tgNotify.botToken}/sendMessage`, {
                params: { chat_id: tgNotify.chatId, text: _tgMsg }
            }).catch(() => {});
            // ── Auto-configure uptime URL from platform env ───────────────────
            const _uptimeCfg = global.config.autoUptime || {};
            if (_uptimeCfg.enable && !_uptimeCfg.url) {
                const _autoUrl = process.env.RENDER_EXTERNAL_URL
                    || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null)
                    || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null)
                    || (process.env.KOYEB_PUBLIC_DOMAIN ? `https://${process.env.KOYEB_PUBLIC_DOMAIN}` : null)
                    || (process.env.FLY_APP_NAME ? `https://${process.env.FLY_APP_NAME}.fly.dev` : null)
                    || (process.env.HEROKU_APP_NAME ? `https://${process.env.HEROKU_APP_NAME}.herokuapp.com` : null);
                if (_autoUrl) {
                    global.config.autoUptime.url = _autoUrl;
                    logger(`Auto-detected uptime URL: ${_autoUrl}`, '[ Platform ]');
                }
            }
        }

        // ── Bot startup notification to threads / admin ───────────────────────
        const startupNoti = global.config.botStartupNotification || {};
        if (startupNoti.enable) {
            const startMsg = startupNoti.message || 'Bot is now online...!!';
            if (startupNoti.sendToThreads && startupNoti.sendToThreads.enable) {
                for (const tid of (startupNoti.sendToThreads.threadIds || [])) {
                    loginApiData.sendMessage(startMsg, tid, () => {});
                }
            }
            if (startupNoti.sendToAdmin && startupNoti.sendToAdmin.enable && startupNoti.sendToAdmin.adminId) {
                loginApiData.sendMessage(startMsg, startupNoti.sendToAdmin.adminId, () => {});
            }
        }

        // ── autoRefreshFbstate ────────────────────────────────────────────────
        if (global.config.autoRefreshFbstate) {
            setInterval(() => {
                try {
                    writeFileSync(appStateFile, JSON.stringify(loginApiData.getAppState(), null, '\t'));
                } catch (e) {}
            }, 10 * 60 * 1000);
        }

        // ── Live stats writer for admin panel ────────────────────────────────
        const STATS_FILE = join(__dirname, 'MAIN/bot-stats.json');
        const LOG_FILE   = join(__dirname, 'MAIN/bot-logs.json');

        // Log capture buffer
        const _logBuf = [];
        const _origLog = console.log, _origErr = console.error, _origWarn = console.warn;
        function _capture(level, args) {
            try {
                const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
                _logBuf.push({ t: Date.now(), level, msg });
                if (_logBuf.length > 400) _logBuf.shift();
            } catch(_) {}
        }
        console.log  = (...a) => { _origLog(...a);  _capture('info', a); };
        console.error= (...a) => { _origErr(...a);  _capture('error', a); };
        console.warn = (...a) => { _origWarn(...a); _capture('warn', a); };

        function writeBotStats() {
            try {
                // threads
                const threads = global.data && global.data.threadInfo
                    ? [...global.data.threadInfo.values()].slice(0, 200).map(t => ({
                        id: t.threadID,
                        name: t.name || 'Unknown',
                        count: t.userInfo ? t.userInfo.length : 0,
                      }))
                    : [];
                // banned
                const mapArr = m => m ? [...m.entries()].map(([id, r]) => ({ id, reason: r })) : [];
                const banned = {
                    userBanned:   mapArr(global.data && global.data.userBanned),
                    threadBanned: mapArr(global.data && global.data.threadBanned),
                    cmdBanned:    mapArr(global.data && global.data.commandBanned),
                };
                const stats = {
                    botStatus:   'Online',
                    timeStart:   global.client.timeStart || Date.now(),
                    threadCount: global.data ? (global.data.allThreadID || []).length : 0,
                    userCount:   global.data ? (global.data.allUserID   || []).length : 0,
                    updatedAt:   Date.now(),
                    threads,
                    banned,
                };
                writeFileSync(STATS_FILE, JSON.stringify(stats));
            } catch (_) {}
        }
        function writeLogs() {
            try { writeFileSync(LOG_FILE, JSON.stringify(_logBuf.slice(-200))); } catch(_) {}
        }
        writeBotStats();
        setInterval(writeBotStats, 10 * 1000);
        setInterval(writeLogs, 5 * 1000);

        // ── Platform auto-detection + autoUptime ─────────────────────────────
        const _getPlatform = () => {
            if (process.env.RENDER_EXTERNAL_URL)   return { name: 'Render ☁️',      url: process.env.RENDER_EXTERNAL_URL };
            if (process.env.RAILWAY_PUBLIC_DOMAIN) return { name: 'Railway 🚂',     url: `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` };
            if (process.env.REPLIT_DEV_DOMAIN)     return { name: 'Replit 🌀',      url: `https://${process.env.REPLIT_DEV_DOMAIN}` };
            if (process.env.REPLIT_DOMAINS)        return { name: 'Replit 🌀',      url: `https://${process.env.REPLIT_DOMAINS.split(',')[0].trim()}` };
            if (process.env.KOYEB_PUBLIC_DOMAIN)   return { name: 'Koyeb 🟢',       url: `https://${process.env.KOYEB_PUBLIC_DOMAIN}` };
            if (process.env.FLY_APP_NAME)          return { name: 'Fly.io ✈️',      url: `https://${process.env.FLY_APP_NAME}.fly.dev` };
            if (process.env.HEROKU_APP_NAME)       return { name: 'Heroku 💜',      url: `https://${process.env.HEROKU_APP_NAME}.herokuapp.com` };
            if (process.env.CYCLIC_APP_ID)         return { name: 'Cyclic 🔁',      url: null };
            return { name: process.platform === 'win32' ? 'Windows 🪟' : process.platform === 'darwin' ? 'macOS 🍎' : 'Linux / VPS 🐧', url: null };
        };
        global.client.platform = _getPlatform();
        logger(`Running on: ${global.client.platform.name}`, '[ Platform ]');

        const uptimeCfg = global.config.autoUptime || {};
        const _resolvedUrl = uptimeCfg.url || global.client.platform.url;
        if (uptimeCfg.enable && _resolvedUrl) {
            if (!uptimeCfg.url) {
                global.config.autoUptime = global.config.autoUptime || {};
                global.config.autoUptime.url = _resolvedUrl;
                logger(`Auto-ping URL set: ${_resolvedUrl}`, '[ Platform ]');
            }
            setInterval(() => {
                axios.get(_resolvedUrl).catch(() => {});
            }, (uptimeCfg.timeInterval || 180) * 1000);
        }

        // ── autoRestart at specific time ──────────────────────────────────────
        const autoRestartCfg = global.config.autoRestart || {};
        if (autoRestartCfg.time) {
            const [targetHour, targetMin] = String(autoRestartCfg.time).split(':').map(Number);
            setInterval(() => {
                const now = moment.tz(global.config.timeZone || 'Asia/Dhaka');
                if (now.hours() === targetHour && now.minutes() === targetMin) {
                    logger(`Auto restarting at ${autoRestartCfg.time}...`, '[ AutoRestart ]');
                    process.exit(1);
                }
            }, 60 * 1000);
        }

        // ── restartListenMqtt ─────────────────────────────────────────────────
        const restartMqttCfg = global.config.restartListenMqtt || {};
        if (restartMqttCfg.enable && restartMqttCfg.timeRestart) {
            setInterval(() => {
                if (restartMqttCfg.logNoti) logger('Restarting MQTT listener...', '[ MQTT ]');
                try { if (global.handleListen && global.handleListen.stopListening) global.handleListen.stopListening(); } catch (e) {}
                setTimeout(() => {
                    try {
                        global.handleListen = loginApiData.listenMqtt(listenerCallback);
                        if (restartMqttCfg.logNoti) logger('MQTT listener restarted!', '[ MQTT ]');
                    } catch (e) {
                        logger(`MQTT restart failed: ${e}`, '[ MQTT ]');
                    }
                }, restartMqttCfg.delayAfterStopListening || 2000);
            }, restartMqttCfg.timeRestart);
        }

        // ── 12AM Daily Top Users Report ───────────────────────────────────────
        let _midnightFired = false;
        setInterval(async () => {
            const _now = moment.tz(global.config.timeZone || 'Asia/Dhaka');
            const _h = _now.hours(), _m = _now.minutes();
            if (_h === 0 && _m === 0) {
                if (_midnightFired) return;
                _midnightFired = true;
                const _yesterday = _now.clone().subtract(1, 'day').format('YYYY-MM-DD');
                const _usage = (global.data.dailyUsage || {})[_yesterday];
                if (!_usage || Object.keys(_usage).length === 0) return;
                const _sorted = Object.entries(_usage).sort((a, b) => b[1] - a[1]).slice(0, 10);
                const _medals = ['🥇', '🥈', '🥉'];
                let _names = {};
                try {
                    const _uids = _sorted.map(([uid]) => uid);
                    _names = await new Promise((res, rej) =>
                        loginApiData.getUserInfo(_uids, (e, r) => e ? rej(e) : res(r || {}))
                    );
                } catch (e) {}
                const _date = _now.clone().subtract(1, 'day').format('DD MMM YYYY');
                let _msg = `🏆 𝗔𝗝𝗞𝗘𝗥 𝗧𝗢𝗣 𝗕𝗢𝗧 𝗨𝗦𝗘𝗥𝗦\n`;
                _msg += `━━━━━━━━━━━━━━━━━━━━\n`;
                _msg += `📅 তারিখ: ${_date}\n`;
                _msg += `━━━━━━━━━━━━━━━━━━━━\n`;
                for (let i = 0; i < _sorted.length; i++) {
                    const [uid, count] = _sorted[i];
                    const name = (_names[uid] && _names[uid].name) || `User ${uid}`;
                    const medal = _medals[i] || `${i + 1}.`;
                    _msg += `${medal} ${name}\n    └ ${count}টি command\n`;
                }
                _msg += `━━━━━━━━━━━━━━━━━━━━\n`;
                _msg += `🤖 ${global.config.BOTNAME || 'MOSTAKIM V2 BOT'}`;
                for (const tid of (global.data.allThreadID || [])) {
                    try { loginApiData.sendMessage(_msg, tid, () => {}); } catch (e) {}
                }
                if (global.data.dailyUsage) delete global.data.dailyUsage[_yesterday];
            } else {
                _midnightFired = false;
            }
        }, 60 * 1000);

        // ── bioUpdate ─────────────────────────────────────────────────────────
        const bioUpdateCfg = global.config.bioUpdate || {};
        if (bioUpdateCfg.enable && bioUpdateCfg.bioText) {
            try {
                loginApiData.setProfileInfo({ bio: bioUpdateCfg.bioText }, (err) => {
                    if (err && global.config.DeveloperMode) logger(`Bio update failed: ${err}`, 'warn');
                    else if (!err) logger('Bio updated successfully!', '[ BioUpdate ]');
                });
            } catch (e) {}
        }

        try {
            await checkBan(loginApiData);
        } catch (error) {
            return;
        };
        if (!global.checkBan) logger(global.getText('MOSTAKIM', 'warningSourceCode'), '[ GLOBAL BAN ]');
    });
}

//========= Connecting to Database =========//

(async () => {
    try {
        await sequelize.authenticate();
        const authentication = {};
        authentication.Sequelize = Sequelize;
        authentication.sequelize = sequelize;
        const models = require('./MAIN/database/model')(authentication);
        logger(global.getText('MOSTAKIM', 'successConnectDatabase'), '[ DATABASE ]');
        const botData = {};
        botData.models = models
        onBot(botData);
    } catch (error) { logger(`Database connection failed: ${JSON.stringify(error)}`, '[ DATABASE ]'); }
})();

process.on('unhandledRejection', (err, p) => {});
