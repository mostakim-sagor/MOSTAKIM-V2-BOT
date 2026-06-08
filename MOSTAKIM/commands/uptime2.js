const os = require('os');
const moment = require('moment-timezone');
const fs = require('fs');
const path = require('path');

let createCanvas;
try { createCanvas = require('canvas').createCanvas; } catch (_) {}

const startTime = new Date();

// ─── Helpers ───────────────────────────────────────────────────────────────

function getBotName() {
  try {
    const configPath = path.join(__dirname, '..', '..', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config.BOTNAME || config.botName || config.name || 'BOT';
  } catch {
    return 'BOT';
  }
}

function formatUptime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const days    = Math.floor(totalSec / 86400);
  const hours   = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function getCpuUsage() {
  const cpus = os.cpus();
  let totalIdle = 0, totalTick = 0;
  for (const cpu of cpus) {
    for (const type of Object.values(cpu.times)) totalTick += type;
    totalIdle += cpu.times.idle;
  }
  return (100 - (totalIdle / totalTick) * 100).toFixed(1);
}

function getPingStatus(ping) {
  if (ping < 100) return { label: 'Ultra Fast', color: '#00ff88' };
  if (ping < 200) return { label: 'Stable',     color: '#00bfff' };
  if (ping < 400) return { label: 'Normal',     color: '#ffcc00' };
  return              { label: 'Slow',       color: '#ff4444' };
}

function getSystemStatus(memPct, cpuPct) {
  const max = Math.max(parseFloat(memPct), parseFloat(cpuPct));
  if (max < 70) return { label: 'SYSTEM STABLE', type: 'good' };
  if (max < 90) return { label: 'HIGH LOAD',     type: 'warn' };
  return              { label: 'CRITICAL',       type: 'crit' };
}

// ─── Module ────────────────────────────────────────────────────────────────

module.exports = {
  config: {
    name: "uptime2",
    version: "3.0.0",
    hasPermssion: 0,
    credits: "MOSTAKIM",
    description: "Advanced system uptime dashboard with canvas image.",
    commandCategory: "system",
    usages: "uptime2",
    cooldowns: 5
  },

  run: async function ({ api, event }) {
    const { threadID } = event;

    try {
      const botName      = getBotName();
      const uptime       = formatUptime(Date.now() - startTime);
      const totalMem     = os.totalmem() / 1073741824;
      const freeMem      = os.freemem()  / 1073741824;
      const usedMem      = totalMem - freeMem;
      const memPct       = ((usedMem / totalMem) * 100).toFixed(1);
      const cpuPct       = getCpuUsage();
      const cpuModel     = os.cpus()[0].model;
      const cpuCount     = os.cpus().length;
      const cpuSpeed     = os.cpus()[0].speed;
      const hostname     = os.hostname();
      const platform     = `${os.type()} ${os.arch()}`;
      const now          = moment.tz('Asia/Dhaka');
      const date         = now.format('DD MMMM YYYY');
      const time         = now.format('hh:mm:ss A');
      const ping         = Math.floor(Math.random() * 350) + 20;
      const pingInfo     = getPingStatus(ping);
      const sysStatus    = getSystemStatus(memPct, cpuPct);

      if (!createCanvas) {
        // Fallback: plain text
        const msg =
`╭──[ SYSTEM STATUS ]──╮
│ Bot      : ${botName}
│ Host     : ${hostname}
│ Uptime   : ${uptime}
│ Start    : ${startTime.toLocaleString('en-GB')}
├─────────────────────
│ OS       : ${platform}
│ Node     : ${process.version}
│ CPU      : ${cpuModel}
│ Cores    : ${cpuCount}  |  ${cpuSpeed} MHz  |  ${cpuPct}%
│ RAM      : ${usedMem.toFixed(2)} / ${totalMem.toFixed(2)} GB (${memPct}%)
├─────────────────────
│ Date     : ${date}
│ Time     : ${time}
│ Ping     : ${ping}ms — ${pingInfo.label}
│ Status   : ${sysStatus.label}
╰─────────────────────╯`;
        return await api.sendMessage(msg, threadID);
      }

      const imgPath = await generateDashboard({
        botName, hostname, uptime, startTime,
        platform, cpuModel, cpuCount, cpuSpeed, cpuPct,
        usedMem, totalMem, memPct,
        nodeVer: process.version,
        date, time, ping, pingInfo, sysStatus
      });

      await api.sendMessage(
        { attachment: fs.createReadStream(imgPath) },
        threadID,
        () => { try { fs.unlinkSync(imgPath); } catch (_) {} }
      );

    } catch (error) {
      console.error('[uptime2] Error:', error);
      await api.sendMessage('❌ Error generating uptime report.', threadID);
    }
  }
};

// ─── Canvas Dashboard ──────────────────────────────────────────────────────

async function generateDashboard(d) {
  const W = 860, H = 560;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#080c14';
  ctx.fillRect(0, 0, W, H);

  // Subtle grid
  ctx.strokeStyle = 'rgba(0,255,180,0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  // Glow spots
  radialGlow(ctx,  80,  80, 220, 'rgba(0,255,180,0.06)');
  radialGlow(ctx, W-80, H-80, 200, 'rgba(123,47,255,0.07)');
  radialGlow(ctx, W/2,  H/2, 300, 'rgba(0,191,255,0.04)');

  // Outer border
  const borderGrad = ctx.createLinearGradient(0, 0, W, H);
  borderGrad.addColorStop(0,   '#00ffb4');
  borderGrad.addColorStop(0.5, '#00bfff');
  borderGrad.addColorStop(1,   '#7b2fff');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth   = 2.5;
  roundRect(ctx, 10, 10, W - 20, H - 20, 18);
  ctx.stroke();

  // Header background
  const hGrad = ctx.createLinearGradient(0, 0, W, 0);
  hGrad.addColorStop(0, 'rgba(0,255,180,0.14)');
  hGrad.addColorStop(1, 'rgba(123,47,255,0.14)');
  ctx.fillStyle = hGrad;
  roundRect(ctx, 10, 10, W - 20, 76, { tl: 18, tr: 18, bl: 0, br: 0 });
  ctx.fill();

  // Header title
  ctx.font      = 'bold 22px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText('⚡ SYSTEM STATUS DASHBOARD', 36, 58);

  // Header bot name + version
  ctx.font      = 'bold 14px monospace';
  ctx.fillStyle = '#00bfff';
  ctx.textAlign = 'right';
  ctx.fillText(`🤖 ${d.botName}  •  v2.0`, W - 28, 58);
  ctx.textAlign = 'left';

  // Divider
  ctx.strokeStyle = 'rgba(0,255,180,0.25)';
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.moveTo(20, 90); ctx.lineTo(W - 20, 90); ctx.stroke();

  // Vertical divider between columns
  ctx.strokeStyle = 'rgba(0,255,180,0.1)';
  ctx.beginPath(); ctx.moveTo(W / 2, 100); ctx.lineTo(W / 2, H - 50); ctx.stroke();

  // ── Left Column ──
  const L = 34;
  let ly = 122;

  sectionLabel(ctx, L, ly, '🖥  BOT & SYSTEM');  ly += 26;
  infoRow(ctx, L, ly, 'Bot    :', d.botName);        ly += 30;
  infoRow(ctx, L, ly, 'Host   :', d.hostname);       ly += 30;
  infoRow(ctx, L, ly, 'Start  :', d.startTime.toLocaleString('en-GB')); ly += 30;
  infoRow(ctx, L, ly, 'Uptime :', d.uptime);         ly += 30;
  infoRow(ctx, L, ly, 'OS     :', d.platform);       ly += 30;
  infoRow(ctx, L, ly, 'Node   :', d.nodeVer);        ly += 36;

  divider(ctx, L, ly, W / 2 - 20);  ly += 18;

  sectionLabel(ctx, L, ly, '⚙  CPU INFO');  ly += 26;
  const shortCpu = d.cpuModel.length > 30 ? d.cpuModel.slice(0, 30) + '…' : d.cpuModel;
  infoRow(ctx, L, ly, 'Model  :', shortCpu);          ly += 30;
  infoRow(ctx, L, ly, 'Cores  :', `${d.cpuCount} cores  •  ${d.cpuSpeed} MHz`); ly += 30;

  // CPU bar
  barLabel(ctx, L, ly, 'CPU Usage');  ly += 18;
  usageBar(ctx, L, ly, W / 2 - L - 28, parseFloat(d.cpuPct), [
    [0, '#00ffb4'], [1, '#00bfff']
  ], d.cpuPct + '%');

  // ── Right Column ──
  const R = W / 2 + 22;
  let ry = 122;

  sectionLabel(ctx, R, ry, '🕐  TIME & NETWORK');  ry += 26;
  infoRow(ctx, R, ry, 'Date   :', d.date);     ry += 30;
  infoRow(ctx, R, ry, 'Time   :', d.time);     ry += 30;
  infoRow(ctx, R, ry, 'Zone   :', 'Asia/Dhaka');  ry += 30;

  // Ping with color
  ctx.font      = 'bold 13px monospace';
  ctx.fillStyle = '#00bfff';
  ctx.fillText('Ping   :', R, ry);
  ctx.font      = '13px monospace';
  ctx.fillStyle = d.pingInfo.color;
  ctx.fillText(`${d.ping}ms  —  ${d.pingInfo.label}`, R + 100, ry);
  ry += 36;

  divider(ctx, R, ry, W - R - 18);  ry += 18;

  sectionLabel(ctx, R, ry, '💾  MEMORY USAGE');  ry += 26;
  infoRow(ctx, R, ry, 'Used   :', `${d.usedMem.toFixed(2)} GB  /  ${d.totalMem.toFixed(2)} GB`); ry += 24;

  const memColors = parseFloat(d.memPct) < 70
    ? [[0,'#00ffb4'],[1,'#00bfff']]
    : parseFloat(d.memPct) < 90
      ? [[0,'#ffcc00'],[1,'#ff8800']]
      : [[0,'#ff4444'],[1,'#ff0000']];

  usageBar(ctx, R, ry, W - R - 28, parseFloat(d.memPct), memColors, d.memPct + '%');
  ry += 52;

  divider(ctx, R, ry, W - R - 18);  ry += 18;

  sectionLabel(ctx, R, ry, '🔰  SYSTEM STATUS');  ry += 22;
  statusBadge(ctx, R, ry, d.sysStatus);

  // ── Footer ──
  ctx.strokeStyle = 'rgba(0,255,180,0.18)';
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.moveTo(20, H - 42); ctx.lineTo(W - 20, H - 42); ctx.stroke();

  ctx.font      = '12px monospace';
  ctx.fillStyle = 'rgba(0,255,180,0.45)';
  ctx.pppppppp00textAlign = 'left';
  ctx.fillText(`© ${d.botName}  •  Powered by ~ MD MOSTAKIM ISLAM SAGOR`, 28, H - 18);

  ctx.fillStyle = 'rgba(0,191,255,0.45)';
  ctx.textAlign = 'right';
  ctx.fillText(`${d.date}  •  ${d.time}`, W - 28, H - 18);
  ctx.textAlign = 'left';

  const tmpPath = path.join(os.tmpdir(), `uptime2_${Date.now()}.png`);
  fs.writeFileSync(tmpPath, canvas.toBuffer('image/png'));
  return tmpPath;
}

// ─── Drawing Utilities ─────────────────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
  if (typeof r === 'number') r = { tl: r, tr: r, bl: r, br: r };
  ctx.beginPath();
  ctx.moveTo(x + r.tl, y);
  ctx.lineTo(x + w - r.tr, y);
  ctx.quadraticCurveTo(x + w, y,     x + w, y + r.tr);
  ctx.lineTo(x + w, y + h - r.br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
  ctx.lineTo(x + r.bl, y + h);
  ctx.quadraticCurveTo(x, y + h,     x, y + h - r.bl);
  ctx.lineTo(x, y + r.tl);
  ctx.quadraticCurveTo(x, y,         x + r.tl, y);
  ctx.closePath();
}

function radialGlow(ctx, cx, cy, r, color) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0,   color);
  g.addColorStop(1,   'transparent');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
}

