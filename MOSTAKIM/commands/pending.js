module.exports.config = {
  name: "pending",
  version: "1.0.6",
  credits: "MOSTAKIM",
  hasPermssion: 2,
  description: "Manage bot's pending group requests",
  commandCategory: "system",
  cooldowns: 5
};

module.exports.languages = {
  "en": {
    "invaildNumber": "❌ %1 is not a valid number",
    "cancelSuccess": "✅ Successfully rejected %1 group(s)!",
    "notiBox1": "⚡ 𝐌𝐎𝐒𝐓𝐀𝐊𝐈𝐌-𝐕𝟐-𝐁𝐎𝐓 ⚡\n\nIs successfully connected and running ♻️\nAll services are active and ready to handle your requests 🔥\nThank you for using this system — let’s get started 🚀\n\n☢️ 𝗣𝗿𝗲𝗳𝗶𝘅 : /",
    "notiBox2": `╭•┄┅═══❁🌺❁═══┅┄•╮
     
     𝐌𝐎𝐒𝐓𝐀𝐊𝐈𝐌-𝐕𝟐-𝐁𝐎𝐓
    𝐀𝐬𝐬𝐚𝐥𝐚𝐦𝐮 𝐀𝐥𝐚𝐢𝐤𝐮𝐦 💚
     
╰•┄┅═══❁🌺❁═══┅┄•╯

Thank you for adding me to your group 🖤 
I’m always here to help you ♻️

𝐂𝐨𝐦𝐦𝐚𝐧𝐝 𝐋𝐢𝐬𝐭:
/help
/info
/admin

★ For any help or complaints, please contact admin ★
➤ 𝗙𝗮𝗰𝗲𝗯𝗼𝗼𝗸 : 
https://www.facebook.com/100058112936375
➤  𝗧𝗲𝗹𝗲𝗴𝗿𝗮𝗺 : 
t.me/M0STAKIM10X

❖⋆═══════════════════════⋆❖
      𝐁𝐨𝐭 𝐎𝐰𝐧𝐞𝐫 ➢ 𝐌𝐎𝐒𝐓𝐀𝐊𝐈𝐌`,
    "approveSuccess": "✅ Successfully approved %1 group(s)!",
    "cantGetPendingList": "❌ Failed to retrieve pending list!",
    "returnListPending": "📝 𝗣𝗘𝗡𝗗𝗜𝗡𝗚 𝗟𝗜𝗦𝗧\n\nTotal groups awaiting approval: %1\n\n%2\n\nReply with the number(s) to approve or 'c' followed by number(s) to reject (e.g., 1 2 3 or c1 c2)",
    "returnListClean": "✅ There are no pending groups at the moment."
  }
};

module.exports.handleReply = async function({ api, event, handleReply, getText }) {
  if (String(event.senderID) !== String(handleReply.author)) return;
  
  const { body, threadID, messageID } = event;
  let count = 0;

  
  if ((isNaN(body) && body.toLowerCase().startsWith("c")) || body.toLowerCase().startsWith("cancel")) {
    const indexes = body.match(/\d+/g) || [];
    
    for (const num of indexes) {
      const index = parseInt(num);
      if (isNaN(index) || index <= 0 || index > handleReply.pending.length) {
        return api.sendMessage(getText("invaildNumber", num), threadID, messageID);
      }
      
      try {
        await api.removeUserFromGroup(api.getCurrentUserID(), handleReply.pending[index - 1].threadID);
        count++;
      } catch (e) {
        console.error("Error rejecting group:", e);
      }
    }
    return api.sendMessage(getText("cancelSuccess", count), threadID, messageID);
  } 
  
  else {
    const indexes = body.match(/\d+/g) || [];
    
    for (const num of indexes) {
      const index = parseInt(num);
      if (isNaN(index) || index <= 0 || index > handleReply.pending.length) {
        return api.sendMessage(getText("invaildNumber", num), threadID, messageID);
      }
      
      try {
        const groupID = handleReply.pending[index - 1].threadID;
        await api.sendMessage(getText("notiBox1"), groupID);
        await api.sendMessage(getText("notiBox2"), groupID);
        count++;
      } catch (e) {
        console.error("Error approving group:", e);
      }
    }
    return api.sendMessage(getText("approveSuccess", count), threadID, messageID);
  }
};

module.exports.run = async function({ api, event, getText }) {
  const { threadID, messageID } = event;
  
  try {
    const [spam, pending] = await Promise.all([
      api.getThreadList(100, null, ["OTHER"]),
      api.getThreadList(100, null, ["PENDING"])
    ]);
    
    const list = [...(spam || []), ...(pending || [])]
      .filter(group => group.isSubscribed && group.isGroup);
    
    if (list.length === 0) {
      return api.sendMessage(getText("returnListClean"), threadID, messageID);
    }
    
    const msg = list.map((group, index) => 
      `${index + 1}. ${group.name || 'Unnamed Group'} (ID: ${group.threadID})`
    ).join('\n');
    
    return api.sendMessage(
      getText("returnListPending", list.length, msg), 
      threadID,
      (error, info) => {
        if (!error) {
          global.client.handleReply.push({
            name: this.config.name,
            messageID: info.messageID,
            author: event.senderID,
            pending: list
          });
        }
      },
      messageID
    );
  } catch (e) {
    console.error(e);
    return api.sendMessage(getText("cantGetPendingList"), threadID, messageID);
  }
};