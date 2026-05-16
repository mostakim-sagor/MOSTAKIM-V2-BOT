const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const { execFile } = require("child_process");

const YT_DLP = "/home/runner/workspace/.pythonlibs/bin/yt-dlp";
const CACHE_DIR = path.join(__dirname, "cache");
const MAX_FILE_MB = 50;

// ================= PLATFORM PATTERNS =================
const PATTERNS = {
    youtube:   /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
    tiktok:    /tiktok\.com\/@[\w.]+\/video\/\d+|vm\.tiktok\.com\/\w+|vt\.tiktok\.com\/\w+/,
    facebook:  /facebook\.com\/.+\/videos\/|fb\.watch\/|facebook\.com\/watch|facebook\.com\/reel/,
    instagram: /instagram\.com\/(?:p|reel|tv|stories)\/[A-Za-z0-9_-]+/,
    twitter:   /(?:twitter\.com|x\.com)\/\w+\/status\/\d+/,
};

const PLATFORM_LABELS = {
    youtube: "YouTube",
    tiktok: "TikTok",
    facebook: "Facebook",
    instagram: "Instagram",
    twitter: "Twitter / X",
};

// ================= DETECT PLATFORM =================
function detectPlatform(text) {
    const urlMatch = text.match(/https?:\/\/[^\s<>"]+/);
    if (!urlMatch) return null;
    const url = urlMatch[0];
    for (const [platform, pattern] of Object.entries(PATTERNS)) {
        if (pattern.test(url)) return { platform, url };
    }
    return null;
}

// ================= GET INFO VIA YT-DLP (no download) =================
function getYtDlpInfo(url) {
    return new Promise((resolve) => {
        const args = [
            "--print", "%(title)s|||%(duration_string)s",
            "--skip-download",
            "--no-playlist",
            "--quiet",
            "--no-warnings",
            url
        ];
        let output = "";
        const proc = execFile(YT_DLP, args, { timeout: 30000 });
        proc.stdout.on("data", (d) => { output += d.toString(); });
        proc.on("close", () => {
            const parts = output.trim().split("|||");
            resolve({ title: parts[0] || "Video", duration: parts[1] || "" });
        });
        proc.on("error", () => resolve({ title: "Video", duration: "" }));
    });
}

// ================= DOWNLOAD VIA YT-DLP =================
function runYtDlp(url, outputPath) {
    return new Promise((resolve, reject) => {
        const args = [
            "-f", `bestvideo[ext=mp4][filesize<${MAX_FILE_MB}M]+bestaudio[ext=m4a]/best[ext=mp4][filesize<${MAX_FILE_MB}M]/best[filesize<${MAX_FILE_MB}M]/best`,
            "--merge-output-format", "mp4",
            "-o", outputPath,
            "--no-playlist",
            "--quiet",
            "--no-warnings",
            "--no-part",
            url
        ];
        execFile(YT_DLP, args, { timeout: 120000 }, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

// ================= TIKTOK VIA TIKWM =================
async function downloadTikTok(url, outputPath) {
    const res = await axios.post(
        "https://www.tikwm.com/api/",
        "url=" + encodeURIComponent(url) + "&hd=1",
        {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            },
            timeout: 20000
        }
    );

    const data = res.data;
    if (data.code !== 0 || !data.data) throw new Error(data.msg || "TikTok API failed");

    const videoUrl = data.data.hdplay || data.data.play;
    if (!videoUrl) throw new Error("No video URL found");

    const title = data.data.title || "TikTok Video";

    const videoRes = await axios.get(videoUrl, { responseType: "arraybuffer", timeout: 60000 });
    fs.writeFileSync(outputPath, Buffer.from(videoRes.data));

    return { title, duration: "" };
}

// ================= MAIN DOWNLOAD =================
async function processDownload(url, platform, threadID, messageID, api) {
    const filename = `autodl_${Date.now()}.mp4`;
    const outputPath = path.join(CACHE_DIR, filename);

    api.setMessageReaction("⏳", messageID, () => {}, true);

    try {
        let info;

        if (platform === "tiktok") {
            info = await downloadTikTok(url, outputPath);
        } else {
            const [fetchedInfo] = await Promise.all([
                getYtDlpInfo(url),
                runYtDlp(url, outputPath)
            ]);
            info = fetchedInfo;
        }

        if (!fs.existsSync(outputPath)) throw new Error("Downloaded file not found");

        const fileSizeMB = fs.statSync(outputPath).size / (1024 * 1024);
        if (fileSizeMB > MAX_FILE_MB) {
            fs.unlinkSync(outputPath);
            throw new Error(`Video too large (${fileSizeMB.toFixed(1)}MB). Max is ${MAX_FILE_MB}MB.`);
        }

        const label = PLATFORM_LABELS[platform];
        const body = `📥 𝗔𝘂𝘁𝗼 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱𝗲𝗿\n` +
                     `🌐 ${label}\n` +
                     `🎬 ${info.title}` +
                     (info.duration ? `\n⏱️ ${info.duration}` : "") +
                     `\n📦 ${fileSizeMB.toFixed(1)} MB\n` +
                     `⚡ 𝗕𝘆 𝗠𝗢𝗦𝗧𝗔𝗞𝗜𝗠 𝗩𝟮 𝗕𝗢𝗧`;

        await api.sendMessage(
            { body, attachment: fs.createReadStream(outputPath) },
            threadID,
            () => { try { fs.unlinkSync(outputPath); } catch (_) {} },
            messageID
        );

        api.setMessageReaction("✅", messageID, () => {}, true);

    } catch (err) {
        try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch (_) {}
        api.setMessageReaction("❌", messageID, () => {}, true);
        api.sendMessage(
            `❌ ডাউনলোড ব্যর্থ হয়েছে!\n📌 Platform: ${PLATFORM_LABELS[platform]}\n⚠️ ${err.message}`,
            threadID,
            messageID
        );
    }
}

// ================= CONFIG =================
module.exports.config = {
    name: "autodl",
    version: "2.0.0",
    hasPermssion: 0,
    credits: "MOSTAKIM",
    description: "যেকোনো platform-এর video link পাঠালে auto download করে দেয়",
    commandCategory: "media",
    usages: "/autodl <link> অথবা শুধু link paste করো",
    cooldowns: 10,
};

// ================= MANUAL COMMAND =================
module.exports.run = async ({ api, event, args }) => {
    const { threadID, messageID } = event;
    const link = args[0];

    if (!link) {
        return api.sendMessage(
            `📎 𝗔𝘂𝘁𝗼 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱𝗲𝗿\n\n` +
            `✅ Supported Platforms:\n` +
            `▶️ YouTube (shorts সহ)\n` +
            `🎵 TikTok\n` +
            `📘 Facebook\n` +
            `📸 Instagram\n` +
            `🐦 Twitter / X\n\n` +
            `📌 Usage: /autodl <link>\n` +
            `💡 অথবা শুধু link পাঠালেই auto download হবে!`,
            threadID,
            messageID
        );
    }

    const detected = detectPlatform(link);
    if (!detected) {
        return api.sendMessage(
            `❌ Unsupported link!\n\n✅ Supported: YouTube, TikTok, Facebook, Instagram, Twitter/X`,
            threadID,
            messageID
        );
    }

    await processDownload(detected.url, detected.platform, threadID, messageID, api);
};

// ================= AUTO EVENT (link paste করলেই download) =================
module.exports.handleEvent = async ({ api, event }) => {
    if (event.type !== "message") return;
    const body = event.body || "";
    if (!body.startsWith("https://") && !body.includes("https://")) return;

    const detected = detectPlatform(body);
    if (!detected) return;

    await processDownload(detected.url, detected.platform, event.threadID, event.messageID, api);
};
