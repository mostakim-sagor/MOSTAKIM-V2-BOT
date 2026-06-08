const axios = require("axios");

const apiList = "https://raw.githubusercontent.com/shahadat-sahu/SAHU-API/refs/heads/main/SAHU-API.json";
const getMainAPI = async () => (await axios.get(apiList)).data.simsimi;

// Track last replies per user to avoid duplicates
const lastReplies = new Map();

function getUniqueReply(arr, uid) {
  const last   = lastReplies.get(uid) || "";
  const filtered = arr.filter(r => r !== last);
  const pool   = filtered.length > 0 ? filtered : arr;
  const pick   = pool[Math.floor(Math.random() * pool.length)];
  lastReplies.set(uid, pick);
  return pick;
}

module.exports.config = {
  name:            "baby",
  version:         "1.1.0",
  hasPermssion:    0,
  credits:         "MOSTAKIM",
  description:     "Cute AI Baby Chatbot | Talk, Teach & Chat with Emotion ☢️",
  commandCategory: "chat",
  usages:          "[message/query]",
  cooldowns:       0,
  prefix:          true
};

// ── Push to handleReply ───────────────────────────────────────────
function pushReply(info, senderID) {
  if (info?.messageID) {
    global.client.handleReply.push({
      name:      "baby",
      messageID: info.messageID,
      author:    senderID,
      type:      "simsimi"
    });
  }
}

// ── Send plain message (no tag/mention) ──────────────────────────
function sendPlain(api, threadID, text, messageID, senderID) {
  return new Promise(resolve => {
    const cb = (err, info) => { pushReply(info, senderID); resolve(); };
    if (messageID) api.sendMessage(text, threadID, cb, messageID);
    else           api.sendMessage(text, threadID, cb);
  });
}

// ══════════════════════════════════════════════════════════════════
// RUN
// ══════════════════════════════════════════════════════════════════
module.exports.run = async function ({ api, event, args, Users }) {
  try {
    const uid        = event.senderID;
    const senderName = await Users.getNameUser(uid);
    const rawQuery   = args.join(" ");
    const query      = rawQuery.toLowerCase();
    const simsim     = await getMainAPI();

    if (!query) {
      const ran = ["Bolo baby 🥺", "kemon acho tumi baby 😽", "etttto somoy pore amar kotha mone porlo tumar 🥹🫶", "হ্যাঁ জানু , এইদিক এ আসো কিস দেই! 🫦", "আরে Bolo আমার জান ,কেমন আছো?😚", "হুম বলো 😊"];
      return sendPlain(api, event.threadID, `< ${senderName} >\n\n${getUniqueReply(ran, uid)}`, null, uid);
    }

    const command = args[0].toLowerCase();

    if (["remove", "rm"].includes(command)) {
      const parts = rawQuery.replace(/^(remove|rm)\s*/i, "").split(" - ");
      if (parts.length < 2) return sendPlain(api, event.threadID, "Use: remove [Question] - [Reply]", event.messageID, uid);
      const [ask, ans] = parts.map(p => p.trim());
      const res = await axios.get(`${simsim}/delete?ask=${encodeURIComponent(ask)}&ans=${encodeURIComponent(ans)}`);
      return sendPlain(api, event.threadID, res.data.message, event.messageID, uid);
    }

    if (command === "list") {
      const res = await axios.get(`${simsim}/list`);
      if (res.data.code === 200) {
        return sendPlain(api, event.threadID,
          `♾ Total Questions: ${res.data.totalQuestions}\n★ Total Replies: ${res.data.totalReplies}\nDeveloper: ${res.data.author}`,
          event.messageID, uid);
      }
      return sendPlain(api, event.threadID, `Error: ${res.data.message}`, event.messageID, uid);
    }

    if (command === "edit") {
      const parts = rawQuery.replace(/^edit\s*/i, "").split(" - ");
      if (parts.length < 3) return sendPlain(api, event.threadID, "Use: edit [Q] - [Old] - [New]", event.messageID, uid);
      const [ask, oldReply, newReply] = parts.map(p => p.trim());
      const res = await axios.get(`${simsim}/edit?ask=${encodeURIComponent(ask)}&old=${encodeURIComponent(oldReply)}&new=${encodeURIComponent(newReply)}`);
      return sendPlain(api, event.threadID, res.data.message, event.messageID, uid);
    }

    if (command === "teach") {
      const parts = rawQuery.replace(/^teach\s*/i, "").split(" - ");
      if (parts.length < 2) return sendPlain(api, event.threadID, "Use: teach [Q] - [Reply]", event.messageID, uid);
      const [ask, ans] = parts.map(p => p.trim());
      const groupID = event.threadID;
      let groupName = event.threadName || "";
      try {
        if (!groupName && groupID != uid) {
          const info = await api.getThreadInfo(groupID);
          if (info?.threadName) groupName = info.threadName;
        }
      } catch {}
      let teachUrl = `${simsim}/teach?ask=${encodeURIComponent(ask)}&ans=${encodeURIComponent(ans)}&senderID=${uid}&senderName=${encodeURIComponent(senderName)}&groupID=${encodeURIComponent(groupID)}`;
      if (groupName) teachUrl += `&groupName=${encodeURIComponent(groupName)}`;
      const res = await axios.get(teachUrl);
      return sendPlain(api, event.threadID, res.data.message, event.messageID, uid);
    }

    const res     = await axios.get(`${simsim}/simsimi?text=${encodeURIComponent(query)}&senderName=${encodeURIComponent(senderName)}`);
    const all     = Array.isArray(res.data.response) ? res.data.response : [res.data.response];
    const pick    = getUniqueReply(all, uid);
    await sendPlain(api, event.threadID, `${senderName}\n${pick}`, event.messageID, uid);

  } catch (err) {
    api.sendMessage(`Error: ${err.message}`, event.threadID, event.messageID);
  }
};

