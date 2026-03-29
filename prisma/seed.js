const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data in correct order (due to foreign keys)
  await prisma.$transaction([
    prisma.payment.deleteMany(),
    prisma.fee.deleteMany(),
    prisma.result.deleteMany(),
    prisma.exam.deleteMany(),
    prisma.assignment.deleteMany(),
    prisma.note.deleteMany(),
    prisma.video.deleteMany(),
    prisma.timetable.deleteMany(),
    prisma.studentDiary.deleteMany(),
    prisma.announcement.deleteMany(),
    prisma.attendance.deleteMany(),
    prisma.leave.deleteMany(),
    prisma.payroll.deleteMany(),
    prisma.expense.deleteMany(),
    prisma.student.deleteMany(),
    prisma.teacher.deleteMany(),
    prisma.parent.deleteMany(),
    prisma.batch.deleteMany(),
    prisma.course.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const saltRounds = 10;
  const defaultPassword = await bcrypt.hash('password123', saltRounds);

  // 1. Create Users
  console.log('Creating users...');

  const admin = await prisma.user.create({
    data: {
      email: 'admin@lms.com',
      password: defaultPassword,
      name: 'Admin User',
      role: 'ADMIN',
      phone: '1234567890',
    },
  });

  const teacher1User = await prisma.user.create({
    data: {
      email: 'teacher1@lms.com',
      password: defaultPassword,
      name: 'John Doe',
      role: 'SUB_ADMIN',
      phone: '9876543210',
    },
  });
  const teacher2User = await prisma.user.create({
    data: {
      email: 'teacher2@lms.com',
      password: defaultPassword,
      name: 'Jane Smith',
      role: 'SUB_ADMIN',
      phone: '9988776655',
    },
  });

  const parent1User = await prisma.user.create({
    data: {
      email: 'parent1@lms.com',
      password: defaultPassword,
      name: 'Robert Johnson',
      role: 'PARENT',
      phone: '5551234567',
    },
  });
  const parent2User = await prisma.user.create({
    data: {
      email: 'parent2@lms.com',
      password: defaultPassword,
      name: 'Emily Davis',
      role: 'PARENT',
      phone: '5559876543',
    },
  });

  const student1User = await prisma.user.create({
    data: {
      email: 'student1@lms.com',
      password: defaultPassword,
      name: 'Alice Johnson',
      role: 'STUDENT',
      phone: '1112223333',
    },
  });
  const student2User = await prisma.user.create({
    data: {
      email: 'student2@lms.com',
      password: defaultPassword,
      name: 'Bob Johnson',
      role: 'STUDENT',
      phone: '1112224444',
    },
  });
  const student3User = await prisma.user.create({
    data: {
      email: 'student3@lms.com',
      password: defaultPassword,
      name: 'Charlie Davis',
      role: 'STUDENT',
      phone: '1112225555',
    },
  });

  // 2. Create Teacher profiles
  console.log('Creating teachers...');

  const teacher1 = await prisma.teacher.create({
    data: {
      userId: teacher1User.id,
      subject: 'Mathematics',
      qualification: 'M.Sc. Mathematics',
    },
  });
  const teacher2 = await prisma.teacher.create({
    data: {
      userId: teacher2User.id,
      subject: 'Physics',
      qualification: 'M.Sc. Physics',
    },
  });

  // 3. Create Parent profiles
  console.log('Creating parents...');

  const parent1 = await prisma.parent.create({
    data: { userId: parent1User.id },
  });
  const parent2 = await prisma.parent.create({
    data: { userId: parent2User.id },
  });

  // 4. Create Courses
  console.log('Creating courses...');

  const mathCourse = await prisma.course.create({
    data: { name: 'Mathematics', description: 'Advanced Mathematics' },
  });
  const physicsCourse = await prisma.course.create({
    data: { name: 'Physics', description: 'Physics for high school' },
  });
  const englishCourse = await prisma.course.create({
    data: { name: 'English', description: 'English Language and Literature' },
  });

  // 5. Create Batches
  console.log('Creating batches...');

  const batch10A = await prisma.batch.create({
    data: {
      name: 'Class 10A',
      courseId: mathCourse.id,
      startDate: new Date('2025-04-01'),
      endDate: new Date('2026-03-31'),
      teacherId: teacher1.id,
    },
  });
  const batch10B = await prisma.batch.create({
    data: {
      name: 'Class 10B',
      courseId: physicsCourse.id,
      startDate: new Date('2025-04-01'),
      endDate: new Date('2026-03-31'),
      teacherId: teacher2.id,
    },
  });

  // 6. Create Students
  console.log('Creating students...');

  const student1 = await prisma.student.create({
    data: {
      userId: student1User.id,
      rollNumber: '2025001',
      batchId: batch10A.id,
      parentId: parent1.id,
    },
  });
  const student2 = await prisma.student.create({
    data: {
      userId: student2User.id,
      rollNumber: '2025002',
      batchId: batch10A.id,
      parentId: parent1.id,
    },
  });
  const student3 = await prisma.student.create({
    data: {
      userId: student3User.id,
      rollNumber: '2025003',
      batchId: batch10B.id,
      parentId: parent2.id,
    },
  });

  // 7. Create Timetable
  console.log('Creating timetable...');

  const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
  for (const day of days) {
    await prisma.timetable.create({
      data: {
        batchId: batch10A.id,
        day,
        subject: 'Mathematics',
        startTime: '09:00',
        endTime: '10:00',
        teacherId: teacher1.id,
      },
    });
    await prisma.timetable.create({
      data: {
        batchId: batch10B.id,
        day,
        subject: 'Physics',
        startTime: '10:15',
        endTime: '11:15',
        teacherId: teacher2.id,
      },
    });
  }

  // 8. Create Attendance for last 5 days (including today)
  console.log('Creating attendance...');

  const today = new Date();
  const attendanceDates = [];
  for (let i = 0; i < 5; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    attendanceDates.push(date);
  }

  const students = [student1, student2, student3];
  for (const date of attendanceDates) {
    for (const student of students) {
      const status = Math.random() > 0.2 ? 'PRESENT' : (Math.random() > 0.5 ? 'ABSENT' : 'LATE');
      await prisma.attendance.create({
        data: {
          studentId: student.id,
          date,
          status,
          markedBy: student.batchId === batch10A.id ? teacher1.id : teacher2.id,
        },
      });
    }
  }

  // 9. Create Fees and Payments
  console.log('Creating fees and payments...');

  const feeForStudent1 = await prisma.fee.create({
    data: {
      studentId: student1.id,
      totalFees: 25000,
      paidAmount: 10000,
      dueDate: new Date('2025-06-30'),
      status: 'PENDING',
    },
  });
  const feeForStudent2 = await prisma.fee.create({
    data: {
      studentId: student2.id,
      totalFees: 25000,
      paidAmount: 25000,
      dueDate: new Date('2025-05-31'),
      status: 'PAID',
    },
  });
  const feeForStudent3 = await prisma.fee.create({
    data: {
      studentId: student3.id,
      totalFees: 28000,
      paidAmount: 0,
      dueDate: new Date('2025-07-15'),
      status: 'PENDING',
    },
  });

  // Payments (using new schema: no `date`, use `createdAt` auto, `receiptNo` required, add `status`)
  await prisma.payment.create({
    data: {
      feeId: feeForStudent1.id,
      amount: 5000,
      method: 'CASH',
      receiptNo: 'RCPT-001',
      status: 'APPROVED', // approved payment
      // createdAt will default to now()
    },
  });
  await prisma.payment.create({
    data: {
      feeId: feeForStudent1.id,
      amount: 5000,
      method: 'ONLINE',
      receiptNo: 'RCPT-002',
      transactionId: 'TXN123456',
      status: 'APPROVED',
    },
  });
  await prisma.payment.create({
    data: {
      feeId: feeForStudent2.id,
      amount: 25000,
      method: 'CASH',
      receiptNo: 'RCPT-003',
      status: 'APPROVED',
    },
  });

  // Optionally add a PENDING payment to test admin approval flow
  await prisma.payment.create({
    data: {
      feeId: feeForStudent3.id,
      amount: 5000,
      method: 'ONLINE',
      receiptNo: 'RCPT-004',
      transactionId: 'TXN789012',
      status: 'PENDING',
    },
  });

  // 10. Videos
  console.log('Creating videos...');

  await prisma.video.createMany({
    data: [
      {
        title: 'Introduction to Algebra',
        url: 'https://example.com/video1.mp4',
        batchId: batch10A.id,
        uploadedBy: teacher1User.id,
        duration: 3600,
        createdAt: new Date('2025-04-05'),
      },
      {
        title: 'Quadratic Equations',
        url: 'https://example.com/video2.mp4',
        batchId: batch10A.id,
        uploadedBy: teacher1User.id,
        duration: 2700,
        createdAt: new Date('2025-04-12'),
      },
      {
        title: "Newton's Laws of Motion",
        url: 'https://example.com/video3.mp4',
        batchId: batch10B.id,
        uploadedBy: teacher2User.id,
        duration: 4200,
        createdAt: new Date('2025-04-08'),
      },
    ],
  });

  // 11. Notes / Study Materials
  console.log('Creating notes...');

  await prisma.note.createMany({
    data: [
      {
        title: 'Algebra Notes Chapter 1',
        fileUrl: 'https://example.com/notes/algebra_ch1.pdf',
        batchId: batch10A.id,
        type: 'NOTES',
        uploadedBy: teacher1User.id,
        createdAt: new Date('2025-04-03'),
      },
      {
        title: 'Worksheet: Quadratic Equations',
        fileUrl: 'https://example.com/worksheets/quadratic.pdf',
        batchId: batch10A.id,
        type: 'WORKSHEET',
        uploadedBy: teacher1User.id,
        createdAt: new Date('2025-04-10'),
      },
      {
        title: 'Physics Formula Sheet',
        fileUrl: 'https://example.com/notes/physics_formulas.pdf',
        batchId: batch10B.id,
        type: 'NOTES',
        uploadedBy: teacher2User.id,
        createdAt: new Date('2025-04-07'),
      },
    ],
  });

  // 12. Assignments
  console.log('Creating assignments...');

  await prisma.assignment.createMany({
    data: [
      {
        title: 'Algebra Homework 1',
        description: 'Solve problems 1-10 from Chapter 1',
        dueDate: new Date('2025-05-20'),
        fileUrl: 'https://example.com/assignments/algebra_hw1.pdf',
        batchId: batch10A.id,
        createdBy: teacher1.id,
        createdAt: new Date('2025-04-15'),
      },
      {
        title: 'Physics Lab Report',
        description: 'Write a report on the experiment',
        dueDate: new Date('2025-05-25'),
        batchId: batch10B.id,
        createdBy: teacher2.id,
        createdAt: new Date('2025-04-18'),
      },
    ],
  });

  // 13. Exams
  console.log('Creating exams...');

  const exam1 = await prisma.exam.create({
    data: {
      name: 'Mid-Term Exam - Mathematics',
      date: new Date('2025-06-15'),
      maxMarks: 100,
      batchId: batch10A.id,
    },
  });
  const exam2 = await prisma.exam.create({
    data: {
      name: 'Mid-Term Exam - Physics',
      date: new Date('2025-06-18'),
      maxMarks: 100,
      batchId: batch10B.id,
    },
  });

  // 14. Results
  console.log('Creating results...');

  await prisma.result.createMany({
    data: [
      { studentId: student1.id, examId: exam1.id, marksObtained: 85, feedback: 'Good work!' },
      { studentId: student2.id, examId: exam1.id, marksObtained: 92, feedback: 'Excellent!' },
      { studentId: student3.id, examId: exam2.id, marksObtained: 78, feedback: 'Needs improvement' },
    ],
  });

  // 15. Announcements
  console.log('Creating announcements...');

  await prisma.announcement.createMany({
    data: [
      {
        title: 'School Holiday',
        content: 'School will remain closed on May 1st for Labour Day.',
        targetRole: null,
        createdBy: admin.id,
        createdAt: new Date('2025-04-20'),
      },
      {
        title: 'Parent-Teacher Meeting',
        content: 'PTM scheduled for June 5th at 10:00 AM.',
        targetRole: 'PARENT',
        createdBy: admin.id,
        createdAt: new Date('2025-04-22'),
      },
      {
        title: 'Exam Schedule Released',
        content: 'Mid-term exams will start from June 15th. Check timetable.',
        targetRole: 'STUDENT',
        createdBy: teacher1User.id,
        createdAt: new Date('2025-04-25'),
      },
    ],
  });

  // 16. Student Diary Entries
  console.log('Creating student diary entries...');

  await prisma.studentDiary.createMany({
    data: [
      {
        studentId: student1.id,
        date: new Date('2025-04-18'),
        content: 'Completed algebra assignment on time.',
        type: 'REMARK',
        createdBy: teacher1.id,
      },
      {
        studentId: student2.id,
        date: new Date('2025-04-18'),
        content: 'Needs to practice quadratic equations.',
        type: 'HOMEWORK',
        createdBy: teacher1.id,
      },
      {
        studentId: student3.id,
        date: new Date('2025-04-19'),
        content: 'Participated well in class discussion.',
        type: 'BEHAVIOR',
        createdBy: teacher2.id,
      },
    ],
  });

  // 17. Notifications
  console.log('Creating notifications...');

  await prisma.notification.createMany({
    data: [
      {
        type: 'ANNOUNCEMENT',
        title: 'Welcome to the new semester!',
        message: 'All classes will start from April 1st. Please check your timetable.',
        targetRole: null,
        isRead: false,
        createdAt: new Date('2025-03-28'),
      },
      {
        type: 'ANNOUNCEMENT',
        title: 'Parent-Teacher Meeting Reminder',
        message: 'The PTM will be held on June 5th at 10:00 AM. Your presence is important.',
        targetRole: 'PARENT',
        isRead: false,
        createdAt: new Date('2025-04-01'),
      },
      {
        type: 'FEE_PAYMENT',
        title: 'Fee Reminder',
        message: `Your fee of ₹${feeForStudent1.totalFees - feeForStudent1.paidAmount} is due by ${feeForStudent1.dueDate.toLocaleDateString()}.`,
        studentId: student1.id,
        studentName: student1User.name,
        amount: feeForStudent1.totalFees - feeForStudent1.paidAmount,
        isRead: false,
        createdAt: new Date('2025-04-15'),
      },
      {
        type: 'ANNOUNCEMENT',
        title: 'Holiday Notice',
        message: 'School will remain closed on May 1st (Labour Day).',
        targetRole: null,
        isRead: true,
        createdAt: new Date('2025-04-20'),
      },
    ],
  });

  console.log('✅ Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });