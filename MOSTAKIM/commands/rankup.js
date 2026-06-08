module.exports.config = {
  name: "rank",
  aliases: ["rankup"],
  version: "3.0.0",
  hasPermssion: 0,
  credits: "MOSTAKIM",
  description: "Show rank card / announce rankup for each group/user",
  commandCategory: "media",
  dependencies: { "fs-extra": "" },
  usages: "[on/off/theme]",
  cooldowns: 2,
};

module.exports.handleEvent = async function ({ api, event, Currencies, Users, getText }) {
  var { threadID, senderID } = event;
  const { loadImage, createCanvas } = require("canvas");
  const fs    = global.nodemodule["fs-extra"];
  const axios = global.nodemodule["axios"];
  const path  = require("path");

  threadID = String(threadID);
  senderID = String(senderID);

  const thread = global.data.threadData.get(threadID) || {};

  let exp = (await Currencies.getData(senderID)).exp;
  exp = exp + 1;

  if (isNaN(exp)) return;

  if (typeof thread["rankup"] != "undefined" && thread["rankup"] == false) {
    await Currencies.setData(senderID, { exp });
    return;
  }

  const curLevel = Math.floor(Math.sqrt(1 + (4 * exp / 3) + 1) / 2);
  const level    = Math.floor(Math.sqrt(1 + (4 * (exp + 1) / 3) + 1) / 2);

  if (level > curLevel && level != 1) {
    const name = global.data.userName.get(senderID) || await Users.getNameUser(senderID);

    var messsage = (typeof thread.customRankup == "undefined")
      ? getText("levelup")
      : thread.customRankup;

    messsage = messsage
      .replace(/\{name}/g, name)
      .replace(/\{level}/g, level);

    // ── Cache dir ──
    const cacheDir = path.join(__dirname, "cache");
    fs.ensureDirSync(cacheDir);
    const pathAvt = path.join(cacheDir, `rankup_avt_${senderID}.png`);
    const pathOut = path.join(cacheDir, `rankup_${senderID}_${Date.now()}.png`);

    try {
      // ── Download avatar ──
      const avtData = (await axios.get(
        `https://graph.facebook.com/${senderID}/picture?width=512&height=512&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`,
        { responseType: "arraybuffer" }
      )).data;
      fs.writeFileSync(pathAvt, Buffer.from(avtData));

      // ── Pick theme: rotates each levelup ──
      const themes = ["galaxy", "cyber", "fire", "ocean"];
      const themeIndex = (parseInt(String(senderID).slice(-4), 10) + level) % themes.length;
      const theme = themes[themeIndex];

      // ── Draw card ──
      const W = 800, H = 340;
      const canvas = createCanvas(W, H);
      const ctx    = canvas.getContext("2d");

      drawRankupCard(ctx, W, H, theme, { name, level, exp });

      // ── Avatar overlay ──
      const avtX = 155, avtY = H / 2, avtR = 110;
      const themeColors = {
        galaxy: { ring: "#a855f7", badge: "#1a0a30", badgeBorder: "#a855f7", badgeText: "#e879f9" },
        cyber:  { ring: "#00ff88", badge: "#001a0a", badgeBorder: "#00ff88", badgeText: "#00ffb4" },
        fire:   { ring: "#ff6600", badge: "#1a0500", badgeBorder: "#ff6600", badgeText: "#ffaa00" },
        ocean:  { ring: "#00bfff", badge: "#00081a", badgeBorder: "#00bfff", badgeText: "#67e8f9" },
      };
      const tc = themeColors[theme];

      const ringG = ctx.createRadialGradient(avtX, avtY, avtR-10, avtX, avtY, avtR+20);
      ringG.addColorStop(0, tc.ring + "99"); ringG.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = ringG;
      ctx.beginPath(); ctx.arc(avtX, avtY, avtR+20, 0, Math.PI*2); ctx.fill();

      ctx.strokeStyle = tc.ring + "80"; ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.arc(avtX, avtY, avtR+8, 0, Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);

      ctx.save();
      ctx.beginPath(); ctx.arc(avtX, avtY, avtR, 0, Math.PI*2); ctx.clip();
      const avtImg = await loadImage(pathAvt);
      ctx.drawImage(avtImg, avtX-avtR, avtY-avtR, avtR*2, avtR*2);
      ctx.restore();

      ctx.strokeStyle = tc.ring; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(avtX, avtY, avtR, 0, Math.PI*2); ctx.stroke();

      const bdX = avtX + avtR*0.65, bdY = avtY + avtR*0.65;
      ctx.fillStyle = tc.badge; ctx.strokeStyle = tc.badgeBorder; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(bdX, bdY, 28, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.font = "bold 14px sans-serif"; ctx.fillStyle = tc.badgeText;
      ctx.textAlign = "center"; ctx.fillText("LVL", bdX, bdY-4);
      ctx.font = "bold 18px sans-serif"; ctx.fillStyle = "#ffffff";
      ctx.fillText(String(level), bdX, bdY+16);
      ctx.textAlign = "left";

      // ── Save & Send ──
      fs.writeFileSync(pathOut, canvas.toBuffer("image/png"));
      try { fs.removeSync(pathAvt); } catch (_) {}

      api.sendMessage(
        {
          body: messsage,
          mentions: [{ tag: name, id: senderID }],
          attachment: fs.createReadStream(pathOut)
        },
        event.threadID,
        () => { try { fs.unlinkSync(pathOut); } catch (_) {} }
      );

    } catch (err) {
      console.error("[rankup] Error:", err.message);
      console.error(err.stack);
      // Fallback: text only
      api.sendMessage(
        { body: messsage, mentions: [{ tag: name, id: senderID }] },
        event.threadID
      );
    }
  }

  await Currencies.setData(senderID, { exp });
  return;
};

// ── Theme Drawers ─────────────────────────────────────────────────────────

function drawRankupCard(ctx, W, H, theme, { name, level, exp }) {
  if      (theme === "galaxy") drawGalaxy(ctx, W, H, name, level, exp);
  else if (theme === "cyber")  drawCyber(ctx, W, H, name, level, exp);
  else if (theme === "fire")   drawFire(ctx, W, H, name, level, exp);
  else if (theme === "ocean")  drawOcean(ctx, W, H, name, level, exp);
}

// ── THEME 1: Galaxy / Space ────────────────────────────────────────────────
function drawGalaxy(ctx, W, H, name, level, exp) {
  const bg = ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,"#020614"); bg.addColorStop(0.5,"#0a0828");
  bg.addColorStop(0.75,"#110535"); bg.addColorStop(1,"#1a0a10");
  ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);

  // Stars
  for (let i = 0; i < 80; i++) {
    const sx = Math.random()*W, sy = Math.random()*H;
    ctx.fillStyle = `rgba(255,255,255,${Math.random()*0.7+0.2})`;
    ctx.beginPath(); ctx.arc(sx, sy, Math.random()*1.5+0.3, 0, Math.PI*2); ctx.fill();
  }
  // Nebula
  for (const [cx,cy,r,c] of [[650,80,160,"rgba(100,0,200,0.18)"],[720,260,140,"rgba(0,80,200,0.14)"],[100,200,180,"rgba(20,0,120,0.20)"]]) {
    const rg = ctx.createRadialGradient(cx,cy,0,cx,cy,r);
    rg.addColorStop(0,c); rg.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
  }
  // Border
  const bG = ctx.createLinearGradient(0,0,W,H);
  bG.addColorStop(0,"#a855f7"); bG.addColorStop(0.5,"#06b6d4"); bG.addColorStop(1,"#ec4899");
  ctx.strokeStyle=bG; ctx.lineWidth=3;
  roundRect(ctx,4,4,W-8,H-8,20); ctx.stroke();

  _drawRightContent(ctx, W, H, name, level, exp,
    { label:"✦  RANK UP!  ✦", labelColor:"rgba(200,150,255,0.8)",
      nameC1:"#e879f9", nameC2:"#a5b4fc", nameC3:"#67e8f9",
      levelColor:"rgba(200,200,255,0.7)",
      lvlC1:"#f0abfc", lvlC2:"#67e8f9",
      barC1:"#a855f7", barC2:"#6366f1", barC3:"#06b6d4",
      lineC:"rgba(168,85,247,0.8)",
      expColor:"rgba(150,150,220,0.75)", subColor:"rgba(200,200,255,0.55)" });
}

