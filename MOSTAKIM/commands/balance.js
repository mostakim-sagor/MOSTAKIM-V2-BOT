const { createCanvas, loadImage } = require("canvas");
const fs    = require("fs-extra");
const path  = require("path");
const axios = require("axios");

module.exports.config = {
  name: "bal",
  version: "3.0.0",
  hasPermssion: 0,
  credits: "MOSTAKIM",
  description: "Check your balance with wallet card",
  commandCategory: "economy",
  usages: "[tag or reply or none]",
  cooldowns: 3,
  usePrefix: true
};

module.exports.languages = {
  "en": {
    "selfBalance":  "💰 Your current balance: %1$",
    "otherBalance": "💰 %1's current balance: %2$",
    "zeroBalance":  "😅 %1 has no money at all!"
  }
};

function isAdmin(uid) {
  return [].concat(
    global.config?.ADMINBOT  || [],
    global.config?.ADMIN     || [],
    global.config?.adminList || []
  ).map(String).includes(String(uid));
}

async function getMoney(uid, Currencies) {
  if (isAdmin(uid)) {
    try {
      const data = await Currencies.getData(uid);
      if (!data?.money || data.money < 2000000000) {
        await Currencies.setData(uid, { money: 2000000000 });
        return 2000000000;
      }
      return data.money;
    } catch { return 2000000000; }
  }
  try { return (await Currencies.getData(uid))?.money || 0; } catch { return 0; }
}

async function getName(uid, api) {
  try {
    const info = await api.getUserInfo(uid);
    return info?.[uid]?.name || "User";
  } catch { return "User"; }
}

module.exports.run = async function ({ api, event, args, Currencies, getText }) {
  const { threadID, messageID, senderID, mentions, messageReply } = event;

  let uid, name;
  if (Object.keys(mentions).length >= 1) {
    uid  = Object.keys(mentions)[0];
    name = mentions[uid].replace(/@/g, "") || await getName(uid, api);
  } else if (messageReply) {
    uid  = messageReply.senderID;
    name = messageReply.senderName || await getName(uid, api);
  } else {
    uid  = senderID;
    name = await getName(uid, api);
  }

  const money     = await getMoney(uid, Currencies);
  const adminUser = isAdmin(uid);

  const cardType =
    adminUser       ? "OWNER"    :
    money >= 100000 ? "DIAMOND"  :
    money >= 50000  ? "PLATINUM" :
    money >= 10000  ? "GOLD"     :
    money >= 1000   ? "PREMIUM"  : "BASIC";

  // Random theme each call
  const themes = ["green", "purple", "blue", "gold"];
  const theme  = themes[Math.floor(Date.now() / 30000) % themes.length];

  const cacheDir   = path.join(__dirname, "cache");
  fs.ensureDirSync(cacheDir);
  const avatarPath = path.join(cacheDir, `bal_avt_${uid}.png`);
  const outPath    = path.join(cacheDir, `bal_${uid}_${Date.now()}.png`);

  try {
    const res = await axios.get(
      `https://graph.facebook.com/${uid}/picture?width=256&height=256&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`,
      { responseType: "arraybuffer", timeout: 10000 }
    );
    fs.writeFileSync(avatarPath, Buffer.from(res.data));
  } catch {}

  const buffer = await generateWalletCard({ name, uid, money, cardType, avatarPath, adminUser, theme });
  fs.writeFileSync(outPath, buffer);
  try { fs.removeSync(avatarPath); } catch {}

  api.sendMessage(
    { body: "", attachment: fs.createReadStream(outPath) },
    threadID,
    () => { try { fs.unlinkSync(outPath); } catch {} },
    messageID
  );
};

// ── Theme definitions ─────────────────────────────────────────────────────
const THEMES = {
  green: {
    bg:       ["#0a2318", "#0d2d1e", "#071a10"],
    border:   ["rgba(34,197,94,0.7)",  "rgba(16,185,129,0.3)", "rgba(34,197,94,0.7)"],
    accent:   "#22c55e",
    accentL:  "#4ade80",
    accentLL: "#86efac",
    ringC:    "rgba(34,197,94,0.6)",
    star:     "rgba(255,255,255,",
    label:    "DIGITAL PAYMENT CARD",
  },
  purple: {
    bg:       ["#120a2e", "#1a0a3e", "#0d0620"],
    border:   ["rgba(168,85,247,0.7)", "rgba(139,92,246,0.3)", "rgba(168,85,247,0.7)"],
    accent:   "#a855f7",
    accentL:  "#c084fc",
    accentLL: "#e879f9",
    ringC:    "rgba(168,85,247,0.6)",
    star:     "rgba(200,180,255,",
    label:    "CRYPTO WALLET CARD",
  },
  blue: {
    bg:       ["#071828", "#0a1f35", "#050f1a"],
    border:   ["rgba(59,130,246,0.7)", "rgba(37,99,235,0.3)",  "rgba(59,130,246,0.7)"],
    accent:   "#3b82f6",
    accentL:  "#60a5fa",
    accentLL: "#93c5fd",
    ringC:    "rgba(59,130,246,0.6)",
    star:     "rgba(180,210,255,",
    label:    "DIGITAL BANK CARD",
  },
  gold: {
    bg:       ["#1a1205", "#211608", "#140e04"],
    border:   ["rgba(251,191,36,0.7)", "rgba(245,158,11,0.3)", "rgba(251,191,36,0.7)"],
    accent:   "#f59e0b",
    accentL:  "#fbbf24",
    accentLL: "#fde68a",
    ringC:    "rgba(251,191,36,0.6)",
    star:     "rgba(255,240,180,",
    label:    "GOLD MEMBER CARD",
  },
};

