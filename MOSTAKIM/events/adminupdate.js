module.exports.config = {
name: "adminUpdate",
eventType: ["log:thread-admins","log:thread-name", "log:user-nickname","log:thread-icon","log:thread-call","log:thread-color"],
version: "1.0.1",
credits: "𝗜𝘀𝗹𝗮𝗺𝗶𝗰𝗸 𝗰𝗵𝗮𝘁 𝗯𝗼𝘁",
description: "Update team information quickly",
envConfig: {
sendNoti: true,
}
};

const _adminUpdateConfigName = module.exports.config.name;

module.exports.run = async function ({ event, api, Threads, Users }) {
const fs = require("fs");
const configName = _adminUpdateConfigName;
var iconPath = __dirname + "/emoji.json";
if (!fs.existsSync(iconPath)) fs.writeFileSync(iconPath, JSON.stringify({}));
const { threadID, logMessageType, logMessageData } = event;
const { setData, getData } = Threads;

const thread = global.data.threadData.get(threadID) || {};
if (typeof thread["adminUpdate"] != "undefined" && thread["adminUpdate"] == false) return;

const cfg = (global.configModule && global.configModule[configName]) || {};

try {
    let dataThread = (await getData(threadID)).threadInfo;
    switch (logMessageType) {
        case "log:thread-admins": {
            if (logMessageData.ADMIN_EVENT == "add_admin") {
                dataThread.adminIDs.push({ id: logMessageData.TARGET_ID });
                if (cfg.sendNoti) api.sendMessage(`[ GROUP UPDATE ]\n✅ User ${logMessageData.TARGET_ID} has been promoted to Admin!`, threadID, async (error, info) => {
                    if (cfg.autoUnsend) {
                        await new Promise(resolve => setTimeout(resolve, cfg.timeToUnsend * 1000));
                        return api.unsendMessage(info.messageID);
                    }
                });
            }
            else if (logMessageData.ADMIN_EVENT == "remove_admin") {
                dataThread.adminIDs = dataThread.adminIDs.filter(item => item.id != logMessageData.TARGET_ID);
                if (cfg.sendNoti) api.sendMessage(`[ GROUP UPDATE ]\n❌ User ${logMessageData.TARGET_ID} has been removed from Admin.`, threadID, async (error, info) => {
                    if (cfg.autoUnsend) {
                        await new Promise(resolve => setTimeout(resolve, cfg.timeToUnsend * 1000));
                        return api.unsendMessage(info.messageID);
                    }
                });
            }
            break;
        }

        case "log:thread-icon": {
            let preIcon = JSON.parse(fs.readFileSync(iconPath));
            dataThread.threadIcon = event.logMessageData.thread_icon || "👍";
            if (cfg.sendNoti) api.sendMessage(`» [ GROUP UPDATE ] ${event.logMessageBody ? event.logMessageBody.replace("emoji", "icon") : "icon updated"}\n» Original icon: ${preIcon[threadID] || "unknown"}`, threadID, async (error, info) => {
                preIcon[threadID] = dataThread.threadIcon;
                fs.writeFileSync(iconPath, JSON.stringify(preIcon));
                if (cfg.autoUnsend) {
                    await new Promise(resolve => setTimeout(resolve, cfg.timeToUnsend * 1000));
                    return api.unsendMessage(info.messageID);
                }
            });
            break;
        }

        case "log:thread-call": {
            if (logMessageData.event === "group_call_started") {
                const name = await Users.getNameUser(logMessageData.caller_id);
                api.sendMessage(`[ GROUP UPDATE ]\n❯ ${name} STARTED A ${(logMessageData.video) ? 'VIDEO ' : ''}CALL.`, threadID);
            } else if (logMessageData.event === "group_call_ended") {
                const callDuration = logMessageData.call_duration;
                const hours = Math.floor(callDuration / 3600);
                const minutes = Math.floor((callDuration - (hours * 3600)) / 60);
                const seconds = callDuration - (hours * 3600) - (minutes * 60);
                const timeFormat = `${hours}:${minutes}:${seconds}`;
                api.sendMessage(`[ GROUP UPDATE ]\n❯ ${(logMessageData.video) ? 'Video' : ''} call has ended.\n❯ Call duration: ${timeFormat}`, threadID);
            } else if (logMessageData.joining_user) {
                const name = await Users.getNameUser(logMessageData.joining_user);
                api.sendMessage(`❯ [ GROUP UPDATE ]\n❯ ${name} Joined the ${(logMessageData.group_call_type == '1') ? 'Video' : ''} call.`, threadID);
            }
            break;
        }

        case "log:thread-color": {
            dataThread.threadColor = event.logMessageData.thread_color || "🌤";
            if (cfg.sendNoti) api.sendMessage(`» [ GROUP UPDATE ]\n» ${event.logMessageBody.replace("Theme", "color")}`, threadID, async (error, info) => {
                if (cfg.autoUnsend) {
                    await new Promise(resolve => setTimeout(resolve, cfg.timeToUnsend * 1000));
                    return api.unsendMessage(info.messageID);
                }
            });
            break;
        }

        case "log:user-nickname": {
            dataThread.nicknames[logMessageData.participant_id] = logMessageData.nickname;
            if (typeof global.configModule["nickname"] != "undefined" && !global.configModule["nickname"].allowChange.includes(threadID) && !dataThread.adminIDs.some(item => item.id == event.author) || event.author == api.getCurrentUserID()) return;
            if (cfg.sendNoti) api.sendMessage(`»» NOTICE «« Update user nicknames ${logMessageData.participant_id} to: ${(logMessageData.nickname.length == 0) ? "original name" : logMessageData.nickname}`, threadID, async (error, info) => {
                if (cfg.autoUnsend) {
                    await new Promise(resolve => setTimeout(resolve, cfg.timeToUnsend * 1000));
                    return api.unsendMessage(info.messageID);
                }
            });
            break;
        }

        case "log:thread-name": {
            dataThread.threadName = event.logMessageData.name || "No name";
            if (cfg.sendNoti) api.sendMessage(`»» NOTICE «« Update the group name to ${dataThread.threadName}`, threadID, async (error, info) => {
                if (cfg.autoUnsend) {
                    await new Promise(resolve => setTimeout(resolve, cfg.timeToUnsend * 1000));
                    return api.unsendMessage(info.messageID);
                }
            });
            break;
        }
    }
    await setData(threadID, { threadInfo: dataThread });
} catch (e) { console.log(e) }

}

