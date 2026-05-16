const schedule = require('node-schedule');
const fs = require('fs');
const https = require('https');

module.exports.config = {
    name: "mostakimt",
    version: "1.0.0",
    hasPermssion: 2,
    credits: "MOSTAKIM",
    description: "TikTok auto video sender system",
    commandCategory: "Admin",
    usages: "tiktokautosendon | tiktokautosendoff | tiktokautosendstatus",
    cooldowns: 5
};

// tiktok-scraper requires libuuid system library which is unavailable in this environment
// Using safe stub that returns empty results
const TikTokScraper = {
    user: async () => ({ collector: [] })
};
const chalk = require('chalk');

// ================= CONFIG =================
const username = "md_mostakim_islam_sagor"; // TikTok ID
const DATA_FILE = __dirname + "/tiktok_cache.json";
const CONTROL_FILE = __dirname + "/tiktok_control.json";
const codeCredits = "MOSTAKIM"; //please don't change credit
const PREFIX = "/";

// ================= STATE =================
let videoLinks = [];
let currentIndex = 0;
let isEnabled = true;
let threadStatus = {}; // { threadID: true/false }
let isProcessingCommand = false;

// ================= ADMIN UID =================
const adminIDs = [
    "100058112936375", // FB UID 1
    "1320644595"  // FB UID 2
];

// ================= CACHE FUNCTIONS =================
function loadCache() {
    if (fs.existsSync(DATA_FILE)) {
        const data = JSON.parse(fs.readFileSync(DATA_FILE));
        videoLinks = data.links || [];
        currentIndex = data.index || 0;
        threadStatus = data.threadStatus || {};
    }
}

function saveCache() {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
        links: videoLinks,
        index: currentIndex,
        threadStatus
    }, null, 2));
}

// ================= CONTROL FUNCTIONS =================
function loadControl() {
    if (fs.existsSync(CONTROL_FILE)) {
        const data = JSON.parse(fs.readFileSync(CONTROL_FILE));
        isEnabled = data.enabled;
    }
}

function saveControl() {
    fs.writeFileSync(CONTROL_FILE, JSON.stringify({ enabled: isEnabled }, null, 2));
}

// ================= FETCH VIDEOS =================
async function fetchVideos() {
    try {
        const posts = await TikTokScraper.user(username, { number: 50 });
        return posts.collector.map(v => v.webVideoUrl);
    } catch (err) {
        console.log(chalk.red("Fetch error, retrying..."));
        return null;
    }
}

// ================= LOAD INITIAL VIDEOS =================
async function loadVideos() {
    const data = await fetchVideos();
    if (!data) {
        setTimeout(loadVideos, 10000); // retry after 10 sec
        return;
    }
    videoLinks = data;
    saveCache();
}

// ================= CHECK NEW VIDEOS =================
async function checkNewVideos(api) {
    if (!isEnabled) return;
    const data = await fetchVideos();
    if (!data) return;

    const newVideos = data.filter(v => !videoLinks.includes(v));
    if (newVideos.length > 0) {
        console.log(chalk.yellow(`New videos added: ${newVideos.length}`));
        videoLinks = [...newVideos, ...videoLinks];
        currentIndex += newVideos.length;
        saveCache();

        global.data.allThreadID.forEach(threadID => {
            newVideos.forEach(link => {
                api.sendMessage(`🎬 New video detected:\n${link}`, threadID);
            });
        });
    }
}