// ── Card Generator ─────────────────────────────────────────────────────────
async function generateWalletCard({ name, uid, money, cardType, avatarPath, adminUser, theme }) {
  // Layout: left content (60%) | right panel (40%)
  const W = 960, H = 480;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext("2d");
  const T      = THEMES[theme] || THEMES.green;

  // ── Background ──
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, T.bg[0]); bg.addColorStop(0.5, T.bg[1]); bg.addColorStop(1, T.bg[2]);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // Stars
  ctx.save();
  for (let i = 0; i < 100; i++) {
    ctx.fillStyle = T.star + (Math.random()*0.2+0.04) + ")";
    ctx.beginPath(); ctx.arc(Math.random()*W, Math.random()*H, Math.random()*1.4+0.2, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();

  // Subtle radial glow center-right
  const glow = ctx.createRadialGradient(W*0.75, H*0.4, 0, W*0.75, H*0.4, 280);
  glow.addColorStop(0, T.ringC.replace("0.6","0.12")); glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  // ── Outer border ──
  const bG = ctx.createLinearGradient(0, 0, W, H);
  bG.addColorStop(0, T.border[0]); bG.addColorStop(0.5, T.border[1]); bG.addColorStop(1, T.border[2]);
  ctx.strokeStyle = bG; ctx.lineWidth = 2.5;
  roundRect(ctx, 5, 5, W-10, H-10, 20); ctx.stroke();

  // Vertical separator (right panel start at x=580)
  const sepX = 580;
  ctx.strokeStyle = T.border[1]; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(sepX, 30); ctx.lineTo(sepX, H-30); ctx.stroke();

  // ════════════ LEFT PANEL ════════════

  // Title
  ctx.font = "bold 38px sans-serif"; ctx.fillStyle = "#ffffff"; ctx.textAlign = "left";
  ctx.fillText("WALLET BALANCE", 45, 78);

  ctx.font = "14px sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillText(T.label, 45, 104);

  // Thin accent line under title
  const lineG = ctx.createLinearGradient(45, 0, 520, 0);
  lineG.addColorStop(0, T.accent); lineG.addColorStop(1, "rgba(0,0,0,0)");
  ctx.strokeStyle = lineG; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(45, 118); ctx.lineTo(520, 118); ctx.stroke();

  // Balance label
  ctx.font = "12px sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fillText("· AVAILABLE BALANCE", 45, 148);

  // Balance amount — auto font size to fit
  const moneyStr  = `$${Number(money).toLocaleString()}`;
  const maxFontSz = 78, minFontSz = 32, maxW = sepX - 60;
  let fontSize = maxFontSz;
  ctx.font = `bold ${fontSize}px sans-serif`;
  while (ctx.measureText(moneyStr).width > maxW && fontSize > minFontSz) {
    fontSize -= 2;
    ctx.font = `bold ${fontSize}px sans-serif`;
  }
  const mG = ctx.createLinearGradient(45, 0, 500, 0);
  mG.addColorStop(0, T.accent); mG.addColorStop(0.5, T.accentL); mG.addColorStop(1, T.accentLL);
  ctx.fillStyle = mG;
  ctx.fillText(moneyStr, 45, 230);

  // Admin crown below balance
  if (adminUser) {
    ctx.font = "13px sans-serif"; ctx.fillStyle = T.accentL;
    ctx.fillText("👑 ADMIN ACCOUNT", 45, 256);
  }

  // Divider
  ctx.strokeStyle = "rgba(255,255,255,0.07)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(45, 278); ctx.lineTo(520, 278); ctx.stroke();

  // Card Holder
  ctx.font = "11px sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.38)";
  ctx.fillText("CARD HOLDER", 45, 306);
  const dn = name.toUpperCase();
  ctx.font = "bold 28px sans-serif"; ctx.fillStyle = "#ffffff";
  ctx.fillText(dn.length > 24 ? dn.slice(0,24)+"..." : dn, 45, 340);

  // Divider
  ctx.strokeStyle = "rgba(255,255,255,0.07)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(45, 360); ctx.lineTo(520, 360); ctx.stroke();

  // User ID
  ctx.font = "11px sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.38)";
  ctx.fillText("USER ID", 45, 386);
  ctx.font = "bold 19px sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.fillText(String(uid), 45, 412);

  // Generated date
  ctx.font = "11px sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.textAlign = "right";
  ctx.fillText(`Generated: ${new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`, sepX - 20, H - 18);
  ctx.textAlign = "left";

  // ════════════ RIGHT PANEL ════════════

  const RX = sepX + (W - sepX) / 2; // center of right panel

  // Avatar circle
  const avtY = 155, avtR = 90;
  // Outer glow
  const ringG = ctx.createRadialGradient(RX, avtY, avtR-8, RX, avtY, avtR+28);
  ringG.addColorStop(0, T.ringC); ringG.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = ringG;
  ctx.beginPath(); ctx.arc(RX, avtY, avtR+28, 0, Math.PI*2); ctx.fill();

  // Dashed orbit ring
  ctx.save();
  ctx.strokeStyle = T.accent + "88"; ctx.lineWidth = 1.5; ctx.setLineDash([6,5]);
  ctx.beginPath(); ctx.arc(RX, avtY, avtR+10, 0, Math.PI*2); ctx.stroke();
  ctx.setLineDash([]); ctx.restore();

  // Avatar clip
  ctx.save();
  ctx.beginPath(); ctx.arc(RX, avtY, avtR, 0, Math.PI*2); ctx.clip();
  try {
    const img = await loadImage(avatarPath);
    ctx.drawImage(img, RX-avtR, avtY-avtR, avtR*2, avtR*2);
  } catch {
    ctx.fillStyle = T.bg[1]; ctx.fillRect(RX-avtR, avtY-avtR, avtR*2, avtR*2);
    ctx.font = "bold 44px sans-serif"; ctx.fillStyle = T.accentL; ctx.textAlign = "center";
    ctx.fillText(name.charAt(0).toUpperCase(), RX, avtY+16);
  }
  ctx.restore();

  // Avatar border
  ctx.strokeStyle = T.accent; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(RX, avtY, avtR, 0, Math.PI*2); ctx.stroke();

  // Small status dot
  const dotAngle = Math.PI * 0.72;
  const dotX = RX + Math.cos(dotAngle) * avtR;
  const dotY = avtY + Math.sin(dotAngle) * avtR;
  ctx.fillStyle = money > 0 ? "#22c55e" : "#ef4444";
  ctx.strokeStyle = T.bg[0]; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(dotX, dotY, 9, 0, Math.PI*2); ctx.fill(); ctx.stroke();

  // Chip (below avatar, right side)
  drawChip(ctx, RX - 38, avtY + avtR + 14, 76, 54);

  // ── Card Type badge ──
  const b1X = sepX + 20, b2X = sepX + 200;
  const badgeY = H - 115, badgeW = 155, badgeH = 75;

  drawBadge(ctx, b1X,  badgeY, badgeW, badgeH, "CARD TYPE",
    cardType,
    cardType === "OWNER"    ? "#f0abfc" :
    cardType === "DIAMOND"  ? "#a5f3fc" :
    cardType === "PLATINUM" ? "#e2e8f0" :
    cardType === "GOLD"     ? "#fbbf24" :
    cardType === "PREMIUM"  ? T.accentL : "#94a3b8",
    T
  );

  drawBadge(ctx, b2X, badgeY, badgeW, badgeH, "CARD STATUS",
    money > 0 ? "ACTIVE" : "INACTIVE",
    money > 0 ? "#4ade80" : "#f87171",
    T
  );

  return canvas.toBuffer("image/png");
}

// ── Chip ──────────────────────────────────────────────────────────────────
function drawChip(ctx, x, y, w, h) {
  ctx.save();
  const g = ctx.createLinearGradient(x, y, x+w, y+h);
  g.addColorStop(0,"#b45309"); g.addColorStop(0.3,"#fbbf24"); g.addColorStop(0.6,"#f59e0b"); g.addColorStop(1,"#92400e");
  ctx.fillStyle = g; roundRect(ctx, x, y, w, h, 7); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 1;
  const mx=x+w/2, my=y+h/2;
  ctx.beginPath();
  ctx.moveTo(x+6,my);   ctx.lineTo(x+w-6,my);
  ctx.moveTo(mx,y+6);   ctx.lineTo(mx,y+h-6);
  ctx.moveTo(x+6,y+12); ctx.lineTo(x+w-6,y+12);
  ctx.moveTo(x+6,y+h-12); ctx.lineTo(x+w-6,y+h-12);
  ctx.stroke();
  // Shine
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  roundRect(ctx, x+2, y+2, w-4, (h/2)-2, 5); ctx.fill();
  ctx.restore();
}

// ── Badge ─────────────────────────────────────────────────────────────────
function drawBadge(ctx, x, y, w, h, label, value, valueColor, T) {
  ctx.save();
  // Glass bg
  ctx.fillStyle   = "rgba(0,0,0,0.4)";
  ctx.strokeStyle = T.border[1];
  ctx.lineWidth   = 1;
  roundRect(ctx, x, y, w, h, 10); ctx.fill(); ctx.stroke();

  ctx.font = "11px sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.textAlign = "center";
  ctx.fillText(label, x+w/2, y+24);

  ctx.font = "bold 17px sans-serif"; ctx.fillStyle = valueColor;
  ctx.fillText(value, x+w/2, y+52);
  ctx.textAlign = "left"; ctx.restore();
}

// ── Round rect ────────────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}
