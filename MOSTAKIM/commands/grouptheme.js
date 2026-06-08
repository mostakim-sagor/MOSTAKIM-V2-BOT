const fs          = require("fs-extra");
const path        = require("path");
const axios       = require("axios");
const { createCanvas, loadImage } = require("canvas");
const googlethis  = require("googlethis");

module.exports.config = {
  name:            "grouptheme",
  aliases:         ["gtheme", "theme", "chattheme"],
  version:         "6.0.0",
  hasPermssion:    0,
  credits:         "MOSTAKIM",
  description:     "Keyword দিলে 5টি theme preview দেখাবে, reply দিয়ে set করো",
  commandCategory: "group",
  usages:          "grouptheme <keyword>",
  cooldowns:       10,
};

// ══════════════════════════════════════════════════════════════════
// THEME DATABASE
// ══════════════════════════════════════════════════════════════════
const THEME_DB = [
  { id: "538280997628317",  name: "Doctor Strange",  category: "Movies",  tags: ["doctor strange","strange","marvel","magic","wizard","wanda","loki"] },
  { id: "1438011086532622", name: "Star Wars",       category: "Movies",  tags: ["star wars","jedi","sith","lightsaber","yoda","darth"] },
  { id: "101275642962533",  name: "Guardians",       category: "Movies",  tags: ["guardian","galaxy","groot","rocket","gamora","avengers","marvel","thanos","endgame"] },
  { id: "780962576430091",  name: "Cyberpunk",       category: "Movies",  tags: ["cyberpunk","cyber","neon","futuristic","sci-fi","robot","batman","gotham"] },
  { id: "1059859811490132", name: "Stranger Things", category: "Movies",  tags: ["stranger things","eleven","hawkins","demogorgon"] },
  { id: "1455149831518874", name: "Dune",            category: "Movies",  tags: ["dune","desert","paul","arrakis","spice"] },
  { id: "196241301102133",  name: "Default Blue",    category: "Colors",  tags: ["default","blue","messenger","facebook"] },
  { id: "2129984390566328", name: "Red",             category: "Colors",  tags: ["red","iron man","ironman","blood","fire","hot","danger","spider man","spiderman","deadpool","flash","superman","captain america","wolverine","wanda","scarlet witch","ant man"] },
  { id: "169463077092846",  name: "Hot Pink",        category: "Colors",  tags: ["pink","hot pink","barbie","cute","girl"] },
  { id: "2442142322678320", name: "Aqua Blue",       category: "Colors",  tags: ["aqua","sky","light blue","baby blue"] },
  { id: "234137870477637",  name: "Bright Purple",   category: "Colors",  tags: ["purple","violet","grape","royal","witch"] },
  { id: "980963458735625",  name: "Coral Pink",      category: "Colors",  tags: ["coral","salmon","peach pink"] },
  { id: "175615189761153",  name: "Orange",          category: "Colors",  tags: ["orange","halloween","naruto"] },
  { id: "2136751179887052", name: "Green",           category: "Colors",  tags: ["green","nature","forest","hulk","money","grass"] },
  { id: "2058653964378557", name: "Lavender Purple", category: "Colors",  tags: ["lavender","lilac","soft purple"] },
  { id: "174636906462322",  name: "Yellow",          category: "Colors",  tags: ["yellow","gold","sun","pikachu","banana","bright","thor","lightning","asgard","avengers","loki","hulk","black panther"] },
  { id: "1928399724138152", name: "Teal Blue",       category: "Colors",  tags: ["teal","cyan","turquoise"] },
  { id: "788274591712841",  name: "Monochrome",      category: "Colors",  tags: ["monochrome","black","white","dark","shadow","minimal","gothic"] },
  { id: "736591620215564",  name: "Ocean",           category: "Nature",  tags: ["ocean","sea","water","beach","wave","marine"] },
  { id: "822549609168155",  name: "Autumn",          category: "Nature",  tags: ["autumn","fall","leaf","maple","orange leaves"] },
  { id: "539927563794799",  name: "Cottagecore",     category: "Nature",  tags: ["cottage","cottagecore","forest","cozy","aesthetic","nature"] },
  { id: "390127158985345",  name: "Chill Winter",    category: "Nature",  tags: ["chill","cool","relax","freeze","winter","cold","ice"] },
  { id: "930060997172551",  name: "Mango",           category: "Nature",  tags: ["mango","tropical","summer","fruit"] },
  { id: "370940413392601",  name: "Citrus",          category: "Nature",  tags: ["citrus","lemon","lime","fresh"] },
  { id: "262191918210707",  name: "Tropical",        category: "Nature",  tags: ["tropical","palm","island","hawaii","beach"] },
  { id: "1833559466821043", name: "Earth",           category: "Nature",  tags: ["earth","world","planet","global"] },
  { id: "3022526817824329", name: "Peach",           category: "Nature",  tags: ["peach","soft","warm","pastel"] },
  { id: "672058580051520",  name: "Honey",           category: "Nature",  tags: ["honey","bee","golden","warm"] },
  { id: "2533652183614000", name: "Maple",           category: "Nature",  tags: ["maple","canada","autumn","fall","leaf"] },
  { id: "3151463484918004", name: "Kiwi",            category: "Nature",  tags: ["kiwi","green","fresh","fruit"] },
  { id: "741311439775765",  name: "Love",            category: "Romance", tags: ["love","heart","valentine","romance","couple"] },
  { id: "1257453361255152", name: "Rose",            category: "Romance", tags: ["rose","flower","romantic","red flower"] },
  { id: "571193503540759",  name: "Lavender",        category: "Romance", tags: ["lavender flower","purple flower","soft"] },
  { id: "2873642949430623", name: "Tulip",           category: "Romance", tags: ["tulip","flower","bloom","spring"] },
  { id: "158263147151440",  name: "Bloom",           category: "Romance", tags: ["bloom","blossom","flower","spring","floral"] },
  { id: "273728810607574",  name: "Unicorn",         category: "Romance", tags: ["unicorn","rainbow","magical","pastel","dreamy"] },
  { id: "769129927636836",  name: "Taylor Swift",    category: "Music",   tags: ["taylor","swift","eras","swiftie"] },
  { id: "339021464972092",  name: "Music",           category: "Music",   tags: ["music","song","band","concert","melody","beat"] },
  { id: "1060619084701625", name: "Lo-Fi",           category: "Music",   tags: ["lofi","lo-fi","chill","study","relax","calm","vibe"] },
  { id: "1652456634878319", name: "Pride",           category: "Music",   tags: ["pride","lgbtq","rainbow","inclusive"] },
  { id: "6026716157422736", name: "Basketball",      category: "Sports",  tags: ["basketball","nba","sport","ball","hoop"] },
  { id: "627144732056021",  name: "Celebration",     category: "Party",   tags: ["celebration","party","birthday","happy","fun","event"] },
  { id: "621630955405500",  name: "Birthday",        category: "Party",   tags: ["birthday","bday","cake","age","birth"] },
  { id: "357833546030778",  name: "Festival",        category: "Party",   tags: ["lunar","new year","chinese","dragon","eid","festival"] },
  { id: "195296273246380",  name: "Bubble Tea",      category: "Food",    tags: ["bubble tea","boba","tea","milk tea","kawaii"] },
  { id: "193497045377796",  name: "Grape",           category: "Food",    tags: ["grape","purple fruit","wine"] },
  { id: "280333826736184",  name: "Lollipop",        category: "Food",    tags: ["lollipop","candy","sweet","colorful","kids"] },
  { id: "205488546921017",  name: "Candy",           category: "Food",    tags: ["candy","sweet","sugar","cute","pastel"] },
  { id: "909695489504566",  name: "Sushi",           category: "Food",    tags: ["sushi","japanese","japan","anime","food"] },
  { id: "582065306070020",  name: "Rocket",          category: "Space",   tags: ["rocket","space","nasa","astronaut","cosmos","moon","star"] },
  { id: "3190514984517598", name: "Sky",             category: "Space",   tags: ["sky","cloud","heaven","blue sky","air"] },
  { id: "164535220883264",  name: "Berry Indigo",    category: "Space",   tags: ["berry","blueberry","dark blue","indigo"] },
  { id: "3273938616164733", name: "Classic",         category: "Classic", tags: ["classic","vintage","retro","old school"] },
  { id: "271607034185782",  name: "Shadow",          category: "Classic", tags: ["shadow","dark","night","black","mysterious"] },
  { id: "3259963564026002", name: "Default Reset",   category: "Classic", tags: ["default","reset","original","normal","plain","white"] },
  { id: "365557122117011",  name: "Support",         category: "Classic", tags: ["support","help","care","mental health","together"] },
  { id: "810978360551741",  name: "Parenthood",      category: "Classic", tags: ["family","parent","child","baby","home"] },
  { id: "230032715012014",  name: "Tie Dye",         category: "Classic", tags: ["tie dye","tiedye","rainbow","colorful","hippie"] },
];