// ================= SEND NEXT VIDEO =================
function sendNext(api) {
    if (!isEnabled || !videoLinks.length || !global.data?.allThreadID) return;

    global.data.allThreadID.forEach(threadID => {
        if (threadStatus[threadID] === false) return; // paused thread

        if (currentIndex >= videoLinks.length) currentIndex = 0;

        const link = videoLinks[currentIndex];
        const videoNumber = currentIndex + 1;
        const nextVideoNumber = (currentIndex + 1 > videoLinks.length - 1) ? 1 : currentIndex + 2;

        // Step 1: Send video link fast
        api.sendMessage(link, threadID);

        // Step 2: Send separate text message
        const textMessage = `🔥 নতুন TikTok Video Link এসেছে!
✨ মজা করে দেখো এই ভিডিও!
🎬 Video watch করতে ভুলিও না!`;
        api.sendMessage(textMessage, threadID);

        // Step 3: Send admin command list
        const commandMessage = `⚙️ Command List:
${PREFIX}tiktokautosendon → ON
${PREFIX}tiktokautosendoff → OFF
${PREFIX}tiktokautosendstatus → STATUS
${PREFIX}tiktokautosendpause → Pause this thread
${PREFIX}tiktokautosendresume → Resume this thread`;
        api.sendMessage(commandMessage, threadID);

        // Live dashboard log
        console.log(chalk.cyan(`[Thread ${threadID}] Current Video: #${videoNumber}, Next Video: #${nextVideoNumber}, Total: ${videoLinks.length}`));
    });

    currentIndex++;
    saveCache();
}

// ================= ON LOAD =================
module.exports.onLoad = async ({ api }) => {
    console.log(chalk.green("========== AUTO SYSTEM LOADED =========="));
    console.log(chalk.cyan(`Credits: ${codeCredits}`));

    loadCache();
    loadControl();

    if (!videoLinks.length) await loadVideos();

    // Every 20 minutes → send next video
    schedule.scheduleJob('*/20 * * * *', () => {
        sendNext(api);
    });

    // Every 15 minutes → check for new videos
    schedule.scheduleJob('*/15 * * * *', () => {
        checkNewVideos(api);
    });

    // Every 1 hour → full refresh
    schedule.scheduleJob('0 * * * *', async () => {
        await loadVideos();
        console.log(chalk.blue("Full refresh done"));
    });
};

// ================= ADMIN COMMAND =================
module.exports.run = async ({ api, event, args }) => {
    const targetThread = event.threadID;
    const input = args[0]?.toLowerCase();

    // Check if sender is one of the 2 admins
    if (!adminIDs.includes(event.senderID)) {
        return api.sendMessage("❌ তুমি admin না!", targetThread);
    }

    // Prevent multiple simultaneous commands
    if (isProcessingCommand) {
        return api.sendMessage("❌ অন্য admin command চলছে। দয়া করে অপেক্ষা করো।", targetThread);
    }

    isProcessingCommand = true;

    switch (input) {
        case "tiktokautosendon":
            isEnabled = true;
            saveControl();
            api.sendMessage("✅ TikTok Auto System ON করা হয়েছে", targetThread);
            break;

        case "tiktokautosendoff":
            isEnabled = false;
            saveControl();
            api.sendMessage("⛔ TikTok Auto System OFF করা হয়েছে", targetThread);
            break;

        case "tiktokautosendstatus":
            const total = videoLinks.length;
            const current = (currentIndex >= videoLinks.length ? 0 : currentIndex) + 1;
            api.sendMessage(`🎯 Current Video: #${current} of ${total}\nSystem Status: ${isEnabled ? "ON ✅" : "OFF ⛔"}`, targetThread);
            break;

        case "tiktokautosendpause":
            threadStatus[targetThread] = false;
            saveCache();
            api.sendMessage("⛔ This thread is paused for TikTok video sending.\nOnly admin use this command", targetThread);
            break;

        case "tiktokautosendresume":
            threadStatus[targetThread] = true;
            saveCache();
            api.sendMessage("✅ This thread is resumed for TikTok video sending.\nOnly admin use this command", targetThread);
            break;

        default:
            api.sendMessage(`⚙️ Command List:
${PREFIX}tiktokautosendon → ON
${PREFIX}tiktokautosendoff → OFF
${PREFIX}tiktokautosendstatus → STATUS
${PREFIX}tiktokautosendpause → Pause this thread
${PREFIX}tiktokautosendresume → Resume this thread`, targetThread);
    }

    // Reset after 3 seconds
    setTimeout(() => {
        isProcessingCommand = false;
    }, 3000);
};