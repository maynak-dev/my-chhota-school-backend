const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Clean up (reverse dependency order) ──
  await prisma.examSubmission.deleteMany();
  await prisma.examQuestion.deleteMany();
  await prisma.onlineExam.deleteMany();
  await prisma.questionBank.deleteMany();
  await prisma.eMIPlan.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.subscriptionPlan.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.discussionReply.deleteMany();
  await prisma.discussion.deleteMany();
  await prisma.livePoll.deleteMany();
  await prisma.handRaise.deleteMany();
  await prisma.liveChat.deleteMany();
  await prisma.liveClass.deleteMany();
  await prisma.videoEngagement.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.module.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.notificationRule.deleteMany();
  await prisma.dataAccessLog.deleteMany();
  await prisma.certificate.deleteMany();
  await prisma.studentStreak.deleteMany();
  await prisma.studentBadge.deleteMany();
  await prisma.badge.deleteMany();
  await prisma.parentMeeting.deleteMany();
  await prisma.studentDiary.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.payroll.deleteMany();
  await prisma.leave.deleteMany();
  await prisma.result.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.timetable.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.note.deleteMany();
  await prisma.video.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.fee.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.student.deleteMany();
  await prisma.batch.deleteMany();
  await prisma.course.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.parent.deleteMany();
  await prisma.user.deleteMany();

  const hash = (pw) => bcrypt.hashSync(pw, 10);

  // ── Users ──
  const adminUser = await prisma.user.create({
    data: {
      email: "admin@mychhota.school",
      password: hash("Admin@123"),
      name: "Super Admin",
      role: "ADMIN",
      phone: "9876543210",
    },
  });

  const subAdminUser = await prisma.user.create({
    data: {
      email: "subadmin@mychhota.school",
      password: hash("SubAdmin@123"),
      name: "Sub Admin",
      role: "SUB_ADMIN",
      phone: "9876543211",
    },
  });

  const teacherUser1 = await prisma.user.create({
    data: {
      email: "ravi.sharma@mychhota.school",
      password: hash("Teacher@123"),
      name: "Ravi Sharma",
      role: "ADMIN", // Teachers use ADMIN/SUB_ADMIN role based on your enum
      phone: "9876543212",
    },
  });

  const teacherUser2 = await prisma.user.create({
    data: {
      email: "priya.verma@mychhota.school",
      password: hash("Teacher@123"),
      name: "Priya Verma",
      role: "SUB_ADMIN",
      phone: "9876543213",
    },
  });

  const parentUser1 = await prisma.user.create({
    data: {
      email: "parent1@mychhota.school",
      password: hash("Parent@123"),
      name: "Rajesh Kumar",
      role: "PARENT",
      phone: "9876543214",
    },
  });

  const parentUser2 = await prisma.user.create({
    data: {
      email: "parent2@mychhota.school",
      password: hash("Parent@123"),
      name: "Sunita Devi",
      role: "PARENT",
      phone: "9876543215",
    },
  });

  const studentUser1 = await prisma.user.create({
    data: {
      email: "aarav@mychhota.school",
      password: hash("Student@123"),
      name: "Aarav Kumar",
      role: "STUDENT",
      phone: "9876543216",
    },
  });

  const studentUser2 = await prisma.user.create({
    data: {
      email: "ananya@mychhota.school",
      password: hash("Student@123"),
      name: "Ananya Singh",
      role: "STUDENT",
      phone: "9876543217",
    },
  });

  const studentUser3 = await prisma.user.create({
    data: {
      email: "arjun@mychhota.school",
      password: hash("Student@123"),
      name: "Arjun Patel",
      role: "STUDENT",
      phone: "9876543218",
    },
  });

  // ── Teachers ──
  const teacher1 = await prisma.teacher.create({
    data: { userId: teacherUser1.id, subject: "Mathematics", qualification: "M.Sc Mathematics" },
  });

  const teacher2 = await prisma.teacher.create({
    data: { userId: teacherUser2.id, subject: "Science", qualification: "M.Sc Physics" },
  });

  // ── Parents ──
  const parent1 = await prisma.parent.create({ data: { userId: parentUser1.id } });
  const parent2 = await prisma.parent.create({ data: { userId: parentUser2.id } });

  // ── Courses ──
  const courseMath = await prisma.course.create({
    data: { name: "Class 10 Mathematics", description: "CBSE Class 10 Maths – Complete syllabus" },
  });

  const courseScience = await prisma.course.create({
    data: { name: "Class 10 Science", description: "CBSE Class 10 Science – Physics, Chemistry, Biology" },
  });

  // ── Batches ──
  const batchA = await prisma.batch.create({
    data: {
      name: "Batch A – Maths 2025",
      courseId: courseMath.id,
      startDate: new Date("2025-04-01"),
      endDate: new Date("2026-03-31"),
      teacherId: teacher1.id,
    },
  });

  const batchB = await prisma.batch.create({
    data: {
      name: "Batch B – Science 2025",
      courseId: courseScience.id,
      startDate: new Date("2025-04-01"),
      endDate: new Date("2026-03-31"),
      teacherId: teacher2.id,
    },
  });

  // ── Students ──
  const student1 = await prisma.student.create({
    data: { userId: studentUser1.id, rollNumber: "STU-001", batchId: batchA.id, parentId: parent1.id },
  });

  const student2 = await prisma.student.create({
    data: { userId: studentUser2.id, rollNumber: "STU-002", batchId: batchA.id, parentId: parent2.id },
  });

  const student3 = await prisma.student.create({
    data: { userId: studentUser3.id, rollNumber: "STU-003", batchId: batchB.id, parentId: parent1.id },
  });

  // ── Fees ──
  const fee1 = await prisma.fee.create({
    data: { studentId: student1.id, totalFees: 25000, paidAmount: 15000, dueDate: new Date("2025-06-30"), status: "PARTIAL" },
  });

  const fee2 = await prisma.fee.create({
    data: { studentId: student2.id, totalFees: 25000, paidAmount: 25000, dueDate: new Date("2025-06-30"), status: "PAID" },
  });

  const fee3 = await prisma.fee.create({
    data: { studentId: student3.id, totalFees: 22000, paidAmount: 0, dueDate: new Date("2025-05-15"), status: "PENDING" },
  });

  // ── Payments ──
  await prisma.payment.create({
    data: { feeId: fee1.id, amount: 15000, method: "ONLINE", receiptNo: "REC-001", status: "APPROVED", transactionId: "TXN123456" },
  });

  await prisma.payment.create({
    data: { feeId: fee2.id, amount: 25000, method: "CARD", receiptNo: "REC-002", status: "APPROVED", transactionId: "TXN123457" },
  });

  // ── EMI Plan ──
  await prisma.eMIPlan.create({
    data: { feeId: fee3.id, totalAmount: 22000, installments: 4, amountPerEMI: 5500, nextDueDate: new Date("2025-05-15") },
  });

  // ── Videos ──
  const video1 = await prisma.video.create({
    data: { title: "Quadratic Equations – Part 1", url: "https://youtube.com/example1", batchId: batchA.id, uploadedBy: teacherUser1.id, duration: 2400 },
  });

  await prisma.video.create({
    data: { title: "Chemical Reactions – Introduction", url: "https://youtube.com/example2", batchId: batchB.id, uploadedBy: teacherUser2.id, duration: 1800 },
  });

  // ── Video Engagement ──
  await prisma.videoEngagement.create({
    data: { videoId: video1.id, studentId: student1.id, watchTime: 1800, completed: false, dropOffAt: 1800 },
  });

  // ── Notes ──
  await prisma.note.create({
    data: { title: "Algebra Formulae Sheet", fileUrl: "/uploads/algebra.pdf", batchId: batchA.id, type: "NOTES", uploadedBy: teacherUser1.id },
  });

  await prisma.note.create({
    data: { title: "Science Worksheet – Ch 1", fileUrl: "/uploads/science_ws1.pdf", batchId: batchB.id, type: "WORKSHEET", uploadedBy: teacherUser2.id },
  });

  // ── Modules & Lessons ──
  const module1 = await prisma.module.create({
    data: { courseId: courseMath.id, title: "Algebra", description: "Linear & Quadratic Equations", order: 1 },
  });

  const module2 = await prisma.module.create({
    data: { courseId: courseMath.id, title: "Geometry", description: "Triangles, Circles, Coordinate Geometry", order: 2, prerequisiteId: module1.id },
  });

  await prisma.lesson.create({
    data: { moduleId: module1.id, title: "Introduction to Linear Equations", content: "<p>A linear equation is...</p>", videoUrl: "https://youtube.com/example1", duration: 1200, order: 1 },
  });

  await prisma.lesson.create({
    data: { moduleId: module1.id, title: "Solving Quadratic Equations", content: "<p>The quadratic formula is...</p>", duration: 1500, order: 2 },
  });

  await prisma.lesson.create({
    data: { moduleId: module2.id, title: "Properties of Triangles", content: "<p>Types of triangles...</p>", duration: 1100, order: 1 },
  });

  // ── Attendance ──
  const today = new Date();
  for (const s of [student1, student2]) {
    await prisma.attendance.create({
      data: { studentId: s.id, date: today, status: "PRESENT", markedBy: teacher1.id },
    });
  }
  await prisma.attendance.create({
    data: { studentId: student3.id, date: today, status: "ABSENT", markedBy: teacher2.id },
  });

  // ── Announcements ──
  await prisma.announcement.create({
    data: { title: "Summer Vacation Notice", content: "School will remain closed from May 15 to June 15.", createdBy: adminUser.id },
  });

  await prisma.announcement.create({
    data: { title: "Fee Reminder", content: "Please clear pending fees before May 10.", targetRole: "PARENT", createdBy: adminUser.id },
  });

  // ── Timetable ──
  await prisma.timetable.create({
    data: { batchId: batchA.id, day: "MONDAY", subject: "Mathematics", startTime: "09:00", endTime: "10:00", teacherId: teacher1.id },
  });

  await prisma.timetable.create({
    data: { batchId: batchA.id, day: "MONDAY", subject: "Science", startTime: "10:15", endTime: "11:15", teacherId: teacher2.id },
  });

  await prisma.timetable.create({
    data: { batchId: batchB.id, day: "TUESDAY", subject: "Science", startTime: "09:00", endTime: "10:00", teacherId: teacher2.id },
  });

  // ── Assignments ──
  await prisma.assignment.create({
    data: { title: "Algebra Practice Set 1", description: "Solve exercises 1-20 from Chapter 3", dueDate: new Date("2025-05-01"), batchId: batchA.id, createdBy: teacher1.id },
  });

  // ── Exams & Results ──
  const exam1 = await prisma.exam.create({
    data: { name: "Mid-Term Maths", date: new Date("2025-06-15"), maxMarks: 100, batchId: batchA.id },
  });

  await prisma.result.create({
    data: { studentId: student1.id, examId: exam1.id, marksObtained: 82, feedback: "Good performance" },
  });

  await prisma.result.create({
    data: { studentId: student2.id, examId: exam1.id, marksObtained: 91, feedback: "Excellent!" },
  });

  // ── Leave ──
  await prisma.leave.create({
    data: { teacherId: teacher1.id, startDate: new Date("2025-05-20"), endDate: new Date("2025-05-22"), reason: "Family function", status: "APPROVED" },
  });

  // ── Payroll ──
  await prisma.payroll.create({
    data: { teacherId: teacher1.id, month: 4, year: 2025, amount: 35000, deductions: 2000, netAmount: 33000, paid: true, paidAt: new Date("2025-04-30") },
  });

  await prisma.payroll.create({
    data: { teacherId: teacher2.id, month: 4, year: 2025, amount: 32000, deductions: 1500, netAmount: 30500, paid: false },
  });

  // ── Expense ──
  await prisma.expense.create({
    data: { description: "Projector Maintenance", amount: 4500, category: "EQUIPMENT", createdBy: adminUser.id },
  });

  // ── Student Diary ──
  await prisma.studentDiary.create({
    data: { studentId: student1.id, content: "Completed homework on time. Good behaviour in class.", type: "REMARK", createdBy: teacher1.id },
  });

  // ── Notifications ──
  await prisma.notification.create({
    data: { type: "FEE_PAYMENT", title: "Payment Received", message: "₹15,000 received for Aarav Kumar", studentId: student1.id, studentName: "Aarav Kumar", amount: 15000 },
  });

  await prisma.notification.create({
    data: { type: "ANNOUNCEMENT", title: "Summer Vacation", message: "School closed May 15 – June 15" },
  });

  // ── Permissions & RBAC ──
  const permissions = await Promise.all(
    ["manage_users", "view_reports", "manage_fees", "manage_courses", "manage_attendance", "manage_exams"].map((name) =>
      prisma.permission.create({ data: { name, description: `Permission to ${name.replace("_", " ")}` } })
    )
  );

  // Admin gets all permissions
  for (const perm of permissions) {
    await prisma.rolePermission.create({ data: { role: "ADMIN", permissionId: perm.id } });
  }

  // Sub-admin gets view_reports, manage_attendance
  for (const perm of permissions.filter((p) => ["view_reports", "manage_attendance"].includes(p.name))) {
    await prisma.rolePermission.create({ data: { role: "SUB_ADMIN", permissionId: perm.id } });
  }

  // ── Activity Log ──
  await prisma.activityLog.create({
    data: { userId: adminUser.id, action: "LOGIN", entity: "User", entityId: adminUser.id, details: { browser: "Chrome" }, ipAddress: "192.168.1.1" },
  });

  // ── Live Class ──
  const liveClass = await prisma.liveClass.create({
    data: {
      title: "Quadratic Equations – Live Doubt Session",
      batchId: batchA.id,
      hostId: teacher1.id,
      platform: "ZOOM",
      meetingUrl: "https://zoom.us/j/123456789",
      meetingId: "123456789",
      scheduledAt: new Date("2025-05-10T16:00:00Z"),
      duration: 60,
      status: "SCHEDULED",
    },
  });

  await prisma.liveChat.create({
    data: { liveClassId: liveClass.id, userId: studentUser1.id, userName: "Aarav Kumar", message: "Sir, can you explain the discriminant?" },
  });

  await prisma.handRaise.create({
    data: { liveClassId: liveClass.id, userId: studentUser2.id, userName: "Ananya Singh" },
  });

  await prisma.livePoll.create({
    data: { liveClassId: liveClass.id, question: "Which method do you prefer for solving quadratics?", options: ["Factoring", "Quadratic Formula", "Completing the Square"], isActive: true },
  });

  // ── Discussion ──
  const discussion = await prisma.discussion.create({
    data: { courseId: courseMath.id, title: "How to remember trigonometric identities?", body: "I keep forgetting the formulas. Any tips?", userId: studentUser1.id, userName: "Aarav Kumar", userRole: "STUDENT" },
  });

  await prisma.discussionReply.create({
    data: { discussionId: discussion.id, body: "Try using mnemonics like SOH-CAH-TOA!", userId: teacherUser1.id, userName: "Ravi Sharma", userRole: "ADMIN" },
  });

  // ── Chat ──
  await prisma.chatMessage.create({
    data: { senderId: studentUser1.id, receiverId: teacherUser1.id, message: "Sir, I have a doubt in chapter 3." },
  });

  await prisma.chatMessage.create({
    data: { senderId: teacherUser1.id, receiverId: studentUser1.id, message: "Sure Aarav, send me the question." },
  });

  // ── Subscription Plans ──
  await prisma.subscriptionPlan.create({
    data: { name: "Monthly Plan", amount: 2500, duration: 1, description: "Access all courses for 1 month" },
  });

  await prisma.subscriptionPlan.create({
    data: { name: "Annual Plan", amount: 22000, duration: 12, description: "Access all courses for 12 months – Save 27%" },
  });

  // ── Coupons ──
  await prisma.coupon.create({
    data: { code: "WELCOME10", discountType: "PERCENTAGE", discountValue: 10, maxUses: 100, validFrom: new Date("2025-04-01"), validTo: new Date("2025-12-31") },
  });

  await prisma.coupon.create({
    data: { code: "FLAT500", discountType: "FIXED", discountValue: 500, maxUses: 50, validFrom: new Date("2025-04-01"), validTo: new Date("2025-06-30") },
  });

  // ── Question Bank & Online Exam ──
  const qb1 = await prisma.questionBank.create({
    data: { courseId: courseMath.id, question: "What is the value of x in 2x + 5 = 15?", options: ["3", "5", "7", "10"], correctIndex: 1, difficulty: "EASY", tags: "algebra,linear" },
  });

  await prisma.questionBank.create({
    data: { courseId: courseMath.id, question: "Find the roots of x² - 5x + 6 = 0", options: ["2, 3", "1, 6", "-2, -3", "3, -2"], correctIndex: 0, difficulty: "MEDIUM", tags: "algebra,quadratic" },
  });

  const onlineExam = await prisma.onlineExam.create({
    data: {
      title: "Algebra Quick Quiz",
      batchId: batchA.id,
      duration: 30,
      totalMarks: 10,
      randomize: true,
      proctoring: true,
      startTime: new Date("2025-05-12T10:00:00Z"),
      endTime: new Date("2025-05-12T10:30:00Z"),
    },
  });

  await prisma.examQuestion.create({
    data: { examId: onlineExam.id, questionBankId: qb1.id, question: qb1.question, options: qb1.options, correctIndex: qb1.correctIndex, marks: 2, order: 1 },
  });

  await prisma.examSubmission.create({
    data: { examId: onlineExam.id, studentId: student1.id, answers: { [qb1.id]: 1 }, score: 2, tabSwitches: 0 },
  });

  // ── Badges & Gamification ──
  const badge1 = await prisma.badge.create({
    data: { name: "First Login", description: "Logged in for the first time", icon: "🎉", criteria: "first_login" },
  });

  const badge2 = await prisma.badge.create({
    data: { name: "Streak Master", description: "Maintained a 7-day login streak", icon: "🔥", criteria: "streak_7" },
  });

  await prisma.studentBadge.create({ data: { studentId: student1.id, badgeId: badge1.id } });
  await prisma.studentBadge.create({ data: { studentId: student1.id, badgeId: badge2.id } });

  await prisma.studentStreak.create({
    data: { studentId: student1.id, currentStreak: 5, longestStreak: 12, lastActiveDate: today },
  });

  // ── Certificates ──
  await prisma.certificate.create({
    data: { studentId: student2.id, courseId: courseMath.id, courseName: "Class 10 Mathematics", studentName: "Ananya Singh" },
  });

  // ── Parent Meeting ──
  await prisma.parentMeeting.create({
    data: { parentId: parent1.id, teacherId: teacher1.id, scheduledAt: new Date("2025-05-18T11:00:00Z"), status: "SCHEDULED", notes: "Discuss Aarav's mid-term performance" },
  });

  // ── Notification Rules ──
  await prisma.notificationRule.create({
    data: { name: "Low Attendance Alert", trigger: "LOW_ATTENDANCE", condition: { threshold: 75 }, template: "{{studentName}}'s attendance is below {{threshold}}%", targetRole: "PARENT", isActive: true },
  });

  await prisma.notificationRule.create({
    data: { name: "Fee Due Reminder", trigger: "FEE_DUE", condition: { daysBefore: 3 }, template: "Fee of ₹{{amount}} is due on {{dueDate}} for {{studentName}}", targetRole: "PARENT", isActive: true },
  });

  // ── Data Access Log ──
  await prisma.dataAccessLog.create({
    data: { userId: adminUser.id, resource: "student_records", action: "VIEW", details: { query: "all students" }, ipAddress: "192.168.1.1" },
  });

  // ── Student Diary (extra) ──
  await prisma.studentDiary.create({
    data: { studentId: student2.id, content: "Homework: Complete exercises 5.1 and 5.2", type: "HOMEWORK", createdBy: teacher1.id },
  });

  console.log("✅ Seeding complete!");
  console.log("\n📋 Login Credentials:");
  console.log("─────────────────────────────────────");
  console.log("Admin:     admin@mychhota.school / Admin@123");
  console.log("Sub-Admin: subadmin@mychhota.school / SubAdmin@123");
  console.log("Teacher 1: ravi.sharma@mychhota.school / Teacher@123");
  console.log("Teacher 2: priya.verma@mychhota.school / Teacher@123");
  console.log("Parent 1:  parent1@mychhota.school / Parent@123");
  console.log("Parent 2:  parent2@mychhota.school / Parent@123");
  console.log("Student 1: aarav@mychhota.school / Student@123");
  console.log("Student 2: ananya@mychhota.school / Student@123");
  console.log("Student 3: arjun@mychhota.school / Student@123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
