module.exports = function ({ api, models, Users, Threads, Currencies }) {
    const logger = require("../../utils/log.js");
    return function ({ event }) {
        const { allowInbox } = global.config;
        const { userBanned, threadBanned } = global.data;
        const { commands, eventRegistered } = global.client;
        var { senderID, threadID } = event;
        senderID = String(senderID);
        threadID = String(threadID);
        if (userBanned.has(senderID) || threadBanned.has(threadID) || (allowInbox == false && senderID == threadID)) return;

        // ── Night Mode ────────────────────────────────────────────────────────
        const _ADMINBOT2   = global.config.ADMINBOT   || [];
        const _SUPERADMIN2 = global.config.SUPERADMIN || [];
        const _DEV2        = global.config.DEV        || [];
        const _isPriv2     = _ADMINBOT2.includes(senderID) || _SUPERADMIN2.includes(senderID) || _DEV2.includes(senderID);
        if (!_isPriv2) {
            const _nmState = global.data.nightMode || 'auto';
            let _isNight = false;
            if (_nmState === 'on') {
                _isNight = true;
            } else if (_nmState === 'auto') {
                const moment = require('moment-timezone');
                const _h = moment.tz(global.config.timeZone || "Asia/Dhaka").hour();
                _isNight = (_h >= 1 && _h < 6);
            }
            if (_isNight) return;
        }
        for (const eventReg of eventRegistered) {
            const cmd = commands.get(eventReg);
            var getText2;

            if (cmd.languages && typeof cmd.languages == 'object') {
                getText2 = (...values) => {
                    const commandModule = cmd.languages || {};
                    if (!commandModule.hasOwnProperty(global.config.language)) 
                        return api.sendMessage(global.getText('handleCommand','notFoundLanguage', cmd.config.name), threadID); 
                    var lang = cmd.languages[global.config.language][values[0]] || '';
                    for (var i = values.length - 1; i >= 0; i--) {
                        const expReg = RegExp('%' + (i + 1), 'g');
                        lang = lang.replace(expReg, values[i]);
                    }
                    return lang;
                };
            } else {
                getText2 = () => {};
            }

            try {
                const Obj = {};
                Obj.event = event;
                Obj.api = api;
                Obj.models = models;
                Obj.Users = Users;
                Obj.Threads = Threads;
                Obj.Currencies = Currencies;
                Obj.getText = getText2;
                if (cmd) cmd.handleEvent(Obj);
            } catch (error) {
                logger(global.getText('handleCommandEvent', 'moduleError', cmd.config.name), 'error');
            }
        }
    };
};