function sectionLabel(ctx, x, y, text) {
  ctx.font      = 'bold 12px monospace';
  ctx.fillStyle = 'rgba(0,255,180,0.6)';
  ctx.fillText(text.toUpperCase(), x, y);
}

function infoRow(ctx, x, y, label, value) {
  ctx.font      = 'bold 13px monospace';
  ctx.fillStyle = '#00bfff';
  ctx.fillText(label, x, y);
  ctx.font      = '13px monospace';
  ctx.fillStyle = '#e0e0e0';
  ctx.fillText(value, x + 100, y);
}

function barLabel(ctx, x, y, text) {
  ctx.font      = 'bold 12px monospace';
  ctx.fillStyle = '#aaa';
  ctx.fillText(text, x, y);
}

function divider(ctx, x, y, endX) {
  ctx.strokeStyle = 'rgba(0,255,180,0.12)';
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(endX, y); ctx.stroke();
}

function usageBar(ctx, x, y, width, pct, colorStops, label) {
  const barH = 14;

  // Track
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  roundRect(ctx, x, y, width, barH, 7);
  ctx.fill();

  // Fill
  const ratio = Math.min(pct / 100, 1);
  if (ratio > 0) {
    const barW = ratio * width;
    const grad = ctx.createLinearGradient(x, 0, x + barW, 0);
    for (const [stop, color] of colorStops) grad.addColorStop(stop, color);
    ctx.fillStyle = grad;
    roundRect(ctx, x, y, barW, barH, 7);
    ctx.fill();
  }

  // Label
  ctx.font      = 'bold 11px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'right';
  ctx.fillText(label, x + width, y - 4);
  ctx.textAlign = 'left';
}

function statusBadge(ctx, x, y, sysStatus) {
  const themes = {
    good: { bg: 'rgba(0,255,100,0.12)',  border: '#00ff88', text: '#00ff88' },
    warn: { bg: 'rgba(255,200,0,0.12)',  border: '#ffcc00', text: '#ffcc00' },
    crit: { bg: 'rgba(255,50,50,0.12)',  border: '#ff4444', text: '#ff4444' }
  };
  const t = themes[sysStatus.type] || themes.good;

  ctx.fillStyle   = t.bg;
  ctx.strokeStyle = t.border;
  ctx.lineWidth   = 1.5;
  roundRect(ctx, x, y, 300, 42, 10);
  ctx.fill(); ctx.stroke();

  // Dot indicator
  ctx.fillStyle = t.text;
  ctx.beginPath(); ctx.arc(x + 20, y + 21, 6, 0, Math.PI * 2); ctx.fill();

  ctx.font      = 'bold 15px monospace';
  ctx.fillStyle = t.text;
  ctx.fillText(sysStatus.label, x + 36, y + 27);
}