// ══════════════════════════════════════════════════════════════════
// HANDLE REPLY
// ══════════════════════════════════════════════════════════════════
module.exports.handleReply = async function ({ api, event, Users }) {
  try {
    const uid        = event.senderID;
    const senderName = await Users.getNameUser(uid);
    const replyText  = event.body ? event.body.toLowerCase() : "";
    if (!replyText) return;
    const simsim = await getMainAPI();
    const res    = await axios.get(`${simsim}/simsimi?text=${encodeURIComponent(replyText)}&senderName=${encodeURIComponent(senderName)}`);
    const all    = Array.isArray(res.data.response) ? res.data.response : [res.data.response];
    const pick   = getUniqueReply(all, uid);
    await sendPlain(api, event.threadID, `< ${senderName} >\n\n${pick}`, event.messageID, uid);
  } catch (err) {
    api.sendMessage(`Error: ${err.message}`, event.threadID, event.messageID);
  }
};

// ══════════════════════════════════════════════════════════════════
// HANDLE EVENT
// ══════════════════════════════════════════════════════════════════
module.exports.handleEvent = async function ({ api, event, Users }) {
  try {
    const raw = event.body ? event.body.toLowerCase().trim() : "";
    if (!raw) return;

    const senderName = await Users.getNameUser(event.senderID);
    const senderID   = event.senderID;
    const simsim     = await getMainAPI();

    const greetings = [
      "বেশি bot Bot করলে leave নিবো কিন্তু!😒😒",
      "শুনবো না😼 তুমি আমার বস কে প্রেম করাই দাও নাই🥺পচা তুমি🥺",
      
      "এতো ডেকো না,প্রেম এ পরে যাবো তো 😉",
      "বার বার ডাকলে মাথা গরম হয়ে যায় কিন্তু😑",
      "হ্যা বলো😒, তোমার জন্য কি করতে পারি😐😑?",
      "এতো ডাকছিস কেন?গালি শুনবি নাকি? 🤬",
      "আজ বট বলে অসম্মান করছিস,😰😿",
      "Hop beda😾,Boss বল boss😼",
      "চুপ থাক ,নাই তো তোর দাত ভেগে দিবো কিন্তু",
      "আমাকে না ডেকে মেয়ে হলে বসের ইনবক্সে চলে যা 🌚😂",
      "বার বার Disturb করছিস কোনো😾,আমার জানুর সাথে ব্যাস্ত আছি😋",
      "আমাকে ডাকলে ,আমি কিন্তু কিস করে দিবো😘",
      "আমারে এতো ডাকিস না আমি মজা করার mood এ নাই এখন😒",
      "দূরে যা, তোর কোনো কাজ নাই, শুধু bot bot করিস 😉😋🤣",
      "তোর কথা তোর বাড়ির কেউ শুনে না ,তো আমি কোনো শুনবো ?🤔😂",
      "আমাকে ডেকো না,আমি বস মোস্তাকিম এর সাথে ব্যাস্ত আছি",
      "বলো কি বলবা, সবার সামনে বলবা নাকি?🤭🤏",
      "জান মেয়ে হলে বস মোস্তাকিম এর ইনবক্সে চলে যাও 🫣💕",
      "কালকে দেখা করিস তো একটু 😈",
      "হা বলো, শুনছি আমি 😏",
      "আর কত বার ডাকবি ,শুনছি তো",
      "হুম বলো কি বলবে😒",
      "বলো কি করতে পারি তোমার জন্য",
      "আমি তো অন্ধ কিছু দেখি না🐸 😎",
      "আরে বোকা বট না জানু বল জানু😌",
      "বলো জানু 🌚",
      "তোর কি চোখে পড়ে না আমি ব্যাস্ত আছি😒",
      "হুম জান তোমার ওই খানে উম্মহ😑😘",
      "আহ শুনা আমার তোমার অলিতে গলিতে উম্মাহ😇😘",
      "jang hanga korba😒😬",
      "হুম জান তোমার অইখানে উম্মমাহ😷😘",
      "আসসালামু আলাইকুম বলেন আপনার জন্য কি করতে পারি..!🥰",
      "ভালোবাসার নামক আবলামি করতে চাইলে বস মোস্তাকি এর ইনবক্সে গুতা দিন ~🙊😘",
      "আমাকে এতো না ডেকে বস মোস্তাকিম কে একটা গফ দে 🙄",
      "আমাকে এতো ডাকস কেন ভলো টালো বাসোস নাকি🤭🙈",
      "🌻🌺💚-আসসালামু আলাইকুম ওয়া রাহমাতুল্লাহ-💚🌺🌻",
      "আমি এখন বস এর সাথে বিজি আছি আমাকে ডাকবেন না-😕😏 ধন্যবাদ-🤝🌻",
      "আমাকে না ডেকে আমার বস মোস্তাকিম কে একটা জি এফ দাও-😽🫶🌺",
      "ঝাং থুমালে আইলাপিউ পেপি-💝😽",
      "উফফ বুঝলাম না এতো ডাকছেন কেনো-😤😡😈",
      "জান তোমার বান্ধবী রে আমার বস মোস্তাকিম হাতে তুলে দিবা-🙊🙆‍",
      "আজকে আমার মন ভালো নেই তাই আমারে ডাকবেন না-😪🤧",
      "ঝাং 🫵থুমালে য়ামি রাইতে পালুপাসি উম্মম্মাহ-🌺🤤💦",
      "চুনা ও চুনা আমার বস মোস্তাকিম এর হবু বউ রে কেও দেকছো খুজে পাচ্ছি না😪🤧😭",
      "স্বপ্ন তোমারে নিয়ে দেখতে চাই তুমি যদি আমার হয়ে থেকে যাও-💝🌺🌻",
      "জান হাঙ্গা করবা-🙊😝🌻",
      "জান মেয়ে হলে চিপায় আসো বস মোস্তাকিম থেকে অনেক ভালোবাসা শিখছি তোমার জন্য-🙊🙈😽",
      "ইসস এতো ডাকো কেনো লজ্জা লাগে তো-🙈🖤🌼",
      "আমার বসরে পক্ষ থেকে তোমারে এতো এতো ভালোবাসা-🥰😽🫶 আমার বস মোস্তাকিম এর জন্য দোয়া করবেন-💝💚🌺🌻",
      "ভালোবাসা নামক আব্লামি করতে মন চাইলে আমার বস এর ইনবক্স চলে যাও-🙊🥱👅",
      "আমার জান তুমি শুধু আমার আমি তোমারে ৩৬৫ দিন ভালোবাসি-💝🌺😽",
      "কিরে প্রেম করবি তাহলে বস মোস্তাকিম'এর ইনবক্সে গুতা দে 😘🤌 𝐅𝐚𝐜𝐞𝐛𝐨𝐨𝐤 𝐋𝐢𝐧𝐤 : https://www.facebook.com/100058112936375",
      "জান আমার বস মোস্তাকিম কে বিয়ে করবা-🙊😘🥳",
      "আন্টি-🙆-আপনার মেয়ে-👰‍♀️-রাতে আমারে ভিদু কল দিতে বলে🫣-🥵🤤💦",
      "oii-🥺🥹-এক🥄 চামচ ভালোবাসা দিবা-🤏🏻🙂",
      "আপনার সুন্দরী বান্ধুবীকে ফিতরা হিসেবে আমার বস মোস্তাকিম কে দান করেন-🥱🐰🍒",
      "ও মিম ও মিম-😇-তুমি কেন চুরি করলা সাদিয়ার ফর্সা হওয়ার ক্রীম-🌚🤧",
      "অনুমতি দিলাম-𝙋𝙧𝙤𝙥𝙤𝙨𝙚 কর বস মোস্তাকিম কে-🐸😾🔪",
      "𝙂𝙖𝙮𝙚𝙨-🤗-যৌবনের কসম দিয়ে আমারে 𝐁𝐥𝐚𝐜𝐤𝐦𝐚𝐢𝐥 করা হচ্ছে-🥲🤦‍♂️🤧",
      "𝗢𝗶𝗶 আন্টি-🙆‍♂️-তোমার মেয়ে চোখ মারে-🥺🥴🐸",
      "তাকাই আছো কেন চুমু দিবা-🙄🐸😘",
      "আজকে প্রপোজ করে দেখো রাজি হইয়া যামু-😌🤗😇",
      "আমার গল্পে তোমার নানি সেরা-🙊🙆‍♂️🤗",
      "কি বেপার আপনি শ্বশুর বাড়িতে যাচ্ছেন না কেন-🤔🥱🌻",
      "দিনশেষে পরের 𝐁𝐎𝐖 সুন্দর-☹️🤧",
      "তাবিজ কইরা হইলেও ফ্রেম এক্কান করমুই তাতে যা হই হোক-🤧🥱🌻",
      "ছোটবেলা ভাবতাম বিয়ে করলে অটোমেটিক বাচ্চা হয়-🥱-ওমা এখন দেখি কাহিনী অন্যরকম-😦🙂🌻",
      "প্রেম করতে চাইলে বস মোস্তাকিম'এর ইনবক্সে চলে যা 😏🐸 𝐅𝐚𝐜𝐞𝐛𝐨𝐨𝐤 𝐋𝐢𝐧𝐤 : https://www.facebook.com/100058112936375",
      "আজ একটা বিন নেই বলে ফেসবুকের নাগিন-🤧-গুলোরে আমার বস মোস্তাকিম ধরতে পারছে না-🐸🥲",
      "চুমু থাকতে তোরা বিড়ি খাস কেন বুঝা আমারে-😑😒🐸⚒️",
      "যে ছেড়ে গেছে-😔-তাকে ভুলে যাও-🙂-আমার বস মোস্তাকিম এর সাথে প্রেম করে তাকে দেখিয়ে দাও-🙈🐸🤗",
      "হাজারো লুচ্চা লুচ্চির ভিরে-🙊🥵আমার বস মোস্তাকিম এক নিস্পাপ ভালো মানুষ-🥱🤗🙆‍♂️",
      "রূপের অহংকার করো না-🙂❤️চকচকে সূর্যটাও দিনশেষে অন্ধকারে পরিণত হয়-🤗💜",
      "সুন্দর মাইয়া মানেই-🥱আমার বস মোস্তাকিম'র বউ-😽🫶আর বাকি গুলো আমার বেয়াইন-🙈🐸🤗",
      "এত অহংকার করে লাভ নেই-🌸মৃত্যুটা নিশ্চিত শুধু সময়টা অ'নিশ্চিত-🖤🙂",
      "দিন দিন কিছু মানুষের কাছে অপ্রিয় হয়ে যাইতেছি-🙂😿🌸",
      "ভালোবাসার নামক আবলামি করতে চাইলে বস মোস্তাকিম'র ইনবক্সে গুতা দিন🤣😼",
      "মেয়ে হলে বস মোস্তাকিম'র ইনবক্সে চলে যা 🤭🤣😼 𝐅𝐚𝐜𝐞𝐛𝐨𝐨𝐤 𝐋𝐢𝐧𝐤 : https://www.facebook.com/100058112936375",
      "হুদাই আমারে শয়তানে লারে-😝😑☹️",
      "𝗜 𝗟𝗢𝗩𝗘 𝗬𝗢𝗨-😽-আহারে ভাবছো তোমারে প্রোপজ করছি-🥴-থাপ্পর দিয়া কিডনী লক করে দিব-😒-ভুল পড়া বের করে দিবো-🤭🐸",
      "আমি একটা দুধের শিশু-😇-🫵𝗬𝗢𝗨🐸💦",
      "কতদিন হয়ে গেলো বিছনায় মুতি না-😿-মিস ইউ নেংটা কাল-🥺🤧",
      "বালিকা━👸-𝐃𝐨 𝐲𝐨𝐮-🫵-বিয়া-𝐦𝐞-😽-আমি তোমাকে-😻-আম্মু হইতে সাহায্য করব-🙈🥱",
      "এই আন্টির মেয়ে-🫢🙈-𝐔𝐦𝐦𝐦𝐦𝐦𝐦𝐦𝐦𝐦𝐦𝐦𝐡-😽🫶-আসলেই তো স্বাদ-🥵💦-এতো স্বাদ কেন-🤔-সেই স্বাদ-😋",
      "ইস কেউ যদি বলতো-🙂-আমার শুধু তোমাকেই লাগবে-💜🌸",
      "ওই বেডি তোমার বাসায় না আমার বস মোস্তাকিম মেয়ে দেখতে গেছিলো-🙃-নাস্তা আনারস আর দুধ দিছো-🙄🤦‍♂️-বইন কইলেই তো হয় বয়ফ্রেন্ড আছে-🥺🤦‍♂-আমার বস মোস্তাকিম কে জানে মারার কি দরকার-🙄🤧",
      "একদিন সে ঠিকই ফিরে তাকাবে-😇-আর মুচকি হেসে বলবে ওর মতো আর কেউ ভালবাসেনি-🙂😅",
      "হুদাই গ্রুপে আছি-🥺🐸-কেও ইনবক্সে নক দিয়ে বলে না জান তোমারে আমি অনেক ভালোবাসি-🥺🤧",
      "কি'রে গ্রুপে দেখি একটাও বেডি নাই-🤦‍🥱💦",
      "দেশের সব কিছুই চুরি হচ্ছে-🙄-শুধু আমার বস মোস্তাকিম এর মনটা ছাড়া-🥴😑😏",
      "🫵তোমারে প্রচুর ভাল্লাগে-😽-সময় মতো প্রপোজ করমু বুঝছো-🔨😼-ছিট খালি রাইখো-🥱🐸🥵",
      "আজ থেকে আর কাউকে পাত্তা দিমু না-!😏-কারণ আমি ফর্সা হওয়ার ক্রিম কিনছি-!🙂🐸"
    ];

    const triggerExact  = ["baby","bot","bby","jan","Bot","জান","বট","বেবি"];
    const triggerPrefix = ["baby ","bot ","bby ","jan ","Bot ","জান ","বট ","বেবি "];

    if (triggerExact.includes(raw)) {
      const pick = getUniqueReply(greetings, senderID);
      return sendPlain(api, event.threadID, `< ${senderName} >\n\n${pick}`, event.messageID, senderID);
    }

    const matched = triggerPrefix.find(p => raw.startsWith(p));
    if (matched) {
      const q = raw.slice(matched.length).trim();
      if (!q) return;
      const res  = await axios.get(`${simsim}/simsimi?text=${encodeURIComponent(q)}&senderName=${encodeURIComponent(senderName)}`);
      const all  = Array.isArray(res.data.response) ? res.data.response : [res.data.response];
      const pick = getUniqueReply(all, senderID);
      return sendPlain(api, event.threadID, `< ${senderName} >\n\n${pick}`, event.messageID, senderID);
    }

  } catch {}
};