// ── THEME 2: Cyber / Neon ──────────────────────────────────────────────────
function drawCyber(ctx, W, H, name, level, exp) {
  const bg = ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,"#000d0a"); bg.addColorStop(0.5,"#001a10");
  bg.addColorStop(1,"#000d1a");
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

  // Grid lines
  ctx.strokeStyle="rgba(0,255,140,0.06)"; ctx.lineWidth=1;
  for (let x=0; x<W; x+=40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y=0; y<H; y+=40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  // Glows
  for (const [cx,cy,r,c] of [[700,50,150,"rgba(0,255,140,0.12)"],[750,280,120,"rgba(0,180,255,0.10)"],[80,160,160,"rgba(0,255,80,0.08)"]]) {
    const rg=ctx.createRadialGradient(cx,cy,0,cx,cy,r);
    rg.addColorStop(0,c); rg.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
  }
  // Corner brackets
  ctx.strokeStyle="#00ff88"; ctx.lineWidth=2;
  const bLen=30;
  [[8,8],[W-8,8],[8,H-8],[W-8,H-8]].forEach(([cx,cy],i) => {
    const sx = i%2===0?1:-1, sy = i<2?1:-1;
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+sx*bLen,cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx,cy+sy*bLen); ctx.stroke();
  });
  // Scan line
  const scan=ctx.createLinearGradient(0,H*0.4,0,H*0.6);
  scan.addColorStop(0,"rgba(0,255,140,0)");
  scan.addColorStop(0.5,"rgba(0,255,140,0.04)");
  scan.addColorStop(1,"rgba(0,255,140,0)");
  ctx.fillStyle=scan; ctx.fillRect(0,H*0.4,W,H*0.2);

  _drawRightContent(ctx,W,H,name,level,exp,
    { label:"✦  RANK UP!  ✦", labelColor:"rgba(0,255,140,0.8)",
      nameC1:"#00ff88", nameC2:"#00ffcc", nameC3:"#00bfff",
      levelColor:"rgba(0,255,140,0.7)",
      lvlC1:"#00ffb4", lvlC2:"#00bfff",
      barC1:"#00ff88", barC2:"#00cc66", barC3:"#00bfff",
      lineC:"rgba(0,255,140,0.6)",
      expColor:"rgba(0,220,140,0.75)", subColor:"rgba(0,255,140,0.45)" });
}

