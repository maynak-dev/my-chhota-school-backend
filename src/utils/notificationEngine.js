const sendNotification = async ({ to, subject, message, type = 'info' }) => {
  console.log(`[Notification] To: ${to}, Subject: ${subject}, Type: ${type}`);
  // TODO: integrate with email/SMS/push service
  return { success: true };
};

module.exports = { sendNotification };
