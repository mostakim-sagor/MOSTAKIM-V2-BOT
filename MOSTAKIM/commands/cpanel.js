const { createCanvas, loadImage, registerFont } = require('canvas');
const fs    = require('fs-extra');
const path  = require('path');
const os    = require('os');
const axios = require('axios');

const fontDir  = path.join(__dirname, 'assets', 'font');
const cacheDir = path.join(__dirname, 'cache');

try { registerFont(path.join(fontDir, 'BeVietnamPro-Bold.ttf'),    { family: 'BeVietnamPro', weight: 'bold' }); }    catch {}
try { registerFont(path.join(fontDir, 'BeVietnamPro-SemiBold.ttf'),{ family: 'BeVietnamPro', weight: '600' }); }     catch {}
try { registerFont(path.join(fontDir, 'BeVietnamPro-Regular.ttf'), { family: 'BeVietnamPro', weight: 'normal' }); }  catch {}
try { registerFont(path.join(fontDir, 'NotoSans-Bold.ttf'),        { family: 'NotoSans',     weight: 'bold' }); }    catch {}
try { registerFont(path.join(fontDir, 'NotoSans-SemiBold.ttf'),    { family: 'NotoSans',     weight: '600' }); }     catch {}

// ══════════════════════════════════════════════════════════════════════════
// ⚙️  CPANEL CONFIG — fill these in config.json or here directly
// ══════════════════════════════════════════════════════════════════════════
// In config.json add:
// "CPANEL_HOST":  "https://your-server.com:2083",
// "CPANEL_USER":  "your_cpanel_username",
// "CPANEL_TOKEN": "your_cpanel_api_token"
// ══════════════════════════════════════════════════════════════════════════

function getCpanelConfig() {
  return {
    host:  global.config?.CPANEL_HOST  || null,
    user:  global.config?.CPANEL_USER  || null,
    token: global.config?.CPANEL_TOKEN || null,
  };
}

// ── cPanel UAPI caller ────────────────────────────────────────────────────
async function cpanelAPI(module, func, params = {}) {
  const { host, user, token } = getCpanelConfig();
  if (!host || !user || !token) return null;

  try {
    const qs  = new URLSearchParams(params).toString();
    const url = `${host}/execute/${module}/${func}${qs ? '?' + qs : ''}`;
    const res = await axios.get(url, {
      headers: { Authorization: `cpanel ${user}:${token}` },
      timeout: 8000,
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
    });
    return res.data?.data || null;
  } catch {
    return null;
  }
}

// ── Fetch cPanel data ─────────────────────────────────────────────────────
async function fetchCpanelData() {
  const [diskData, dbData, domainData, emailData, ftpData, bwData, sslData] = await Promise.all([
    cpanelAPI('Quota', 'get_quota_info'),
    cpanelAPI('Mysql', 'list_databases'),
    cpanelAPI('DomainInfo', 'list_domains'),
    cpanelAPI('Email', 'list_pops'),
    cpanelAPI('Ftp', 'list_ftp'),
    cpanelAPI('Bandwidth', 'get_bandwidth'),
    cpanelAPI('SSL', 'list_certs'),
  ]);

  const hasCpanel = !!diskData;

  return {
    hasCpanel,
    // Disk
    diskUsedPct: diskData
      ? Math.round((diskData.megabytes_used / diskData.megabytes_limit) * 100) || 0
      : null,
    diskTotal: diskData ? `${diskData.megabytes_limit} MB` : null,
    diskFree:  diskData ? `${diskData.megabytes_limit - diskData.megabytes_used} MB` : null,
    // Databases
    databases: dbData ? dbData.length : null,
    // Domains
    domains: domainData
      ? (domainData.addon_domains?.length || 0) + (domainData.sub_domains?.length || 0) + 1
      : null,
    // Email
    emailAccounts: emailData ? emailData.length : null,
    // FTP
    ftpAccounts: ftpData ? ftpData.length : null,
    // Bandwidth
    bandwidthPct: bwData
      ? Math.round((bwData.usage / bwData.limit) * 100) || 0
      : null,
    bandwidthUsed: bwData ? formatBytes((bwData.usage || 0) * 1024 * 1024) : null,
    // SSL
    sslStatus: sslData && sslData.length > 0 ? 'Active' : 'None',
  };
}