// ── THEME 3: Fire / Lava ───────────────────────────────────────────────────
function drawFire(ctx, W, H, name, level, exp) {
  const bg=ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,"#0d0100"); bg.addColorStop(0.4,"#1a0500");
  bg.addColorStop(0.75,"#200800"); bg.addColorStop(1,"#150300");
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

  // Ember particles
  for (let i=0; i<60; i++) {
    const ex=Math.random()*W, ey=Math.random()*H;
    const er=Math.random()*2+0.5;
    const alpha=Math.random()*0.8+0.2;
    const colors=["rgba(255,100,0,","rgba(255,200,0,","rgba(255,50,0,"];
    ctx.fillStyle=colors[Math.floor(Math.random()*3)]+alpha+")";
    ctx.beginPath(); ctx.arc(ex,ey,er,0,Math.PI*2); ctx.fill();
  }
  // Fire glow
  for (const [cx,cy,r,c] of [[400,H,250,"rgba(255,80,0,0.20)"],[200,H,200,"rgba(255,40,0,0.15)"],[650,H,180,"rgba(255,120,0,0.12)"],[W/2,0,150,"rgba(100,0,0,0.15)"]]) {
    const rg=ctx.createRadialGradient(cx,cy,0,cx,cy,r);
    rg.addColorStop(0,c); rg.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
  }
  // Border
  const bG=ctx.createLinearGradient(0,0,W,H);
  bG.addColorStop(0,"#ff6600"); bG.addColorStop(0.5,"#ffaa00"); bG.addColorStop(1,"#ff3300");
  ctx.strokeStyle=bG; ctx.lineWidth=3;
  roundRect(ctx,4,4,W-8,H-8,20); ctx.stroke();

  _drawRightContent(ctx,W,H,name,level,exp,
    { label:"✦  RANK UP!  ✦", labelColor:"rgba(255,180,0,0.9)",
      nameC1:"#ff6600", nameC2:"#ffaa00", nameC3:"#ff3300",
      levelColor:"rgba(255,160,0,0.8)",
      lvlC1:"#ffcc00", lvlC2:"#ff6600",
      barC1:"#ff3300", barC2:"#ff6600", barC3:"#ffaa00",
      lineC:"rgba(255,100,0,0.7)",
      expColor:"rgba(255,160,80,0.75)", subColor:"rgba(255,140,60,0.55)" });
}

