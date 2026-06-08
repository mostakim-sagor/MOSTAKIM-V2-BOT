const fs = require("fs-extra");
const axios = require("axios");
const path = require("path");

module.exports.config = {
 name: "notice",
 version: "1.0.0",
 hasPermssion: 2, 
 credits: "MOSTAKIM",
 description: "সকল গ্রুপে নোটিশ পাঠান (টেক্সট, ইমেজ, ভিডিও, অডিও, ফাইল সহ)",
 commandCategory: "admin",
 usages: "/notice <টেক্সট> বা রিপ্লাই দিয়ে মেসেজ দিন",
 cooldowns: 5,
};

module.exports.run = async ({ api, event, args, Users }) => {
 try {
 const allThreads = global.data.allThreadID || [];
 const senderName = await Users.getNameUser(event.senderID);
 let successCount = 0;
 let failedCount = 0;

 if (event.type === "message_reply") {
 const replyMsg = event.messageReply;
 const attachments = replyMsg.attachments || [];

 
 for (const attachment of attachments) {
 const fileUrl = attachment.url;
 const fileName = path.basename(fileUrl);
 const filePath = path.join(__dirname, `cache/${fileName}`);

 try {
 
 const response = await axios.get(fileUrl, { responseType: "arraybuffer" });
 await fs.writeFile(filePath, Buffer.from(response.data, "binary"));

 
 for (const threadID of allThreads) {
 if (threadID != event.threadID) { 
 try {
 await api.sendMessage(
 {
 body: `📢 নোটিশ From Admin: (${senderName})\n\n${replyMsg.body || args.join(" ")}`,
 attachment: fs.createReadStream(filePath),
 },
 threadID
 );
 successCount++;
 } catch (error) {
 failedCount++;
 console.error(`Failed to send to ${threadID}:`, error);
 }
 await new Promise((resolve) => setTimeout(resolve, 1000)); // Rate limit এড়ানোর জন্য
 }
 }

 
 await fs.unlink(filePath);
 } catch (error) {
 console.error("File download/send error:", error);
 api.sendMessage("❌ ফাইল পাঠানোতে সমস্যা হয়েছে!", event.threadID);
 }
 }
 } 
 
 else if (args.length > 0) {
 const noticeText = args.join(" ");

 for (const threadID of allThreads) {
 if (threadID != event.threadID) {
 try {
 await api.sendMessage(
 `📢 নোটিশ (${senderName}):\n${noticeText}`,
 threadID
 );
 successCount++;
 } catch (error) {
 failedCount++;
 console.error(`Failed to send to ${threadID}:`, error);
 }
 await new Promise((resolve) => setTimeout(resolve, 500)); // Rate limit এড়ানোর জন্য
 }
 }
 } else {
 return api.sendMessage(
 "ℹ️ ব্যবহার:\n• `/notice <টেক্সট>`\n• বা কোনো মেসেজ রিপ্লাই দিয়ে `/notice` লিখুন",
 event.threadID
 );
 }

 api.sendMessage(
 `✅ ${successCount} টি গ্রুপে নোটিশ পাঠানো হয়েছে!\n❌ ${failedCount} টি গ্রুপে পাঠানো যায়নি।`,
 event.threadID
 );
 } catch (error) {
 console.error("Global error:", error);
 api.sendMessage("❌ নোটিশ পাঠাতে সমস্যা হয়েছে!", event.threadID);
 }
};