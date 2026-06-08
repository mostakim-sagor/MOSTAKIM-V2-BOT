module.exports.config = {
 name: "antiout",
 eventType: ["log:unsubscribe"],
 version: "0.0.2",
 credits: "MOSTAKIM",
 description: "Auto re-add members who leave without admin permission"
};

module.exports.run = async({ event, api, Threads, Users }) => {
 let data = (await Threads.getData(event.threadID)).data || {};
 if (data.antiout == false) return;
 if (event.logMessageData.leftParticipantFbId == api.getCurrentUserID()) return;

 const uid  = event.logMessageData.leftParticipantFbId;
 const name = global.data.userName.get(uid) || await Users.getNameUser(uid);
 const selfLeft = (event.author == uid);

 if (selfLeft) {
  api.addUserToGroup(uid, event.threadID, (error) => {
   if (error) {
    api.sendMessage(
     `[ ANTI-OUT ]\n❌ Failed to re-add ${name}.\nThey may have left intentionally or the bot lacks permission.`,
     event.threadID
    );
   } else {
    api.sendMessage(
     `[ ANTI-OUT ]\n🔄 ${name} tried to leave without permission!\nThey have been automatically re-added.\n\nPlease ask an admin before leaving.`,
     event.threadID
    );
   }
  });
 }
};
