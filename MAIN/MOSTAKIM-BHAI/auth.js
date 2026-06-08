const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const SECRET = process.env.PANEL_SECRET || 'mostakim-bhai-super-secret-2024-xyz';
const CREDS_PATH = path.join(__dirname, 'panel-credentials.json');

function getCredentials() {
    return JSON.parse(fs.readFileSync(CREDS_PATH, 'utf-8'));
}

function saveCredentials(data) {
    fs.writeFileSync(CREDS_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function login(username, password) {
    const creds = getCredentials();
    const found = Object.values(creds).find(u => u.username === username);
    if (!found) return null;
    const valid = bcrypt.compareSync(password, found.password);
    if (!valid) return null;
    const token = jwt.sign({ username: found.username, role: found.role }, SECRET, { expiresIn: '12h' });
    return { token, role: found.role, username: found.username };
}

function verifyToken(token) {
    try {
        return jwt.verify(token, SECRET);
    } catch {
        return null;
    }
}

function requireAuth(req, res, next) {
    const token = req.cookies && req.cookies.panel_token;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    const user = verifyToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid or expired token' });
    req.panelUser = user;
    next();
}

function requireAdmin(req, res, next) {
    const token = req.cookies && req.cookies.panel_token;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    const user = verifyToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid or expired token' });
    if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    req.panelUser = user;
    next();
}

function changePassword(username, newPassword) {
    const creds = getCredentials();
    const key = Object.keys(creds).find(k => creds[k].username === username);
    if (!key) return false;
    creds[key].password = bcrypt.hashSync(newPassword, 10);
    saveCredentials(creds);
    return true;
}

module.exports = { login, verifyToken, requireAuth, requireAdmin, changePassword, getCredentials, saveCredentials };