// ── Local OS data ─────────────────────────────────────────────────────────
function getLocalData() {
  const cpus     = os.cpus();
  const totalMem = os.totalmem();
  const freeMem  = os.freemem();
  const usedMem  = totalMem - freeMem;
  const memPct   = ((usedMem / totalMem) * 100).toFixed(1);

  let totalIdle = 0, totalTick = 0;
  for (const cpu of cpus) {
    for (const v of Object.values(cpu.times)) totalTick += v;
    totalIdle += cpu.times.idle;
  }
  const cpuPct = (100 - (totalIdle / totalTick) * 100).toFixed(1);

  let diskPct = 0, diskTotal = 'N/A', diskFree = 'N/A';
  try {
    const df = require('child_process').execSync('df -k / | tail -1').toString().trim().split(/\s+/);
    diskPct   = Math.round((parseInt(df[2]) / parseInt(df[1])) * 100);
    diskTotal = formatBytes(parseInt(df[1]) * 1024);
    diskFree  = formatBytes(parseInt(df[3]) * 1024);
  } catch {}

  let rxTotal = 0, txTotal = 0;
  try {
    const lines = require('fs').readFileSync('/proc/net/dev','utf8').split('\n').slice(2);
    for (const line of lines) {
      const p = line.trim().split(/\s+/);
      if (p.length > 9 && !p[0].startsWith('lo')) {
        rxTotal += parseInt(p[1]) || 0;
        txTotal += parseInt(p[9]) || 0;
      }
    }
  } catch {}

  return {
    cpuPct:    parseFloat(cpuPct),
    cpuCores:  cpus.length,
    cpuSpeed:  cpus[0]?.speed || 0,
    memPct:    parseFloat(memPct),
    memUsed:   formatBytes(usedMem),
    memTotal:  formatBytes(totalMem),
    memFree:   formatBytes(freeMem),
    diskPct,   diskTotal, diskFree,
    netRx:     rxTotal > 0 ? formatBytes(rxTotal) : 'N/A',
    netTx:     txTotal > 0 ? formatBytes(txTotal) : 'N/A',
    uptime:    formatUptime(os.uptime()),
    loadAvg:   os.loadavg().map(v => v.toFixed(2)).join(' '),
    nodeVer:   process.version,
    pid:       process.pid,
    platform:  `${os.type()} ${os.arch()}`,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────
function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024, sizes = ['B','KB','MB','GB','TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

// ── Drawing helpers ───────────────────────────────────────────────────────
function drawGlowCircle(ctx, x, y, radius, colors, glowColor, glowSize = 30) {
  ctx.save();
  for (let i = glowSize; i > 0; i--) {
    const alpha = (1 - i / glowSize) * 0.15;
    ctx.beginPath(); ctx.arc(x, y, radius + i, 0, Math.PI*2);
    ctx.fillStyle = glowColor.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
    ctx.fill();
  }
  const g = ctx.createRadialGradient(x - radius*0.3, y - radius*0.3, 0, x, y, radius);
  g.addColorStop(0, colors[0]); g.addColorStop(0.7, colors[1]); g.addColorStop(1, colors[2] || colors[1]);
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI*2); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, radius - 5, -Math.PI*0.7, -Math.PI*0.3);
  const shine = ctx.createLinearGradient(x-radius, y-radius, x, y);
  shine.addColorStop(0, 'rgba(255,255,255,0.4)'); shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.strokeStyle = shine; ctx.lineWidth = 3; ctx.stroke();
  ctx.restore();
}

function drawProgressArc(ctx, x, y, radius, progress, bgColor, fillColor, lineWidth = 8) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, radius, -Math.PI*0.75, Math.PI*0.75);
  ctx.strokeStyle = bgColor; ctx.lineWidth = lineWidth; ctx.lineCap = 'round'; ctx.stroke();
  if (progress > 0) {
    const sweep = (Math.PI*1.5) * (Math.min(progress, 100) / 100);
    ctx.beginPath(); ctx.arc(x, y, radius, -Math.PI*0.75, -Math.PI*0.75 + sweep);
    ctx.strokeStyle = fillColor; ctx.lineWidth = lineWidth; ctx.lineCap = 'round'; ctx.stroke();
  }
  ctx.restore();
}

