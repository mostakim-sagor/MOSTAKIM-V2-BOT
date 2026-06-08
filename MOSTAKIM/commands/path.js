const axios = require("axios");

// Get GitHub repo info from package.json
function getGithubInfo() {
        try {
                const pkg     = require("../../package.json");
                const repoUrl = pkg?.repository?.url || "";
                // Match github.com/owner/repo with any suffix (/.git, /issues, /tree/..., etc.)
                const match   = repoUrl.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git|\/.*)?$/i);
                if (match) return { owner: match[1], repo: match[2] };
        } catch (_) {}
        return null;
}

// Fetch folder contents from GitHub API
async function getContents(owner, repo, folderPath = "", branch = "main") {
        const url = `https://api.github.com/repos/${owner}/${repo}/contents/${folderPath}?ref=${branch}`;
        const { data } = await axios.get(url, {
                headers: { "User-Agent": "MOSTAKIM-BOT" },
                timeout: 10000
        });
        return data;
}

// Build tree string recursively (max depth 3)
async function buildTree(owner, repo, folderPath = "", prefix = "", depth = 0, branch = "main") {
        if (depth > 3) return "";
        let result = "";
        let items;
        try {
                items = await getContents(owner, repo, folderPath, branch);
        } catch (_) {
                return "";
        }

        // Sort: folders first, then files
        items.sort((a, b) => {
                if (a.type === b.type) return a.name.localeCompare(b.name);
                return a.type === "dir" ? -1 : 1;
        });

        // Skip heavy/irrelevant folders
        const SKIP = ["node_modules", ".git", ".github", "database", "languages"];

        for (let i = 0; i < items.length; i++) {
                const item     = items[i];
                const isLast   = i === items.length - 1;
                const branch_  = isLast ? "└─" : "├─";
                const childPfx = isLast ? "   " : "│  ";

                if (SKIP.includes(item.name)) {
                        result += `${prefix}${branch_} 📁 ${item.name}/ (skipped)\n`;
                        continue;
                }

                if (item.type === "dir") {
                        result += `${prefix}${branch_} 📁 ${item.name}/\n`;
                        if (depth < 3) {
                                result += await buildTree(owner, repo, item.path, prefix + childPfx, depth + 1, branch);
                        }
                } else {
                        const ext  = item.name.split(".").pop().toLowerCase();
                        const icon = ext === "js"   ? "📜"
                                   : ext === "json" ? "🗂️"
                                   : ext === "md"   ? "📝"
                                   : ext === "txt"  ? "📄"
                                   : "📌";
                        result += `${prefix}${branch_} ${icon} ${item.name}\n`;
                }
        }
        return result;
}

module.exports = {
        config: {
                name:             "path",
                aliases:          ["tree", "files", "structure"],
                version:          "1.0.0",
                author:           "MOSTAKIM",
                countDown:        10,
                role:             2,
                shortDescription: "Show GitHub repo file structure",
                longDescription:  "Fetches and displays the full file/folder tree of your GitHub repo directly in Messenger.",
                category:         "owner",
                guide:
                        "{pn}               - Show full file tree\n" +
                        "{pn} commands      - Show MOSTAKIM/commands/\n" +
                        "{pn} events        - Show MOSTAKIM/events/\n" +
                        "{pn} includes      - Show includes/\n" +
                        "{pn} bot           - Show bot/ folder\n" +
                        "{pn} <folder>      - Show any specific folder"
        },

        run: async ({ api, event, args }) => {
                const { threadID, messageID } = event;

                const ghInfo = getGithubInfo();
                if (!ghInfo) {
                        return api.sendMessage(
                                `❌ GitHub repo not found!\n\nAdd this to package.json:\n"repository": {\n  "url": "https://github.com/USERNAME/REPO.git"\n}`,
                                threadID, messageID
                        );
                }

                const { owner, repo } = ghInfo;

                // Short aliases → actual folder paths
                const FOLDER_MAP = {
                        commands : "MOSTAKIM/commands",
                        events   : "MOSTAKIM/events",
                        includes : "includes",
                        bot      : "bot",
                        utils    : "utils",
                        mostakim : "MOSTAKIM",
                };

                const input  = (args[0] || "").toLowerCase();
                const folder = FOLDER_MAP[input] || args[0] || "";
                const label  = folder || "(root)";
                const branch = args[1] || "main";

                api.sendMessage(
                        `⏳ Fetching file tree from GitHub...\n📁 Path: ${label}\n🌿 Branch: ${branch}`,
                        threadID, messageID
                );

                let tree;
                try {
                        tree = await buildTree(owner, repo, folder, "", 0, branch);
                } catch (e) {
                        return api.sendMessage(
                                `❌ Failed to fetch from GitHub!\n\nError: ${e.response?.status === 404
                                        ? `Folder "${label}" not found in repo`
                                        : e.message}\n\nRepo: github.com/${owner}/${repo}`,
                                threadID, messageID
                        );
                }

                if (!tree.trim()) {
                        return api.sendMessage(
                                `⚠️ Folder is empty or not found.\n\nPath  : ${label}\nRepo  : github.com/${owner}/${repo}`,
                                threadID, messageID
                        );
                }

                // Count stats
                const totalFiles   = (tree.match(/📜|🗂️|📝|📄|📌/g) || []).length;
                const totalFolders = (tree.match(/📁/g) || []).length;

                const header =
                        `📂 FILE STRUCTURE\n` +
                        `${"─".repeat(30)}\n` +
                        `🔗 Repo   : github.com/${owner}/${repo}\n` +
                        `📁 Path   : ${label}\n` +
                        `🌿 Branch : ${branch}\n` +
                        `📊 Files  : ${totalFiles} | Folders: ${totalFolders}\n` +
                        `${"─".repeat(30)}\n`;

                const full  = header + tree;
                const LIMIT = 1800;

                if (full.length <= LIMIT) {
                        return api.sendMessage(full, threadID, messageID);
                }

                // Too long — send in multiple parts
                const lines = full.split("\n");
                let chunk   = "";
                let part    = 1;

                for (const line of lines) {
                        if ((chunk + line + "\n").length > LIMIT) {
                                await new Promise(r =>
                                        api.sendMessage(`📄 Part ${part}:\n${chunk}`, threadID, r, messageID)
                                );
                                chunk = "";
                                part++;
                        }
                        chunk += line + "\n";
                }

                if (chunk.trim()) {
                        api.sendMessage(`📄 Part ${part}:\n${chunk}`, threadID, messageID);
                }
        }
};