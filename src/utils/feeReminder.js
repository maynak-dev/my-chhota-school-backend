const { PrismaClient } = require('@prisma/client');
const { sendEmail } = require('./email');
const prisma = new PrismaClient();

async function sendFeeReminders() {
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  try {
    // Find fees due in the next 3 days, PENDING/PARTIAL, and reminder not yet sent
    const dueFees = await prisma.fee.findMany({
      where: {
        status: { in: ['PENDING', 'PARTIAL'] },
        dueDate: {
          gte: now,
          lte: threeDaysFromNow,
        },
        reminderSentAt: null, // ✅ Only remind if never reminded before
      },
      include: {
        student: {
          include: {
            user: true,
            parent: { include: { user: true } },
          },
        },
      },
    });

    for (const fee of dueFees) {
      const student = fee.student;
      const parentEmail = student.parent?.user?.email;
      const studentEmail = student.user?.email;
      const dueDate = new Date(fee.dueDate).toLocaleDateString();
      const outstanding = fee.totalFees - fee.paidAmount;

      const subject = `Fee Reminder — Due on ${dueDate}`;
      const body = `Dear Parent/Guardian of ${student.user.name},\n\nThis is a reminder that a fee payment of ₹${outstanding} is due on ${dueDate}.\n\nPlease login to the portal to make the payment.\n\nRegards,\nSchool Admin`;

      if (parentEmail) await sendEmail(parentEmail, subject, body).catch(console.error);
      if (studentEmail) await sendEmail(studentEmail, subject, body).catch(console.error);

      // Create a notification record
      await prisma.notification.create({
        data: {
          type: 'FEE_PAYMENT',
          title: 'Fee Due Reminder',
          message: `Fee of ₹${outstanding} for ${student.user.name} is due on ${dueDate}`,
          studentId: student.id,
          studentName: student.user.name,
          amount: outstanding,
        },
      }).catch(console.error);

      // ✅ Mark this fee as reminded so it won't be sent again
      await prisma.fee.update({
        where: { id: fee.id },
        data: { reminderSentAt: new Date() },
      }).catch(console.error);
    }

    console.log(`[FeeReminder] Sent reminders for ${dueFees.length} fee(s)`);
  } catch (err) {
    console.error('[FeeReminder] Error:', err.message);
  }
}

module.exports = { sendFeeReminders };