function drawConnectingLine(ctx, x1, y1, x2, y2, color) {
  ctx.save();
  const g = ctx.createLinearGradient(x1,y1,x2,y2);
  g.addColorStop(0, 'rgba(255,255,255,0.05)'); g.addColorStop(0.5, color); g.addColorStop(1, 'rgba(255,255,255,0.05)');
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.stroke();
  const dotX = x1+(x2-x1)*0.3, dotY = y1+(y2-y1)*0.3;
  ctx.beginPath(); ctx.arc(dotX, dotY, 4, 0, Math.PI*2); ctx.fillStyle = color; ctx.fill();
  ctx.restore();
}

function drawIcon(ctx, x, y, size, type, color = 'rgba(255,255,255,0.9)') {
  ctx.save();
  ctx.fillStyle = color; ctx.strokeStyle = color;
  ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const sc = size / 24;
  ctx.translate(x - 12*sc, y - 12*sc); ctx.scale(sc, sc);
  switch(type) {
    case 'server':
      ctx.beginPath(); ctx.roundRect(4,3,16,5,2); ctx.roundRect(4,10,16,5,2); ctx.roundRect(4,17,16,4,2); ctx.stroke();
      ctx.beginPath(); ctx.arc(7,5.5,1,0,Math.PI*2); ctx.arc(7,12.5,1,0,Math.PI*2); ctx.fill(); break;
    case 'cpu':
      ctx.strokeRect(6,6,12,12);
      ctx.beginPath();
      [[9,3,9,6],[12,3,12,6],[15,3,15,6],[9,18,9,21],[12,18,12,21],[15,18,15,21],[3,9,6,9],[3,12,6,12],[3,15,6,15],[18,9,21,9],[18,12,21,12],[18,15,21,15]].forEach(([a,b,c,d])=>{ctx.moveTo(a,b);ctx.lineTo(c,d);});
      ctx.stroke(); ctx.fillRect(9,9,6,6); break;
    case 'ram':
      ctx.strokeRect(2,7,20,10); ctx.fillRect(5,10,3,4); ctx.fillRect(10,10,3,4); ctx.fillRect(16,10,3,4); break;
    case 'storage':
      ctx.beginPath(); ctx.ellipse(12,7,8,4,0,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(4,7);ctx.lineTo(4,17);ctx.moveTo(20,7);ctx.lineTo(20,17); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(12,17,8,4,0,0,Math.PI*2); ctx.stroke(); break;
    case 'bandwidth':
      ctx.beginPath(); ctx.moveTo(3,17);ctx.lineTo(8,11);ctx.lineTo(12,14);ctx.lineTo(16,7);ctx.lineTo(21,10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(16,7);ctx.lineTo(21,7);ctx.lineTo(21,12); ctx.stroke(); break;
    case 'domain':
      ctx.beginPath(); ctx.arc(12,12,9,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(12,12,4,9,0,0,Math.PI*2); ctx.stroke();
      ctx.moveTo(3,12);ctx.lineTo(21,12);ctx.moveTo(12,3);ctx.lineTo(12,21); ctx.stroke(); break;
    case 'ssl':
      ctx.strokeRect(5,11,14,9);
      ctx.beginPath(); ctx.moveTo(8,11);ctx.lineTo(8,8);ctx.arc(12,8,4,Math.PI,0);ctx.lineTo(16,11); ctx.stroke();
      ctx.beginPath(); ctx.arc(12,15,2,0,Math.PI*2); ctx.fill(); break;
    case 'email':
      ctx.strokeRect(2,5,20,14);
      ctx.beginPath(); ctx.moveTo(2,5);ctx.lineTo(12,12);ctx.lineTo(22,5); ctx.stroke(); break;
    case 'ftp':
      ctx.beginPath(); ctx.moveTo(12,4);ctx.lineTo(12,16);ctx.moveTo(7,9);ctx.lineTo(12,4);ctx.lineTo(17,9); ctx.stroke();
      ctx.strokeRect(4,16,16,4); break;
    case 'database':
      ctx.beginPath(); ctx.ellipse(12,6,7,3,0,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(5,6);ctx.lineTo(5,18);ctx.moveTo(19,6);ctx.lineTo(19,18); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(12,12,7,3,0,Math.PI,0,true);ctx.ellipse(12,18,7,3,0,0,Math.PI*2); ctx.stroke(); break;
    case 'uptime':
      ctx.beginPath(); ctx.arc(12,12,9,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(12,6);ctx.lineTo(12,12);ctx.lineTo(17,15); ctx.stroke();
      ctx.beginPath(); ctx.arc(12,12,2,0,Math.PI*2); ctx.fill(); break;
    case 'visitors':
      ctx.beginPath(); ctx.arc(9,8,4,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(2,21);ctx.quadraticCurveTo(9,14,16,21); ctx.stroke();
      ctx.beginPath(); ctx.arc(17,6,3,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(12,18);ctx.quadraticCurveTo(17,12,22,18); ctx.stroke(); break;
    case 'network':
      ctx.beginPath(); ctx.moveTo(12,2);ctx.lineTo(12,22);ctx.moveTo(2,12);ctx.lineTo(22,12); ctx.stroke();
      ctx.beginPath(); ctx.arc(12,12,9,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(12,12,5,9,0,0,Math.PI*2); ctx.stroke(); break;
    case 'load':
      ctx.beginPath(); ctx.moveTo(3,17);ctx.quadraticCurveTo(7,10,12,13);ctx.quadraticCurveTo(17,16,21,7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(21,7);ctx.lineTo(21,12);ctx.moveTo(21,7);ctx.lineTo(16,7); ctx.stroke(); break;
    case 'node':
      ctx.font='bold 11px BeVietnamPro'; ctx.textAlign='center'; ctx.fillText('NODE', 12, 16); break;
    case 'php':
      ctx.font='bold 14px BeVietnamPro'; ctx.textAlign='center'; ctx.fillText('{ }', 12, 16); break;
  }
  ctx.restore();
}

// ── Main card generator ───────────────────────────────────────────────────
async function generateCpanelCard(botName = "BOT", botStats = {}) {
  const W = 1600, H = 1200;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');
  const cx = W/2, cy = H/2;

  // Background
  const bgG = ctx.createRadialGradient(cx,cy,0,cx,cy,H);
  bgG.addColorStop(0,'#1a1a3e'); bgG.addColorStop(0.4,'#0f1628');
  bgG.addColorStop(0.7,'#0a0f1a'); bgG.addColorStop(1,'#050810');
  ctx.fillStyle = bgG; ctx.fillRect(0,0,W,H);

  // Stars
  ctx.save();
  for (let i=0; i<200; i++) {
    ctx.fillStyle=`rgba(255,255,255,${Math.random()*0.6+0.2})`;
    ctx.beginPath(); ctx.arc(Math.random()*W, Math.random()*H, Math.random()*2+0.5, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();

  // Rings
  ctx.save();
  ctx.strokeStyle='rgba(100,150,255,0.03)'; ctx.lineWidth=1;
  for (let r=100; r<Math.max(W,H); r+=80) { ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke(); }
  ctx.restore();

  // ── Fetch all data ──
  const local  = getLocalData();
  const cpanel = await fetchCpanelData();
  const has    = cpanel.hasCpanel;

  // Build 12 circles — cPanel data used when available, local OS as fallback
  const infoCircles = [
    {
      title: 'SERVER', icon: 'server',
      value: 'Online',
      sub: has ? getCpanelConfig().host?.replace('https://','').split(':')[0] || 'cPanel' : local.platform.split(' ')[0],
      colors: ['#34d399','#10b981','#059669'], glow: 'rgb(16,185,129)'
    },
    {
      title: 'CPU', icon: 'cpu',
      value: `${local.cpuPct}%`,
      sub: `${local.cpuCores} Cores`,
      colors: ['#818cf8','#6366f1','#4f46e5'], glow: 'rgb(99,102,241)', progress: local.cpuPct
    },
    {
      title: 'RAM', icon: 'ram',
      value: `${local.memPct}%`,
      sub: local.memUsed,
      colors: ['#fbbf24','#f59e0b','#d97706'], glow: 'rgb(245,158,11)', progress: local.memPct
    },
    {
      title: 'STORAGE', icon: 'storage',
      value: has ? `${cpanel.diskUsedPct}%` : `${local.diskPct}%`,
      sub: has ? `Total: ${cpanel.diskTotal}` : `Free: ${local.diskFree}`,
      colors: ['#f472b6','#ec4899','#db2777'], glow: 'rgb(236,72,153)',
      progress: has ? cpanel.diskUsedPct : local.diskPct
    },
    {
      title: 'BANDWIDTH', icon: 'bandwidth',
      value: has ? `${cpanel.bandwidthPct}%` : local.netRx,
      sub: has ? cpanel.bandwidthUsed : `TX: ${local.netTx}`,
      colors: ['#2dd4bf','#14b8a6','#0d9488'], glow: 'rgb(20,184,166)',
      progress: has ? cpanel.bandwidthPct : undefined
    },
    {
      title: has ? 'DOMAINS' : 'COMMANDS', icon: 'domain',
      value: has ? cpanel.domains : String(botStats.cmdCount || 0),
      sub: has ? 'Active' : 'Loaded',
      colors: ['#a78bfa','#8b5cf6','#7c3aed'], glow: 'rgb(139,92,246)'
    },
    {
      title: has ? 'SSL' : 'EVENTS', icon: 'ssl',
      value: has ? cpanel.sslStatus : String(botStats.evtCount || 0),
      sub: has ? 'Secured' : 'Loaded',
      colors: ['#4ade80','#22c55e','#16a34a'], glow: 'rgb(34,197,94)'
    },
    {
      title: has ? 'EMAIL' : 'USERS', icon: 'email',
      value: has ? cpanel.emailAccounts : String(botStats.userCount || 0),
      sub: has ? 'Accounts' : 'In DB',
      colors: ['#60a5fa','#3b82f6','#2563eb'], glow: 'rgb(59,130,246)'
    },
    {
      title: has ? 'FTP' : 'GROUPS', icon: 'ftp',
      value: has ? cpanel.ftpAccounts : String(botStats.groupCount || 0),
      sub: has ? 'Accounts' : 'Active',
      colors: ['#fb7185','#f43f5e','#e11d48'], glow: 'rgb(244,63,94)'
    },
    {
      title: has ? 'DATABASE' : 'BOT UPT', icon: 'database',
      value: has ? cpanel.databases : botStats.botUptime || '0m',
      sub: has ? 'MySQL' : 'Process',
      colors: ['#38bdf8','#0ea5e9','#0284c7'], glow: 'rgb(14,165,233)'
    },
    {
      title: 'UPTIME', icon: 'uptime',
      value: local.uptime,
      sub: '99.9% SLA',
      colors: ['#a3e635','#84cc16','#65a30d'], glow: 'rgb(132,204,22)'
    },
    {
      title: 'LOAD AVG', icon: 'load',
      value: local.loadAvg.split(' ')[0],
      sub: local.loadAvg,
      colors: ['#c084fc','#a855f7','#9333ea'], glow: 'rgb(168,85,247)'
    },
  ];

  const outerRadius = 420, circleRadius = 95;

  // Connecting lines
  infoCircles.forEach((c, i) => {
    const angle = (Math.PI*2/12)*i - Math.PI/2;
    drawConnectingLine(ctx,
      cx + Math.cos(angle)*160, cy + Math.sin(angle)*160,
      cx + Math.cos(angle)*(outerRadius - circleRadius - 10),
      cy + Math.sin(angle)*(outerRadius - circleRadius - 10),
      c.glow.replace('rgb','rgba').replace(')',', 0.4)')
    );
  });

  // Center glow
  ctx.save();
  for (let i=50; i>0; i--) {
    ctx.beginPath(); ctx.arc(cx,cy,150+i,0,Math.PI*2);
    ctx.fillStyle=`rgba(99,102,241,${(1-i/50)*0.2})`; ctx.fill();
  }
  ctx.restore();

  // Center circle
  const cG = ctx.createRadialGradient(cx-40,cy-40,0,cx,cy,150);
  cG.addColorStop(0,'#4f46e5'); cG.addColorStop(0.5,'#3730a3'); cG.addColorStop(1,'#1e1b4b');
  ctx.beginPath(); ctx.arc(cx,cy,150,0,Math.PI*2); ctx.fillStyle=cG; ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.3)'; ctx.lineWidth=3; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx,cy,160,0,Math.PI*2);
  ctx.strokeStyle='rgba(99,102,241,0.5)'; ctx.lineWidth=2;
  ctx.setLineDash([10,10]); ctx.stroke(); ctx.setLineDash([]);

  // Center text
  ctx.save();
  ctx.fillStyle='#ffffff'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font='bold 26px BeVietnamPro'; ctx.fillText(botName, cx, cy - 20);
  ctx.font='600 15px BeVietnamPro'; ctx.fillStyle='rgba(255,255,255,0.8)';
  ctx.fillText(has ? 'CPANEL + SYSTEM' : 'SYSTEM MONITOR', cx, cy + 12);
  ctx.font='600 12px BeVietnamPro'; ctx.fillStyle='rgba(255,255,255,0.55)';
  ctx.fillText(has ? '✅ cPanel Connected' : '⚡ Local OS Data', cx, cy + 38);
  ctx.font='600 11px BeVietnamPro'; ctx.fillStyle='rgba(255,255,255,0.35)';
  ctx.fillText(`Node ${local.nodeVer}`, cx, cy + 58);
  ctx.restore();

  // Info circles
  infoCircles.forEach((circle, i) => {
    const angle = (Math.PI*2/12)*i - Math.PI/2;
    const x = cx + Math.cos(angle)*outerRadius;
    const y = cy + Math.sin(angle)*outerRadius;

    drawGlowCircle(ctx, x, y, circleRadius, circle.colors, circle.glow, 25);
    if (circle.progress !== undefined)
      drawProgressArc(ctx, x, y, circleRadius+12, circle.progress, 'rgba(0,0,0,0.3)', '#ffffff', 6);
    drawIcon(ctx, x, y-30, 28, circle.icon);

    ctx.save();
    ctx.fillStyle='#ffffff'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font='bold 11px BeVietnamPro'; ctx.fillText(circle.title, x, y-5);
    ctx.font='bold 22px BeVietnamPro'; ctx.fillText(String(circle.value), x, y+22);
    ctx.font='600 11px BeVietnamPro'; ctx.fillStyle='rgba(255,255,255,0.8)';
    ctx.fillText(circle.sub, x, y+45);
    ctx.restore();
  });

  // Footer
  ctx.save();
  ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.font='600 14px BeVietnamPro'; ctx.textAlign='center';
  ctx.fillText(`Last Updated: ${new Date().toLocaleString()}`, cx, H-40);
  ctx.font='600 12px BeVietnamPro'; ctx.fillStyle='rgba(255,255,255,0.3)';
  ctx.fillText(has ? 'cPanel + Real-time System Monitor' : 'Real-time System Monitor', cx, H-20);
  ctx.restore();

  return canvas.toBuffer('image/png');
}

// ── Module ────────────────────────────────────────────────────────────────
module.exports = {
  config: {
    name: "cpanel",
    aliases: ["hosting","server","hostinfo","panel"],
    version: "3.1.0",
    author: "MOSTAKIM",
    countDown: 10,
    role: 0,
    description: "Real-time system + cPanel hosting monitor",
    category: "utility",
    guide: "{pn}"
  },

  onStart: async function({ message, event, Users, Threads, usersData, threadsData }) {
    try {
      message.reaction("⏳", event.messageID);
      if (!fs.existsSync(cacheDir)) fs.mkdirpSync(cacheDir);

      const _Users   = Users   || usersData;
      const _Threads = Threads || threadsData;

      let userCount = 0, groupCount = 0;
      try { userCount  = await _Users.count();   } catch {}
      try { groupCount = await _Threads.count();  } catch {}

      const uptimeSec = Math.floor(process.uptime());
      const _d = Math.floor(uptimeSec / 86400);
      const _h = Math.floor((uptimeSec % 86400) / 3600);
      const _m = Math.floor((uptimeSec % 3600)  / 60);
      const botUptime = _d > 0 ? `${_d}d${_h}h` : `${_h}h${_m}m`;

      const botStats = {
        cmdCount  : global.client?.commands?.size || 0,
        evtCount  : global.client?.events?.size   || 0,
        userCount,
        groupCount,
        botUptime,
      };

      const botName = global.config?.BOTNAME || global.config?.nickNameBot || "BOT";
      const buffer  = await generateCpanelCard(botName, botStats);
      const imgPath = path.join(cacheDir, `cpanel_${Date.now()}.png`);

      fs.writeFileSync(imgPath, buffer);

      await message.reply({
        body: "📊 𝗦𝗬𝗦𝗧𝗘𝗠 & 𝗛𝗢𝗦𝗧𝗜𝗡𝗚 𝗠𝗢𝗡𝗜𝗧𝗢𝗥",
        attachment: fs.createReadStream(imgPath)
      });

      message.reaction("✅", event.messageID);
      setTimeout(() => { try { fs.unlinkSync(imgPath); } catch {} }, 5000);

    } catch (error) {
      console.error("[cpanel] Error:", error);
      message.reaction("❌", event.messageID);
      message.reply("❌ Error generating panel. Check console.");
    }
  }
};