// ── THEME 4: Ocean / Deep Sea ──────────────────────────────────────────────
function drawOcean(ctx, W, H, name, level, exp) {
  const bg=ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,"#000d1a"); bg.addColorStop(0.5,"#001428");
  bg.addColorStop(1,"#001f35");
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

  // Bubbles
  for (let i=0; i<40; i++) {
    const bx=Math.random()*W, by=Math.random()*H, br=Math.random()*3+1;
    ctx.strokeStyle=`rgba(0,191,255,${Math.random()*0.4+0.1})`;
    ctx.lineWidth=0.8;
    ctx.beginPath(); ctx.arc(bx,by,br,0,Math.PI*2); ctx.stroke();
  }
  // Wave overlay
  ctx.strokeStyle="rgba(0,191,255,0.06)"; ctx.lineWidth=40;
  for (let i=0; i<3; i++) {
    ctx.beginPath();
    ctx.moveTo(0, H*0.3 + i*80);
    for (let x=0; x<=W; x+=60) ctx.quadraticCurveTo(x+30, H*0.3+i*80-(i%2===0?20:-20), x+60, H*0.3+i*80);
    ctx.stroke();
  }
  // Glow
  for (const [cx,cy,r,c] of [[W/2,H,220,"rgba(0,100,255,0.18)"],[100,100,160,"rgba(0,191,255,0.12)"],[700,200,140,"rgba(0,150,200,0.10)"]]) {
    const rg=ctx.createRadialGradient(cx,cy,0,cx,cy,r);
    rg.addColorStop(0,c); rg.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
  }
  // Border
  const bG=ctx.createLinearGradient(0,0,W,H);
  bG.addColorStop(0,"#00bfff"); bG.addColorStop(0.5,"#0080ff"); bG.addColorStop(1,"#00e5ff");
  ctx.strokeStyle=bG; ctx.lineWidth=3;
  roundRect(ctx,4,4,W-8,H-8,20); ctx.stroke();

  _drawRightContent(ctx,W,H,name,level,exp,
    { label:"✦  RANK UP!  ✦", labelColor:"rgba(0,220,255,0.8)",
      nameC1:"#00bfff", nameC2:"#67e8f9", nameC3:"#0080ff",
      levelColor:"rgba(0,210,255,0.75)",
      lvlC1:"#67e8f9", lvlC2:"#0080ff",
      barC1:"#0080ff", barC2:"#00bfff", barC3:"#67e8f9",
      lineC:"rgba(0,191,255,0.6)",
      expColor:"rgba(0,200,255,0.7)", subColor:"rgba(100,220,255,0.5)" });
}

// ── Shared right-side content renderer ────────────────────────────────────
function _drawRightContent(ctx, W, H, name, level, exp, c) {
  const RX = 300;
  const nextLevelExp = Math.pow(level+1,2)*3/4;
  const curLevelExp  = Math.pow(level,2)*3/4;
  const progress     = Math.min((exp-curLevelExp)/(nextLevelExp-curLevelExp)||0, 1);

  // Label
  ctx.font="bold 13px sans-serif"; ctx.fillStyle=c.labelColor;
  ctx.textAlign="left"; ctx.fillText(c.label, RX, 65);

  // Name gradient
  const displayName = name.length>20 ? name.slice(0,20)+"..." : name;
  ctx.font="bold 36px sans-serif";
  const nG=ctx.createLinearGradient(RX,0,RX+420,0);
  nG.addColorStop(0,c.nameC1); nG.addColorStop(0.5,c.nameC2); nG.addColorStop(1,c.nameC3);
  ctx.fillStyle=nG; ctx.fillText(displayName, RX, 112);

  // Separator
  const lG=ctx.createLinearGradient(RX,0,RX+460,0);
  lG.addColorStop(0,c.lineC); lG.addColorStop(1,"rgba(0,0,0,0)");
  ctx.strokeStyle=lG; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(RX,126); ctx.lineTo(W-20,126); ctx.stroke();

  // Level
  ctx.font="bold 20px sans-serif"; ctx.fillStyle=c.levelColor;
  ctx.fillText("LEVEL", RX, 168);
  ctx.font="bold 60px sans-serif";
  const lvG=ctx.createLinearGradient(RX+80,0,RX+200,0);
  lvG.addColorStop(0,c.lvlC1); lvG.addColorStop(1,c.lvlC2);
  ctx.fillStyle=lvG; ctx.fillText(String(level), RX+82, 170);

  // EXP
  ctx.font="13px sans-serif"; ctx.fillStyle=c.expColor;
  ctx.fillText(`Total EXP: ${exp}`, RX, 200);

  // Bar
  const barX=RX, barY=218, barW=W-RX-24, barH=16;
  ctx.fillStyle="rgba(255,255,255,0.07)";
  roundRect(ctx,barX,barY,barW,barH,8); ctx.fill();
  const fillW=Math.max(progress*barW,16);
  const bG=ctx.createLinearGradient(barX,0,barX+fillW,0);
  bG.addColorStop(0,c.barC1); bG.addColorStop(0.5,c.barC2); bG.addColorStop(1,c.barC3);
  ctx.fillStyle=bG; roundRect(ctx,barX,barY,fillW,barH,8); ctx.fill();
  ctx.fillStyle="rgba(255,255,255,0.15)";
  roundRect(ctx,barX,barY+1,fillW,5,3); ctx.fill();

  // Progress label
  ctx.font="11px sans-serif"; ctx.fillStyle=c.expColor;
  ctx.textAlign="left";
  ctx.fillText(`To next level: ${Math.round(progress*100)}%`, RX, barY-4);
  ctx.textAlign="right";
  ctx.fillText(`${Math.ceil(nextLevelExp-exp)} XP needed`, W-24, barY-4);
  ctx.textAlign="left";

  // Sub text
  ctx.font="13px sans-serif"; ctx.fillStyle=c.subColor;
  ctx.fillText(`Congratulations! Keep going to level ${level+1}!`, RX, 262);

  // Sparkles
  for (const [sx,sy] of [[RX+10,48],[RX+200,44],[RX+340,52],[RX+440,46]])
    drawSparkle(ctx,sx,sy,5,"rgba(255,255,255,0.5)");
}