// ══════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════
function findMatches(query, limit) {
  const q = query.toLowerCase().trim();
  const scored = [];
  for (const t of THEME_DB) {
    let score = 0;
    for (const tag of t.tags) {
      if (tag === q)                                score += 10;
      else if (tag.includes(q) || q.includes(tag)) score += 6;
      else {
        for (const w of q.split(/\s+/))
          if (w.length > 2 && tag.includes(w))     score += 3;
      }
    }
    if (score > 0) scored.push({ ...t, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit || 5);
}

async function applyTheme(api, threadID, themeId) {
  if (typeof api.setThreadTheme === "function") {
    return new Promise((resolve, reject) =>
      api.setThreadTheme(threadID, themeId, err => err ? reject(err) : resolve())
    );
  }
  if (typeof api.changeThreadColor === "function") {
    return new Promise((resolve, reject) =>
      api.changeThreadColor(themeId, threadID, err => err ? reject(err) : resolve())
    );
  }
  throw new Error("Theme API পাওয়া যায়নি। Bot-কে admin করো।");
}

// Color palettes per theme name / category
const THEME_COLORS = {
  // Movies
  "Doctor Strange":  ["#6B2D8B", "#2D1B69"],
  "Star Wars":       ["#1a0a00", "#8B6914"],
  "Guardians":       ["#1a1a2e", "#E94560"],
  "Cyberpunk":       ["#0D0D0D", "#00FFFF"],
  "Stranger Things": ["#0f0c29", "#CC2936"],
  "Dune":            ["#C8A96E", "#6B4226"],
  // Colors
  "Default Blue":    ["#0084FF", "#0050CC"],
  "Red":             ["#C0392B", "#8B0000"],
  "Hot Pink":        ["#FF69B4", "#C2185B"],
  "Aqua Blue":       ["#00C9FF", "#006994"],
  "Bright Purple":   ["#7B2FBE", "#4A0080"],
  "Coral Pink":      ["#FF6B6B", "#EE4D6C"],
  "Orange":          ["#FF6B35", "#E65C00"],
  "Green":           ["#11998E", "#38EF7D"],
  "Lavender Purple": ["#B39DDB", "#7B1FA2"],
  "Yellow":          ["#F7971E", "#FFD200"],
  "Teal Blue":       ["#009688", "#00BCD4"],
  "Monochrome":      ["#2C2C2C", "#757575"],
  // Nature
  "Ocean":           ["#1A6B8A", "#00C6FF"],
  "Autumn":          ["#D35400", "#F39C12"],
  "Cottagecore":     ["#5D8A5E", "#A8D5A2"],
  "Chill Winter":    ["#83A4D4", "#B6FBFF"],
  "Mango":           ["#F7971E", "#FFD200"],
  "Citrus":          ["#F9D423", "#FF4E50"],
  "Tropical":        ["#00B09B", "#96C93D"],
  "Earth":           ["#4B6746", "#8D6E63"],
  "Peach":           ["#FFCCBC", "#FF8A65"],
  "Honey":           ["#F6D365", "#FDA085"],
  "Maple":           ["#C0392B", "#E67E22"],
  "Kiwi":            ["#3D9970", "#01FF70"],
  // Romance
  "Love":            ["#FF4B6B", "#FF1744"],
  "Rose":            ["#E91E63", "#AD1457"],
  "Lavender":        ["#CE93D8", "#9C27B0"],
  "Tulip":           ["#F48FB1", "#E91E63"],
  "Bloom":           ["#FCB045", "#FD1D1D"],
  "Unicorn":         ["#A18CD1", "#FBC2EB"],
  // Music
  "Taylor Swift":    ["#B5A0D6", "#7B5EA7"],
  "Music":           ["#1DB954", "#191414"],
  "Lo-Fi":           ["#4A4E69", "#9A8C98"],
  "Pride":           ["#FF0000", "#9400D3"],
  // Sports
  "Basketball":      ["#E65C00", "#F9D423"],
  // Party
  "Celebration":     ["#F7971E", "#FFD200"],
  "Birthday":        ["#FF6CAB", "#7366FF"],
  "Festival":        ["#E94560", "#F5A623"],
  // Food
  "Bubble Tea":      ["#F48FB1", "#CE93D8"],
  "Grape":           ["#6A0572", "#AB47BC"],
  "Lollipop":        ["#FF6B9D", "#C44569"],
  "Candy":           ["#FFC0CB", "#FF69B4"],
  "Sushi":           ["#EF5350", "#FFCA28"],
  // Space
  "Rocket":          ["#0F0C29", "#302B63"],
  "Sky":             ["#56CCF2", "#2F80ED"],
  "Berry Indigo":    ["#1A237E", "#311B92"],
  // Classic
  "Classic":         ["#4A4A4A", "#232526"],
  "Shadow":          ["#0F2027", "#203A43"],
  "Default Reset":   ["#ECE9E6", "#FFFFFF"],
  "Support":         ["#56AB2F", "#A8E063"],
  "Parenthood":      ["#FDC830", "#F37335"],
  "Tie Dye":         ["#DA22FF", "#9733EE"],
};

const CATEGORY_FALLBACK = {
  Movies:  ["#1a1a2e", "#E94560"],
  Colors:  ["#667eea", "#764ba2"],
  Nature:  ["#134E5E", "#71B280"],
  Romance: ["#F093FB", "#F5576C"],
  Music:   ["#4FACFE", "#00F2FE"],
  Sports:  ["#F6D365", "#FDA085"],
  Party:   ["#FA709A", "#FEE140"],
  Food:    ["#FDDB92", "#D1FDFF"],
  Space:   ["#0F0C29", "#302B63"],
  Classic: ["#434343", "#000000"],
};

function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ══════════════════════════════════════════════════════════════════
// FACEBOOK STORY STYLE CANVAS  (5 portrait cards side by side)
// ══════════════════════════════════════════════════════════════════
async function generateAllThemesCanvas(matches, bgBuffer) {
  const COUNT    = matches.length;  // up to 5

  // ── Dimensions ──
  const CARD_W   = 160;
  const CARD_H   = 290;
  const GAP      = 10;
  const PADDING  = 18;
  const HEADER   = 56;
  const FOOTER   = 42;
  const W        = PADDING * 2 + COUNT * CARD_W + (COUNT - 1) * GAP;
  const H        = HEADER + CARD_H + FOOTER;

  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext("2d");

  // ── Overall background  (dark blurred panel like FB story tray) ──
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, "#0f0f1a");
  bgGrad.addColorStop(1, "#1c1c2e");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle top accent line
  const accentGrad = ctx.createLinearGradient(0, 0, W, 0);
  accentGrad.addColorStop(0,   "#4f46e5");
  accentGrad.addColorStop(0.5, "#06b6d4");
  accentGrad.addColorStop(1,   "#8b5cf6");
  ctx.fillStyle = accentGrad;
  ctx.fillRect(0, 0, W, 3);

  // ── Header ──
  ctx.fillStyle    = "#FFFFFF";
  ctx.font         = "bold 22px Sans";
  ctx.textAlign    = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("🎨 Group Theme", PADDING, HEADER / 2);

  ctx.fillStyle = "rgba(255,255,255,0.40)";
  ctx.font      = "14px Sans";
  ctx.textAlign = "right";
  ctx.fillText("Reply: 1–" + COUNT, W - PADDING, HEADER / 2);

  // Load bg image once if available
  let bgImg = null;
  if (bgBuffer) {
    try { bgImg = await loadImage(bgBuffer); } catch {}
  }

  // ── Draw each Story card ──
  for (let i = 0; i < COUNT; i++) {
    const theme  = matches[i];
    const cx     = PADDING + i * (CARD_W + GAP);
    const cy     = HEADER;
    const [c1, c2] = THEME_COLORS[theme.name] || CATEGORY_FALLBACK[theme.category] || ["#667eea", "#764ba2"];
    const icon   = catIcon[theme.category] || "🎨";

    // ── Card clip with rounded corners ──
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cx, cy, CARD_W, CARD_H, 14);
    ctx.clip();

    if (bgImg) {
      // Crop a vertical strip of the bg image per card (different x offset per card)
      const stripW = bgImg.width / COUNT;
      const srcX   = i * stripW;
      ctx.drawImage(bgImg, srcX, 0, stripW, bgImg.height, cx, cy, CARD_W, CARD_H);
      // Color tint
      const tint = ctx.createLinearGradient(cx, cy, cx, cy + CARD_H);
      tint.addColorStop(0, hexToRgba(c1, 0.70));
      tint.addColorStop(1, hexToRgba(c2, 0.80));
      ctx.fillStyle = tint;
      ctx.fillRect(cx, cy, CARD_W, CARD_H);
    } else {
      const grad = ctx.createLinearGradient(cx, cy, cx + CARD_W, cy + CARD_H);
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);
      ctx.fillStyle = grad;
      ctx.fillRect(cx, cy, CARD_W, CARD_H);
    }

    // Bottom gradient scrim (for text readability)
    const scrim = ctx.createLinearGradient(cx, cy + CARD_H - 90, cx, cy + CARD_H);
    scrim.addColorStop(0, "rgba(0,0,0,0)");
    scrim.addColorStop(1, "rgba(0,0,0,0.72)");
    ctx.fillStyle = scrim;
    ctx.fillRect(cx, cy, CARD_W, CARD_H);

    ctx.restore();

    // ── Story ring (Facebook-style colored border) ──
    const ringGrad = ctx.createLinearGradient(cx, cy, cx + CARD_W, cy + CARD_H);
    ringGrad.addColorStop(0, c1);
    ringGrad.addColorStop(1, c2);
    ctx.strokeStyle = ringGrad;
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.roundRect(cx, cy, CARD_W, CARD_H, 14);
    ctx.stroke();

    // ── Number badge (top-center, like story ring avatar) ──
    const bx = cx + CARD_W / 2;
    const by = cy + 34;
    // Outer ring
    ctx.beginPath();
    ctx.arc(bx, by, 22, 0, Math.PI * 2);
    const badgeRing = ctx.createLinearGradient(bx - 22, by - 22, bx + 22, by + 22);
    badgeRing.addColorStop(0, c1);
    badgeRing.addColorStop(1, c2);
    ctx.strokeStyle = badgeRing;
    ctx.lineWidth   = 3;
    ctx.stroke();
    // Inner fill
    ctx.beginPath();
    ctx.arc(bx, by, 19, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fill();
    // Number
    ctx.fillStyle    = "#FFFFFF";
    ctx.font         = "bold 20px Sans";
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), bx, by);

    // ── Category icon (top-right corner) ──
    ctx.font         = "18px Sans";
    ctx.textAlign    = "right";
    ctx.textBaseline = "top";
    ctx.fillText(icon, cx + CARD_W - 8, cy + 8);

    // ── Theme name (bottom, centered, multi-line if needed) ──
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur  = 6;
    ctx.fillStyle   = "#FFFFFF";
    ctx.textAlign   = "center";
    ctx.textBaseline = "alphabetic";

    // Break long names into 2 lines
    const words   = theme.name.split(" ");
    let   line1   = "", line2 = "";
    ctx.font = "bold 17px Sans";
    let lineW = 0;
    for (const w of words) {
      const ww = ctx.measureText((line1 ? line1 + " " : "") + w).width;
      if (ww < CARD_W - 14) { line1 = line1 ? line1 + " " + w : w; }
      else                  { line2 = line2 ? line2 + " " + w : w; }
    }
    if (line2) {
      ctx.fillText(line1, bx, cy + CARD_H - 30);
      ctx.fillText(line2, bx, cy + CARD_H - 10);
    } else {
      ctx.fillText(line1, bx, cy + CARD_H - 18);
    }
    ctx.shadowBlur = 0;
  }

  // ── Footer ──
  const footY = HEADER + CARD_H;
  ctx.fillStyle    = "rgba(255,255,255,0.06)";
  ctx.fillRect(0, footY, W, FOOTER);

  // Separator line
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fillRect(0, footY, W, 1);

  ctx.fillStyle    = "rgba(255,255,255,0.45)";
  ctx.font         = "13px Sans";
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("⚡ MOSTAKIM V2 BOT  •  Reply number to apply", W / 2, footY + FOOTER / 2);

  return canvas.toBuffer("image/png");
}

