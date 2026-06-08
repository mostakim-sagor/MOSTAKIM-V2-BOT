"use strict";

const moment = require("moment-timezone");

module.exports.config = {
    name:            "nightmode",
    version:         "1.1.0",
    hasPermssion:    3,
    credits:         "MOSTAKIM",
    description:     "Toggle night mode — bot only responds to admins from 1AM to 6AM",
    commandCategory: "admin",
    usages:          "nightmode [on | off | auto | status]",
    cooldowns:       5
};

module.exports.run = async function ({ api, event, args }) {
    const { threadID, messageID } = event;
    const out = (msg) => api.sendMessage(msg, threadID, messageID);

    const tz  = global.config.timeZone || "Asia/Dhaka";
    const now = moment().tz(tz).format("hh:mm A");

    if (!global.data.nightMode) global.data.nightMode = 'auto';

    const sub = (args[0] || "status").toLowerCase();

    if (sub === "on") {
        global.data.nightMode = 'on';
        return out(
            `[ NIGHT MODE ON ]\n` +
            `─────────────────\n` +
            `Night mode is now manually enabled.\n` +
            `Regular users cannot use any commands.\n` +
            `Only admins can use the bot.\n\n` +
            `Time: ${now}\n\n` +
            `To disable: /nightmode off\n` +
            `Auto mode : /nightmode auto`
        );
    }

    if (sub === "off") {
        global.data.nightMode = 'off';
        return out(
            `[ NIGHT MODE OFF ]\n` +
            `─────────────────\n` +
            `Night mode is now disabled.\n` +
            `All users can use the bot normally.\n\n` +
            `Time: ${now}\n\n` +
            `To enable: /nightmode on\n` +
            `Auto mode: /nightmode auto`
        );
    }

    if (sub === "auto") {
        global.data.nightMode = 'auto';
        return out(
            `[ NIGHT MODE AUTO ]\n` +
            `─────────────────\n` +
            `Auto mode activated.\n\n` +
            `1:00 AM - 6:00 AM:\n` +
            `  Bot only replies to admins.\n\n` +
            `6:00 AM - 1:00 AM:\n` +
            `  All users can use the bot.\n\n` +
            `Current time: ${now}`
        );
    }

    const currentState = global.data.nightMode || 'auto';
    const stateLabel   = currentState === 'on'  ? 'Manual ON  (always restricted)' :
                         currentState === 'off' ? 'Manual OFF (always open)'       :
                                                  'Auto (1AM - 6AM restricted)';

    const _hour    = moment().tz(tz).hour();
    const _isNight = currentState === 'on' ? true :
                     currentState === 'off' ? false :
                     (_hour >= 1 && _hour < 6);

    return out(
        `[ NIGHT MODE STATUS ]\n` +
        `─────────────────────\n` +
        `Mode    : ${stateLabel}\n` +
        `State   : ${_isNight ? 'ACTIVE (night mode on)' : 'INACTIVE (normal mode)'}\n` +
        `Time    : ${now}\n` +
        `─────────────────────\n` +
        `/nightmode on     — always night mode\n` +
        `/nightmode off    — disable night mode\n` +
        `/nightmode auto   — time-based (1AM-6AM)\n` +
        `/nightmode status — this message`
    );
};
