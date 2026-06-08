<div align="center">

# ⚡ MOSTAKIM V2 BOT — Complete Run Guide

**A Facebook Messenger Bot made by MD Mostakim Islam Sagor**

[![Facebook](https://img.shields.io/badge/Facebook-1877F2?style=for-the-badge&logo=facebook&logoColor=white)](https://fb.me/100058112936375)
[![GitHub](https://img.shields.io/badge/GitHub-121011?style=for-the-badge&logo=github&logoColor=white)](https://github.com/mostakim-sagor)
[![Telegram](https://img.shields.io/badge/Telegram-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/M0STAKIM10X)
[![YouTube](https://img.shields.io/badge/YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://youtube.com/@MOSTAKIM-LABS)
[![Instagram](https://img.shields.io/badge/Instagram-E4405F?style=for-the-badge&logo=instagram&logoColor=white)](https://instagram.com/mostakim.info)

</div>

---

## 📋 Requirements

| Item | Version |
|------|---------|
| Node.js | v18 or higher |
| npm | v8+ |
| Facebook Appstate (Cookie) | Stored in `appstate.json` |
| Free Storage | At least 1–2 GB |

---

## ⚡ Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Add your appstate.json (Facebook account cookie)

# 3. Start the bot
node index.js
```

**Admin Panel:** `http://localhost:5000/panel/login`
- Username: `admin`
- Password: `MOSTAKIM`

---

## 🪟 Windows

### Method 1 — Direct Run

1. Download and install [Node.js](https://nodejs.org) (LTS version) and [Git](https://git-scm.com)

2. Install build tools (required for native packages):
   ```cmd
   npm install -g windows-build-tools
   ```

3. Clone the repository:
   ```cmd
   git clone https://github.com/mostakim-sagor/MOSTAKIM-V2-BOT.git
   cd MOSTAKIM-V2-BOT
   ```

4. Install packages and start:
   ```cmd
   npm install
   node index.js
   ```

### Method 2 — PM2 (Runs in Background)

```cmd
npm install -g pm2

pm2 start index.js --name "mostakim-bot"
pm2 save
pm2 startup

:: View logs
pm2 logs mostakim-bot

:: Check status
pm2 status
```

### Method 3 — Forever

```cmd
npm install -g forever
forever start index.js
forever list
forever logs 0
```

---

## 🐧 Linux (Ubuntu / Debian / CentOS)

### Step 1 — Install Node.js

```bash
# Ubuntu / Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs git sqlite3

# CentOS / RHEL
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs git
```

### Step 2 — Install System Dependencies

```bash
# Ubuntu / Debian (needed for canvas, image commands)
sudo apt-get install -y \
  libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev \
  librsvg2-dev build-essential python3 ffmpeg

# CentOS / RHEL
sudo yum install -y cairo-devel pango-devel libjpeg-devel \
  giflib-devel librsvg2-devel python3 make gcc gcc-c++ ffmpeg
```

### Step 3 — Clone and Run

```bash
git clone https://github.com/mostakim-sagor/MOSTAKIM-V2-BOT.git
cd MOSTAKIM-V2-BOT
npm install
node index.js
```

### Keep Running After SSH Disconnect

**Using Screen:**
```bash
screen -S mostakim
node index.js
# Detach: Ctrl+A then D
# Re-attach: screen -r mostakim
```

**Using PM2:**
```bash
npm install -g pm2
pm2 start index.js --name "mostakim-bot"
pm2 save && pm2 startup
pm2 logs mostakim-bot
```

---

## 📱 Termux (Android)

> Download Termux from [F-Droid](https://f-droid.org) — the Play Store version is outdated.

### Step 1 — Setup Termux

```bash
termux-setup-storage
pkg update && pkg upgrade -y
```

### Step 2 — Install Dependencies

```bash
# Node.js and Git
pkg install nodejs git -y

# Canvas / image packages
pkg install cairo pango libjpeg-turbo giflib librsvg python -y

# Build tools
pkg install build-essential -y
```

### Step 3 — Clone and Run

```bash
git clone https://github.com/mostakim-sagor/MOSTAKIM-V2-BOT.git
cd MOSTAKIM-V2-BOT
npm install
node index.js
```

### Run in Background (Termux)

```bash
# Background with nohup
nohup node index.js > bot.log 2>&1 &

# View live log
tail -f bot.log

# Stop the bot
kill %1
```

> **Tip:** Install **Termux:Boot** app to auto-start the bot when your phone restarts.

---

## ☁️ Render

1. Sign up at [render.com](https://render.com) and connect your GitHub account.

2. Click **New +** → **Web Service** → select your repository.

3. Set the following:

   | Setting | Value |
   |---------|-------|
   | Name | mostakim-v2-bot |
   | Environment | Node |
   | Build Command | `npm install` |
   | Start Command | `node index.js` |
   | Instance Type | Free (512 MB RAM) |

4. Click **Create Web Service** — Render will build and deploy automatically.

**Admin Panel URL:** `https://your-app.onrender.com/panel/login`

> **Note:** Free tier sleeps after 15 minutes of inactivity. Use a paid plan to keep it always running.

---

## 🚂 Railway

1. Sign up at [railway.app](https://railway.app) → connect GitHub.

2. Click **New Project** → **Deploy from GitHub repo** → select your repo.

3. Go to **Settings → Deploy** and set:
   ```
   Start Command: node index.js
   ```

4. (Optional) Add a Volume for persistent data:
   - **Settings → Volumes → Add Volume**
   - Mount Path: `/app/MAIN`

5. Add environment variable:
   ```
   NODE_ENV=production
   ```

**Admin Panel URL:** `https://your-app.railway.app/panel/login`

> **Note:** Railway gives $5/month free credit — enough to run the bot almost all month.

---

## 🌐 Koyeb

1. Sign up at [koyeb.com](https://koyeb.com) → connect GitHub.

2. Click **Create Service** → **GitHub** → select your repo.

3. Configure the service:

   | Setting | Value |
   |---------|-------|
   | Builder | Buildpack |
   | Run Command | `node index.js` |
   | Port | `5000` |
   | Instance | Free (512 MB) |

4. Click **Deploy**.

**Admin Panel URL:** `https://your-app.koyeb.app/panel/login`

---

## 🌀 Replit

1. Go to [replit.com](https://replit.com) → **Create Repl** → **Import from GitHub**.

2. Paste the repo URL and import.

3. In the Shell tab:
   ```bash
   npm install
   ```

4. Make sure `.replit` file has:
   ```
   run = "node index.js"
   ```

5. Click the **Run** button.

**Admin Panel:** `https://your-repl.replit.dev/panel/login`

---

## 🔧 config.json Setup

```json
{
  "BOTNAME": "Your Bot Name",
  "PREFIX": "/",
  "ADMINBOT": ["Your Facebook UID"],
  "language": "en",
  "timeZone": "Asia/Dhaka",
  "adminOnly": false,
  "allowInbox": true,
  "autoClean": true,
  "NOTIFICATION": true
}
```

> **Find your Facebook UID:** Visit [findmyfbid.in](https://findmyfbid.in)

---

## 🍪 Getting Appstate (Facebook Cookie)

### Method 1 — Browser Extension

1. Install the **c3c-fbstate** extension in Chrome or Firefox.
2. Log in to Facebook.
3. Run the extension and copy the JSON output.
4. Paste it into `appstate.json`.

### Method 2 — Admin Panel Cookie Update

1. Go to **Admin Panel → 🍪 Cookie Update**
2. Paste your appstate JSON
3. Click **Update Cookie**
4. Restart the bot

---

## 🚨 Common Issues & Fixes

| Problem | Fix |
|---------|-----|
| `canvas` package error | Run `npm rebuild canvas` or install system deps |
| Bot not logging in | Get a fresh appstate and update it |
| Port 5000 already in use | Run with `PORT=3000 node index.js` |
| Out of memory | Run with `node --max-old-space-size=512 index.js` |
| `ffmpeg` not found | Install: `apt install ffmpeg` (Linux) / `pkg install ffmpeg` (Termux) |
| Permission denied | Run `chmod +x index.js` or use `sudo` |
| `node-gyp` build error | Install Python 3 and build tools for your OS |

---

## 🖥️ Admin Panel Reference

| URL | Purpose |
|-----|---------|
| `/panel/login` | Login page |
| `/panel/admin` | Admin dashboard |
| `/panel/user` | User panel (command list) |

**Default Credentials:**
- **Admin:** `admin` / `MOSTAKIM`
- **User:** `user` / `user123`

---

## 🚀 One-Click Deploy

| Platform | Deploy |
|----------|--------|
| ![Replit](https://img.shields.io/badge/Replit-F26D00?style=flat-square&logo=replit&logoColor=white) | [Deploy on Replit](https://replit.com) |
| ![Render](https://img.shields.io/badge/Render-3FE0C5?style=flat-square&logo=render&logoColor=black) | [Deploy on Render](https://render.com) |
| ![Railway](https://img.shields.io/badge/Railway-0B0D0E?style=flat-square&logo=railway&logoColor=white) | [Deploy on Railway](https://railway.app) |
| ![Koyeb](https://img.shields.io/badge/Koyeb-121212?style=flat-square&logo=koyeb&logoColor=white) | [Deploy on Koyeb](https://koyeb.com) |

---

## 📞 Contact & Support

<div align="center">

[![Facebook](https://img.shields.io/badge/Facebook-1877F2?style=for-the-badge&logo=facebook&logoColor=white)](https://fb.me/100058112936375)
[![GitHub](https://img.shields.io/badge/GitHub-121011?style=for-the-badge&logo=github&logoColor=white)](https://github.com/mostakim-sagor)
[![Telegram](https://img.shields.io/badge/Telegram-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/M0STAKIM10X)
[![YouTube](https://img.shields.io/badge/YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://youtube.com/@MOSTAKIM-LABS)
[![Instagram](https://img.shields.io/badge/Instagram-E4405F?style=for-the-badge&logo=instagram&logoColor=white)](https://instagram.com/mostakim.info)

**Author:** MD Mostakim Islam Sagor
**Bot:** MOSTAKIM V2 BOT
**GitHub Repo:** [mostakim-sagor/MOSTAKIM-V2-BOT](https://github.com/mostakim-sagor/MOSTAKIM-V2-BOT)

</div>

---

<div align="center">
  <sub>© 2024 MD Mostakim Islam Sagor — Licensed under GNU GPL v3.0</sub>
</div>