// Fetch a real image for the searched keyword using Google Image Search
async function fetchKeywordImage(query) {
  try {
    const results = await googlethis.image(query + " hd", { safe: false });
    for (const img of results.slice(0, 8)) {
      if (!img.url) continue;
      try {
        const res = await axios.get(img.url, {
          responseType: "arraybuffer",
          timeout: 6000,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        });
        if (res.data && res.data.byteLength > 5000) {
          return Buffer.from(res.data);
        }
      } catch { continue; }
    }
  } catch {}
  return null;
}

// ══════════════════════════════════════════════════════════════════
// PENDING STORE
// ══════════════════════════════════════════════════════════════════
const pending = new Map();

const catIcon = {
  Movies: "🎬", Colors: "🎨", Nature: "🌿", Romance: "💕",
  Music: "🎵", Sports: "⚽", Party: "🎉", Food: "🍔",
  Space: "🚀", Classic: "✨",
};

// ══════════════════════════════════════════════════════════════════
// COMMAND RUN
// ══════════════════════════════════════════════════════════════════
module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  const prompt = args.join(" ").trim().toLowerCase();

  if (!prompt) {
    return api.sendMessage(
      "🎨 Group Theme Changer\n" +
      "━━━━━━━━━━━━━━━━━━━━━━\n" +
      "📌 Usage: grouptheme <keyword>\n\n" +
      "💡 Examples:\n" +
      "  /grouptheme ocean\n" +
      "  /grouptheme iron man\n" +
      "  /grouptheme birthday\n" +
      "  /grouptheme lofi\n\n" +
      "Keyword দিলে 5টি theme preview দেখাবে!",
      threadID, messageID
    );
  }

  api.setMessageReaction("⏳", messageID, () => {}, true);

  // ── Find matches ──
  let matches = findMatches(prompt, 5);

  // ── Try Meta AI ──
  if (typeof api.metaTheme === "function") {
    try {
      const result = await new Promise((resolve, reject) =>
        api.metaTheme(prompt, { numThemes: 5 }, (err, data) =>
          (err || !data?.success) ? reject(err || new Error("AI failed")) : resolve(data)
        )
      );
      if (result.themes?.length > 0) {
        matches = result.themes.slice(0, 5).map((t, i) => {
          const db = THEME_DB.find(d => String(d.id) === String(t.themeId));
          return {
            id:       t.themeId,
            name:     t.name || t.accessibility_label || db?.name || `Theme ${i+1}`,
            category: db?.category || "AI",
            score:    10,
          };
        });
      }
    } catch { /* use preset */ }
  }

  // ── Fallback ──
  if (matches.length === 0) {
    matches = ["Ocean","Lo-Fi","Birthday","Love","Rocket"]
      .map(n => THEME_DB.find(t => t.name === n))
      .filter(Boolean)
      .map(t => ({ ...t, score: 0 }));
  }
  if (matches.length === 0) matches = THEME_DB.slice(0, 5).map(t => ({ ...t, score: 0 }));

  const COUNT  = matches.length;
  const cacheDir = path.join(__dirname, "cache");
  fs.ensureDirSync(cacheDir);

  // ── Fetch keyword image for background ──
  const bgBuffer = await fetchKeywordImage(prompt);

  // ── Build selection prompt ──
  const selMsg =
    "━━━━━━━━━━━━━━━━━━━\n" +
    `📩 Reply করো 1 থেকে ${COUNT}\n` +
    "⏰ 60 সেকেন্ডের মধ্যে reply করো\n" +
    "⚡ MOSTAKIM V2 BOT";

  // ── Try ONE combined canvas image ──
  const tmpPath = path.join(cacheDir, `themes_${Date.now()}.png`);
  let sentInfo  = null;

  try {
    const buf = await generateAllThemesCanvas(matches, bgBuffer);
    fs.writeFileSync(tmpPath, buf);
    sentInfo = await new Promise(resolve =>
      api.sendMessage(
        { body: selMsg, attachment: fs.createReadStream(tmpPath) },
        threadID,
        (err, info) => { try { fs.unlinkSync(tmpPath); } catch {} resolve(info); },
        messageID
      )
    );
  } catch {}

  // ── Fallback: text list + selection prompt as separate message ──
  if (!sentInfo?.messageID) {
    const themeListText = matches.map((t, i) => {
      const icon = catIcon[t.category] || "🎨";
      return `${i+1}️⃣ ${t.name}  [${icon} ${t.category}]`;
    }).join("\n");
    await new Promise(resolve =>
      api.sendMessage(themeListText, threadID, () => resolve())
    );
    sentInfo = await new Promise(resolve =>
      api.sendMessage(selMsg, threadID, (err, info) => resolve(info), messageID)
    );
  }

  api.setMessageReaction("✅", messageID, () => {}, true);

  if (!sentInfo?.messageID) return;

  pending.set(sentInfo.messageID, { matches, threadID, senderID: event.senderID });

  global.client.handleReply.push({
    name:      module.exports.config.name,
    messageID: sentInfo.messageID,
    author:    event.senderID,
    type:      "theme_select",
  });

  setTimeout(() => pending.delete(sentInfo.messageID), 60000);
};

