const express = require('express');
const path = require('path');
const fs = require('fs');
const { execSync, spawn } = require('child_process');
const { login, requireAuth, requireAdmin, changePassword, getCredentials } = require('./auth');

const router = express.Router();

const ROOT = path.join(__dirname, '../../');
const APPSTATE_PATH = path.join(ROOT, 'appstate.json');
const CONFIG_PATH = path.join(ROOT, 'config.json');
const CMDS_PATH = path.join(ROOT, 'MOSTAKIM/commands');
const EVENTS_PATH = path.join(ROOT, 'MOSTAKIM/events');
const BOT_STATS_PATH = path.join(ROOT, 'MAIN/bot-stats.json');
const BOT_LOGS_PATH  = path.join(ROOT, 'MAIN/bot-logs.json');

function getLiveBotStats() {
    try { return JSON.parse(fs.readFileSync(BOT_STATS_PATH, 'utf-8')); }
    catch { return null; }
}
function getLiveLogs() {
    try { return JSON.parse(fs.readFileSync(BOT_LOGS_PATH, 'utf-8')); }
    catch { return []; }
}

function safeReadJson(filePath) {
    try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); }
    catch { return null; }
}

function getCommands() {
    const files = fs.readdirSync(CMDS_PATH).filter(f => f.endsWith('.js'));
    const list = [];
    for (const file of files) {
        try {
            delete require.cache[require.resolve(path.join(CMDS_PATH, file))];
            const mod = require(path.join(CMDS_PATH, file));
            if (mod.config) {
                list.push({
                    name: mod.config.name || file.replace('.js',''),
                    description: mod.config.description || '',
                    category: mod.config.commandCategory || mod.config.category || 'Uncategorized',
                    usage: mod.config.usages || '',
                    permission: mod.config.hasPermssion || 0,
                    cooldown: mod.config.cooldowns || 0,
                    credits: mod.config.credits || '',
                    version: mod.config.version || '1.0',
                });
            }
        } catch {}
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
}

function getUptime() {
    const live = getLiveBotStats();
    const start = live && live.timeStart;
    if (!start) return '0h 0m 0s';
    const diff = Date.now() - start;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${h}h ${m}m ${s}s`;
}

function getStats() {
    const cmds = fs.readdirSync(CMDS_PATH).filter(f => f.endsWith('.js')).length;
    const evts = fs.readdirSync(EVENTS_PATH).filter(f => f.endsWith('.js')).length;
    const cfg = safeReadJson(CONFIG_PATH) || {};
    const live = getLiveBotStats();
    const isOnline = live && live.botStatus === 'Online' && live.updatedAt && (Date.now() - live.updatedAt) < 30000;
    return {
        botName: cfg.BOTNAME || 'MOSTAKIM V2 BOT',
        prefix: cfg.PREFIX || '/',
        uptime: getUptime(),
        commandCount: cmds,
        eventCount: evts,
        threadCount: live ? (live.threadCount || 0) : 0,
        userCount: live ? (live.userCount || 0) : 0,
        platform: 'Replit',
        nodeVersion: process.version,
        memUsage: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2) + ' MB',
        botStatus: isOnline ? 'Online ✅' : 'Offline ❌',
        restartCount: global.countRestart || 0,
    };
}

router.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
    const result = login(username, password);
    if (!result) return res.status(401).json({ error: 'Invalid username or password' });
    res.cookie('panel_token', result.token, {
        httpOnly: true,
        maxAge: 12 * 60 * 60 * 1000,
        sameSite: 'strict',
    });
    res.json({ success: true, role: result.role, username: result.username });
});

router.post('/logout', (req, res) => {
    res.clearCookie('panel_token');
    res.json({ success: true });
});

router.get('/me', requireAuth, (req, res) => {
    res.json({ username: req.panelUser.username, role: req.panelUser.role });
});

router.get('/admin', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'mostakim-admin.html'));
});

router.get('/user', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'mostakim-user.html'));
});

router.get('/api/stats', requireAdmin, (req, res) => {
    res.json(getStats());
});

router.get('/api/commands', requireAuth, (req, res) => {
    const cmds = getCommands();
    if (req.panelUser.role === 'user') {
        const safe = cmds.map(c => ({
            name: c.name,
            description: c.description,
            category: c.category,
            usage: c.usage,
            cooldown: c.cooldown,
        }));
        return res.json(safe);
    }
    res.json(cmds);
});

router.get('/api/config', requireAdmin, (req, res) => {
    const cfg = safeReadJson(CONFIG_PATH);
    if (!cfg) return res.status(500).json({ error: 'Cannot read config' });
    const safe = { ...cfg };
    delete safe.EMAIL;
    delete safe.PASSWORD;
    delete safe.OTPKEY;
    res.json(safe);
});

router.post('/api/config', requireAdmin, (req, res) => {
    try {
        const current = safeReadJson(CONFIG_PATH) || {};
        const forbidden = ['EMAIL', 'PASSWORD', 'OTPKEY', 'AUTHOR_UID', 'AUTHOR_NAME'];
        const update = { ...current };
        for (const [k, v] of Object.entries(req.body)) {
            if (!forbidden.includes(k)) update[k] = v;
        }
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(update, null, 4), 'utf-8');
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/api/cookie', requireAdmin, (req, res) => {
    try {
        const raw = fs.readFileSync(APPSTATE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        res.json({ cookieCount: parsed.length, preview: raw.slice(0, 200) + '...' });
    } catch (e) {
        res.status(500).json({ error: 'Cannot read appstate.json' });
    }
});

router.post('/api/cookie', requireAdmin, (req, res) => {
    try {
        const { appstate } = req.body;
        if (!appstate) return res.status(400).json({ error: 'No appstate provided' });
        let parsed;
        try { parsed = JSON.parse(appstate); }
        catch { return res.status(400).json({ error: 'Invalid JSON format' }); }
        if (!Array.isArray(parsed)) return res.status(400).json({ error: 'Appstate must be an array' });
        fs.writeFileSync(APPSTATE_PATH, JSON.stringify(parsed, null, '\t'), 'utf-8');
        res.json({ success: true, cookieCount: parsed.length });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/api/banned', requireAdmin, (req, res) => {
    const live = getLiveBotStats();
    const banned = (live && live.banned) || {};
    res.json({
        userBanned:   banned.userBanned   || [],
        threadBanned: banned.threadBanned || [],
        cmdBanned:    banned.cmdBanned    || [],
    });
});

router.post('/api/unban', requireAdmin, (req, res) => {
    const { type, id } = req.body;
    if (!type || !id) return res.status(400).json({ error: 'Missing type or id' });
    try {
        if (type === 'user' && global.data && global.data.userBanned) global.data.userBanned.delete(id);
        else if (type === 'thread' && global.data && global.data.threadBanned) global.data.threadBanned.delete(id);
        else if (type === 'cmd' && global.data && global.data.commandBanned) global.data.commandBanned.delete(id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/api/threads', requireAdmin, (req, res) => {
    const live = getLiveBotStats();
    const threads = (live && live.threads) || [];
    res.json({ threads, total: threads.length });
});

router.get('/api/logs', requireAdmin, (req, res) => {
    const logs = getLiveLogs();
    res.json({ logs });
});

router.post('/api/restart', requireAdmin, (req, res) => {
    res.json({ success: true, message: 'Bot is restarting...' });
    setTimeout(() => {
        try { process.exit(1); } catch {}
    }, 1000);
});

router.post('/api/cookie-quick', (req, res) => {
    const { password, appstate } = req.body;
    if (!password || !appstate) return res.status(400).json({ error: 'Missing fields' });
    const result = login('admin', password);
    if (!result || result.role !== 'admin') return res.status(401).json({ error: 'Invalid admin password' });
    try {
        let parsed;
        try { parsed = JSON.parse(appstate); } catch { return res.status(400).json({ error: 'Invalid JSON format' }); }
        if (!Array.isArray(parsed)) return res.status(400).json({ error: 'Appstate must be an array' });
        fs.writeFileSync(APPSTATE_PATH, JSON.stringify(parsed, null, '\t'), 'utf-8');
        res.json({ success: true, cookieCount: parsed.length });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/api/user-stats', requireAuth, (req, res) => {
    const cfg = safeReadJson(CONFIG_PATH) || {};
    const cmds = fs.readdirSync(CMDS_PATH).filter(f => f.endsWith('.js')).length;
    const evts = fs.readdirSync(EVENTS_PATH).filter(f => f.endsWith('.js')).length;
    const live = getLiveBotStats();
    const isOnline = live && live.botStatus === 'Online' && live.updatedAt && (Date.now() - live.updatedAt) < 30000;
    res.json({
        botName: cfg.BOTNAME || 'MOSTAKIM V2 BOT',
        prefix: cfg.PREFIX || '/',
        uptime: getUptime(),
        commandCount: cmds,
        eventCount: evts,
        threadCount: live ? (live.threadCount || 0) : 0,
        userCount: live ? (live.userCount || 0) : 0,
        platform: 'Replit',
        nodeVersion: process.version,
        botStatus: isOnline ? 'Online ✅' : 'Offline ❌',
    });
});

router.get('/api/user-admins', requireAuth, (req, res) => {
    const cfg = safeReadJson(CONFIG_PATH) || {};
    const userName = global.data && global.data.userName;
    function enrichList(ids) {
        return (ids || []).map(uid => ({
            uid,
            name: (userName && userName.has(String(uid))) ? userName.get(String(uid)) : null,
        }));
    }
    res.json({
        adminbot: enrichList(cfg.ADMINBOT),
        superadmin: enrichList(cfg.SUPERADMIN),
        dev: enrichList(cfg.DEV),
        premium: enrichList(cfg.PREMIUM),
        vip: enrichList(cfg.VIP),
    });
});

router.post('/api/change-password', requireAdmin, (req, res) => {
    const { targetUser, newPassword } = req.body;
    if (!targetUser || !newPassword) return res.status(400).json({ error: 'Missing fields' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const ok = changePassword(targetUser, newPassword);
    if (!ok) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
});

router.get('/api/admins', requireAdmin, (req, res) => {
    const cfg = safeReadJson(CONFIG_PATH) || {};
    res.json({
        adminbot: cfg.ADMINBOT || [],
        superadmin: cfg.SUPERADMIN || [],
        dev: cfg.DEV || [],
        premium: cfg.PREMIUM || [],
        vip: cfg.VIP || [],
    });
});

router.post('/api/admins', requireAdmin, (req, res) => {
    try {
        const { type, uid, action } = req.body;
        if (!type || !uid || !action) return res.status(400).json({ error: 'Missing fields' });
        const cfg = safeReadJson(CONFIG_PATH) || {};
        const keyMap = { adminbot: 'ADMINBOT', superadmin: 'SUPERADMIN', dev: 'DEV', premium: 'PREMIUM', vip: 'VIP' };
        const key = keyMap[type];
        if (!key) return res.status(400).json({ error: 'Invalid type' });
        if (!Array.isArray(cfg[key])) cfg[key] = [];
        if (action === 'add' && !cfg[key].includes(uid)) cfg[key].push(uid);
        else if (action === 'remove') cfg[key] = cfg[key].filter(id => id !== uid);
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 4), 'utf-8');
        res.json({ success: true, list: cfg[key] });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
