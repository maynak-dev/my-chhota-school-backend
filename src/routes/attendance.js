const express = require('express');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const router = express.Router();

// ✅ Attendance Report (Admin)
router.get('/report', auth, roleCheck('ADMIN'), async (req, res) => {
  try {
    const students = await prisma.student.findMany({
      include: {
        user: { select: { name: true } },
        batch: { select: { name: true } },
        attendance: true,
      },
    });

    const report = students.map((s) => {
      const total = s.attendance.length;
      const present = s.attendance.filter((a) => a.status === 'PRESENT').length;
      const absent = s.attendance.filter((a) => a.status === 'ABSENT').length;
      const late = s.attendance.filter((a) => a.status === 'LATE').length;
      const percentage = total > 0 ? ((present / total) * 100).toFixed(1) + '%' : 'N/A';
      return {
        Student: s.user.name,
        'Roll No': s.rollNumber,
        Batch: s.batch?.name || '—',
        Present: present,
        Absent: absent,
        Late: late,
        Total: total,
        'Attendance %': percentage,
      };
    });

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get attendance for a batch (Admin/Teacher)
router.get('/batch/:batchId', auth, roleCheck('ADMIN', 'SUB_ADMIN'), async (req, res) => {
  const { batchId } = req.params;
  const { date } = req.query;
  try {
    const attendance = await prisma.attendance.findMany({
      where: { student: { batchId }, date: date ? new Date(date) : undefined },
      include: { student: { include: { user: true } } },
    });
    res.json(attendance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get student's attendance (Student/Parent)
router.get('/student/:studentId', auth, async (req, res) => {
  const { studentId } = req.params;
  const { startDate, endDate } = req.query;
  if (req.user.role === 'STUDENT') {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (student?.id !== studentId) return res.status(403).json({ error: 'Forbidden' });
  } else if (req.user.role === 'PARENT') {
    const parent = await prisma.parent.findUnique({ where: { userId: req.user.id }, include: { children: true } });
    if (!parent.children.some(c => c.id === studentId)) return res.status(403).json({ error: 'Forbidden' });
  } else if (req.user.role !== 'ADMIN' && req.user.role !== 'SUB_ADMIN') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const attendance = await prisma.attendance.findMany({
      where: {
        studentId,
        date: {
          gte: startDate ? new Date(startDate) : undefined,
          lte: endDate ? new Date(endDate) : undefined,
        },
      },
      orderBy: { date: 'desc' },
    });
    res.json(attendance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark attendance (Teacher)
router.post('/', auth, roleCheck('SUB_ADMIN'), async (req, res) => {
  const { studentId, status, date, markedBy } = req.body;
  try {
    const attendance = await prisma.attendance.create({
      data: { studentId, status, date: new Date(date), markedBy },
    });
    res.status(201).json(attendance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk mark attendance (Teacher)
router.post('/bulk', auth, roleCheck('SUB_ADMIN'), async (req, res) => {
  const { entries } = req.body;
  try {
    const created = await prisma.$transaction(
      entries.map(entry =>
        prisma.attendance.create({
          data: { ...entry, date: new Date(entry.date) },
        })
      )
    );
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