// ══════════════════════════════════════════════════════════════════
// HANDLE REPLY
// ══════════════════════════════════════════════════════════════════
module.exports.handleReply = async function ({ api, event, handleReply }) {
  if (handleReply.type !== "theme_select") return;

  const { threadID, messageID, senderID, body } = event;

  if (handleReply.author && senderID !== handleReply.author) {
    return api.sendMessage("❌ শুধু যে search করেছে সেই reply করতে পারবে।", threadID, messageID);
  }

  const data = pending.get(handleReply.messageID);
  if (!data) {
    return api.sendMessage("⏰ সময় শেষ। আবার search করো।", threadID, messageID);
  }

  const num = parseInt((body || "").trim());
  if (isNaN(num) || num < 1 || num > data.matches.length) {
    return api.sendMessage(
      `❌ 1 থেকে ${data.matches.length} এর মধ্যে নম্বর দাও।`,
      threadID, messageID
    );
  }

  const chosen = data.matches[num - 1];
  pending.delete(handleReply.messageID);

  const idx = global.client.handleReply.findIndex(h => h.messageID === handleReply.messageID);
  if (idx !== -1) global.client.handleReply.splice(idx, 1);

  api.setMessageReaction("⏳", messageID, () => {}, true);

  try {
    await applyTheme(api, threadID, chosen.id);
    api.setMessageReaction("✅", messageID, () => {}, true);
    api.sendMessage(
      `✅ Theme Set!\n🎨 ${chosen.name}  [${chosen.category}]\n⚡ MOSTAKIM V2 BOT`,
      threadID, messageID
    );
  } catch (err) {
    api.setMessageReaction("❌", messageID, () => {}, true);
    api.sendMessage(
      "❌ Theme set হয়নি!\n" +
      String(err?.message || err).slice(0, 120) +
      "\n💡 Bot-কে group admin বানাও।",
      threadID, messageID
    );
  }
};