// ── Utilities ──────────────────────────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);       ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
  ctx.lineTo(x + w, y + h - r);   ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);       ctx.quadraticCurveTo(x, y + h,     x, y + h - r);
  ctx.lineTo(x, y + r);           ctx.quadraticCurveTo(x, y,         x + r, y);
  ctx.closePath();
}

function drawSparkle(ctx, x, y, size, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth   = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, y - size); ctx.lineTo(x, y + size);
  ctx.moveTo(x - size, y); ctx.lineTo(x + size, y);
  ctx.moveTo(x - size * 0.6, y - size * 0.6); ctx.lineTo(x + size * 0.6, y + size * 0.6);
  ctx.moveTo(x + size * 0.6, y - size * 0.6); ctx.lineTo(x - size * 0.6, y + size * 0.6);
  ctx.stroke();
}

// ── Languages ──────────────────────────────────────────────────────────────

module.exports.languages = {
  "en": {
    "on":          "on",
    "off":         "off",
    "successText": "successfully toggled rankup notification!",
    "levelup":     "{name}, your level has increased to level {level} 🎉"
  }
};

// ── Run: show rank card ───────────────────────────────────────────────────

module.exports.run = async function ({ api, event, Currencies, Users, Threads, args, getText }) {
  const { threadID, messageID, senderID } = event;
  const senderIDStr = String(senderID);

  // ── Toggle: "rank on" / "rank off" (admin only) ──
  if (args[0] && (args[0].toLowerCase() === "on" || args[0].toLowerCase() === "off")) {
    const adminList = [].concat(global.config.ADMINBOT || global.config.admin || []).map(String);
    if (!adminList.includes(senderIDStr)) {
      return api.sendMessage("❌ Only admin can toggle rankup notifications.", threadID, messageID);
    }
    let data = (await Threads.getData(threadID)).data;
    data["rankup"] = args[0].toLowerCase() === "on";
    await Threads.setData(threadID, { data });
    global.data.threadData.set(threadID, data);
    return api.sendMessage(
      `${data["rankup"] ? getText("on") : getText("off")} ${getText("successText")}`,
      threadID, messageID
    );
  }

  // ── "rank theme" — show all 4 themes (admin only) ──
  if (args[0] && args[0].toLowerCase() === "theme") {
    const adminList = [].concat(global.config.ADMINBOT || global.config.admin || []).map(String);
    if (!adminList.includes(senderIDStr)) {
      return api.sendMessage("❌ Only admin can preview rank themes.", threadID, messageID);
    }

    const { loadImage, createCanvas } = require("canvas");
    const fs    = global.nodemodule["fs-extra"];
    const axios = global.nodemodule["axios"];
    const path  = require("path");

    try {
      const exp   = (await Currencies.getData(senderID)).exp || 100;
      const level = Math.floor(Math.sqrt(1 + (4 * exp / 3) + 1) / 2) || 5;
      const name  = global.data.userName.get(senderID) || await Users.getNameUser(senderID);

      const cacheDir = path.join(__dirname, "cache");
      fs.ensureDirSync(cacheDir);
      const pathAvt = path.join(cacheDir, `theme_avt_${senderID}.png`);

      const avtData = (await axios.get(
        `https://graph.facebook.com/${senderID}/picture?width=512&height=512&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`,
        { responseType: "arraybuffer" }
      )).data;
      fs.writeFileSync(pathAvt, Buffer.from(avtData));

      const avtImg   = await loadImage(pathAvt);
      const allThemes = ["galaxy", "cyber", "fire", "ocean"];
      const themeLabels = {
        galaxy: "🌌 Galaxy",
        cyber:  "💻 Cyber",
        fire:   "🔥 Fire",
        ocean:  "🌊 Ocean",
      };
      const attachments = [];

      for (const theme of allThemes) {
        const W = 800, H = 340;
        const canvas = createCanvas(W, H);
        const ctx    = canvas.getContext("2d");

        drawRankupCard(ctx, W, H, theme, { name, level, exp });

        // Avatar
        const avtX = 155, avtY = H / 2, avtR = 110;
        const themeColors = {
          galaxy: { ring: "#a855f7", badge: "#1a0a30", badgeBorder: "#a855f7", badgeText: "#e879f9" },
          cyber:  { ring: "#00ff88", badge: "#001a0a", badgeBorder: "#00ff88", badgeText: "#00ffb4" },
          fire:   { ring: "#ff6600", badge: "#1a0500", badgeBorder: "#ff6600", badgeText: "#ffaa00" },
          ocean:  { ring: "#00bfff", badge: "#00081a", badgeBorder: "#00bfff", badgeText: "#67e8f9" },
        };
        const tc = themeColors[theme];

        const ringG = ctx.createRadialGradient(avtX,avtY,avtR-10,avtX,avtY,avtR+20);
        ringG.addColorStop(0, tc.ring+"99"); ringG.addColorStop(1,"rgba(0,0,0,0)");
        ctx.fillStyle=ringG;
        ctx.beginPath(); ctx.arc(avtX,avtY,avtR+20,0,Math.PI*2); ctx.fill();

        ctx.strokeStyle=tc.ring+"80"; ctx.lineWidth=2; ctx.setLineDash([8,6]);
        ctx.beginPath(); ctx.arc(avtX,avtY,avtR+8,0,Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);

        ctx.save();
        ctx.beginPath(); ctx.arc(avtX,avtY,avtR,0,Math.PI*2); ctx.clip();
        ctx.drawImage(avtImg,avtX-avtR,avtY-avtR,avtR*2,avtR*2);
        ctx.restore();

        ctx.strokeStyle=tc.ring; ctx.lineWidth=4;
        ctx.beginPath(); ctx.arc(avtX,avtY,avtR,0,Math.PI*2); ctx.stroke();

        const bdX=avtX+avtR*0.65, bdY=avtY+avtR*0.65;
        ctx.fillStyle=tc.badge; ctx.strokeStyle=tc.badgeBorder; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.arc(bdX,bdY,28,0,Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.font="bold 14px sans-serif"; ctx.fillStyle=tc.badgeText;
        ctx.textAlign="center"; ctx.fillText("LVL",bdX,bdY-4);
        ctx.font="bold 18px sans-serif"; ctx.fillStyle="#ffffff";
        ctx.fillText(String(level),bdX,bdY+16); ctx.textAlign="left";

        const outPath = path.join(cacheDir, `theme_${theme}_${Date.now()}.png`);
        fs.writeFileSync(outPath, canvas.toBuffer("image/png"));
        attachments.push({ path: outPath, label: themeLabels[theme] });
      }

      try { fs.removeSync(pathAvt); } catch (_) {}

      // Send all 4 one by one with label
      for (const att of attachments) {
        await new Promise((resolve) => {
          api.sendMessage(
            { body: att.label, attachment: fs.createReadStream(att.path) },
            threadID,
            () => { try { fs.unlinkSync(att.path); } catch (_) {} resolve(); }
          );
        });
      }

    } catch (err) {
      console.error("[rank theme] Error:", err.message);
      api.sendMessage("❌ Could not generate theme preview.", threadID, messageID);
    }
    return;
  }

  // ── Show rank card ──
  const { loadImage, createCanvas } = require("canvas");
  const fs    = global.nodemodule["fs-extra"];
  const axios = global.nodemodule["axios"];
  const path  = require("path");

  try {
    const exp   = (await Currencies.getData(senderID)).exp || 0;
    const level = Math.floor(Math.sqrt(1 + (4 * exp / 3) + 1) / 2);
    const name  = global.data.userName.get(senderID) || await Users.getNameUser(senderID);

    const nextLevelExp = Math.pow(level + 1, 2) * 3 / 4;
    const curLevelExp  = Math.pow(level, 2) * 3 / 4;
    const progress     = Math.min((exp - curLevelExp) / (nextLevelExp - curLevelExp), 1);

    // Rotate theme each call: senderID last digit + seconds bucket so it changes fast
    const themes2 = ["galaxy", "cyber", "fire", "ocean"];
    const secBucket = Math.floor(Date.now() / 15000); // changes every 15 seconds
    const rankTheme = themes2[(parseInt(String(senderID).slice(-2), 10) + secBucket) % themes2.length];

    const cacheDir = path.join(__dirname, "cache");
    fs.ensureDirSync(cacheDir);
    const pathAvt = path.join(cacheDir, `rank_avt_${senderID}.png`);
    const pathOut = path.join(cacheDir, `rank_${senderID}_${Date.now()}.png`);

    const avtData = (await axios.get(
      `https://graph.facebook.com/${senderID}/picture?width=512&height=512&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`,
      { responseType: "arraybuffer" }
    )).data;
    fs.writeFileSync(pathAvt, Buffer.from(avtData));

    const W = 800, H = 340;
    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext("2d");

    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0,    "#020614");
    bgGrad.addColorStop(0.4,  "#0a0828");
    bgGrad.addColorStop(0.75, "#110535");
    bgGrad.addColorStop(1,    "#1a0a10");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Stars
    const starPos = [
      [60,20],[120,60],[200,15],[280,45],[350,10],[430,55],[510,20],
      [590,40],[660,12],[730,50],[780,25],[40,90],[150,110],[240,80],
      [320,120],[400,85],[480,115],[560,75],[640,100],[720,80],[770,110],
      [100,150],[180,170],[260,140],[340,175],[420,145],[500,165],[580,150],
      [660,170],[740,140],[70,200],[160,220],[250,195],[330,215],[410,200],
      [490,225],[570,205],[650,220],[730,195],[780,215],[50,260],[140,280],
      [220,250],[300,275],[380,255],[460,270],[540,250],[620,275],[700,255],
    ];
    for (const [sx, sy] of starPos) {
      const r   = Math.random() * 1.5 + 0.3;
      const opc = Math.random() * 0.7 + 0.3;
      ctx.fillStyle = `rgba(255,255,255,${opc})`;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
    }

    // Nebula glows
    for (const [cx, cy, r, c] of [
      [650,  80, 160, "rgba(100,0,200,0.18)"],
      [720, 260, 140, "rgba(0,80,200,0.14)"],
      [100, 200, 180, "rgba(20,0,120,0.20)"],
      [550, 170, 120, "rgba(200,0,100,0.10)"],
    ]) {
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      rg.addColorStop(0, c); rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    }

    // Border
    const bGrad = ctx.createLinearGradient(0, 0, W, H);
    bGrad.addColorStop(0,    "#a855f7");
    bGrad.addColorStop(0.33, "#6366f1");
    bGrad.addColorStop(0.66, "#06b6d4");
    bGrad.addColorStop(1,    "#ec4899");
    ctx.strokeStyle = bGrad; ctx.lineWidth = 3;
    roundRect(ctx, 4, 4, W - 8, H - 8, 20); ctx.stroke();

    // Avatar
    const avtX = 155, avtY = H / 2, avtR = 110;
    const ringGrad = ctx.createRadialGradient(avtX, avtY, avtR - 10, avtX, avtY, avtR + 20);
    ringGrad.addColorStop(0, "rgba(168,85,247,0.6)");
    ringGrad.addColorStop(1, "rgba(168,85,247,0)");
    ctx.fillStyle = ringGrad;
    ctx.beginPath(); ctx.arc(avtX, avtY, avtR + 20, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = "rgba(168,85,247,0.5)";
    ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.arc(avtX, avtY, avtR + 8, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);

    ctx.save();
    ctx.beginPath(); ctx.arc(avtX, avtY, avtR, 0, Math.PI * 2); ctx.clip();
    const avtImg = await loadImage(pathAvt);
    ctx.drawImage(avtImg, avtX - avtR, avtY - avtR, avtR * 2, avtR * 2);
    ctx.restore();

    ctx.strokeStyle = "#a855f7"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(avtX, avtY, avtR, 0, Math.PI * 2); ctx.stroke();

    // Level badge
    const bdX = avtX + avtR * 0.65, bdY = avtY + avtR * 0.65;
    ctx.fillStyle = "#1a0a30"; ctx.strokeStyle = "#a855f7"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(bdX, bdY, 28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.font = "bold 14px sans-serif"; ctx.fillStyle = "#e879f9";
    ctx.textAlign = "center";
    ctx.fillText("LVL", bdX, bdY - 4);
    ctx.font = "bold 18px sans-serif"; ctx.fillStyle = "#ffffff";
    ctx.fillText(String(level), bdX, bdY + 16);

    // Right content
    const RX = 300;
    ctx.font = "bold 13px sans-serif";
    ctx.fillStyle = "rgba(200,150,255,0.8)";
    ctx.textAlign = "left";
    ctx.fillText("✦  YOUR RANK CARD  ✦", RX, 65);

    const displayName = name.length > 20 ? name.slice(0, 20) + "..." : name;
    ctx.font = "bold 36px sans-serif";
    const nameGrad = ctx.createLinearGradient(RX, 0, RX + 420, 0);
    nameGrad.addColorStop(0, "#e879f9");
    nameGrad.addColorStop(0.5, "#a5b4fc");
    nameGrad.addColorStop(1, "#67e8f9");
    ctx.fillStyle = nameGrad;
    ctx.fillText(displayName, RX, 112);

    const lineG = ctx.createLinearGradient(RX, 0, RX + 460, 0);
    lineG.addColorStop(0, "rgba(168,85,247,0.8)");
    lineG.addColorStop(1, "rgba(6,182,212,0)");
    ctx.strokeStyle = lineG; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(RX, 126); ctx.lineTo(W - 20, 126); ctx.stroke();

    ctx.font = "bold 20px sans-serif";
    ctx.fillStyle = "rgba(200,200,255,0.7)";
    ctx.fillText("LEVEL", RX, 168);

    ctx.font = "bold 60px sans-serif";
    const lvlGrad = ctx.createLinearGradient(RX + 80, 0, RX + 200, 0);
    lvlGrad.addColorStop(0, "#f0abfc");
    lvlGrad.addColorStop(1, "#67e8f9");
    ctx.fillStyle = lvlGrad;
    ctx.fillText(String(level), RX + 82, 170);

    ctx.font = "13px sans-serif";
    ctx.fillStyle = "rgba(150,150,220,0.75)";
    ctx.fillText(`Total EXP: ${exp}`, RX, 200);

    // Progress bar
    const barX = RX, barY = 218, barW = W - RX - 24, barH = 16;
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    roundRect(ctx, barX, barY, barW, barH, 8); ctx.fill();

    const fillW = Math.max(progress * barW, 16);
    const barFill = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
    barFill.addColorStop(0, "#a855f7");
    barFill.addColorStop(0.5, "#6366f1");
    barFill.addColorStop(1, "#06b6d4");
    ctx.fillStyle = barFill;
    roundRect(ctx, barX, barY, fillW, barH, 8); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    roundRect(ctx, barX, barY + 1, fillW, 5, 3); ctx.fill();

    ctx.font = "11px sans-serif";
    ctx.fillStyle = "rgba(180,180,255,0.65)";
    ctx.textAlign = "left";
    ctx.fillText(`To next level: ${Math.round(progress * 100)}%`, RX, barY - 4);
    ctx.textAlign = "right";
    ctx.fillText(`${Math.ceil(nextLevelExp - exp)} XP needed`, W - 24, barY - 4);
    ctx.textAlign = "left";

    ctx.font = "13px sans-serif";
    ctx.fillStyle = "rgba(200,200,255,0.55)";
    ctx.fillText(`Next level: ${level + 1}  |  EXP needed: ${Math.ceil(nextLevelExp - exp)}`, RX, 258);

    for (const [sx, sy] of [[RX+10,48],[RX+190,44],[RX+330,52],[RX+430,46]]) {
      drawSparkle(ctx, sx, sy, 5, "rgba(255,200,255,0.7)");
    }

    fs.writeFileSync(pathOut, canvas.toBuffer("image/png"));
    try { fs.removeSync(pathAvt); } catch (_) {}

    api.sendMessage(
      { body: `${name}'s Rank Card`, attachment: fs.createReadStream(pathOut) },
      threadID,
      () => { try { fs.unlinkSync(pathOut); } catch (_) {} },
      messageID
    );

  } catch (err) {
    console.error("[rank] Error:", err.message);
    api.sendMessage("❌ Could not generate rank card.", threadID, messageID);
  }
};
