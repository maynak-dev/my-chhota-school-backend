const express = require('express');
const auth = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = express.Router();

// Helper to get today's start date (UTC)
const getTodayStart = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
};

// Admin dashboard
router.get('/admin', auth, async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
  try {
    const totalStudents = await prisma.student.count();
    const totalTeachers = await prisma.teacher.count();
    const totalBatches = await prisma.batch.count();
    const totalFeesCollected = await prisma.payment.aggregate({ _sum: { amount: true } });
    const attendanceToday = await prisma.attendance.count({
      where: { date: { gte: getTodayStart() } },
    });

    res.json({
      totalStudents,
      totalTeachers,
      totalBatches,
      totalFeesCollected: totalFeesCollected._sum.amount || 0,
      attendanceToday,
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Teacher dashboard
router.get('/teacher', auth, async (req, res) => {
  if (req.user.role !== 'SUB_ADMIN') return res.status(403).json({ error: 'Forbidden' });
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: req.user.id },
      include: { batches: true },
    });
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });

    const batchIds = teacher.batches.map(b => b.id);
    let students = 0, assignments = 0, attendanceToday = 0;

    if (batchIds.length > 0) {
      students = await prisma.student.count({ where: { batchId: { in: batchIds } } });
      assignments = await prisma.assignment.count({ where: { batchId: { in: batchIds } } });
      attendanceToday = await prisma.attendance.count({
        where: {
          student: { batchId: { in: batchIds } },
          date: { gte: getTodayStart() },
        },
      });
    }

    res.json({ students, assignments, attendanceToday });
  } catch (err) {
    console.error('Teacher dashboard error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Student dashboard
router.get('/student', auth, async (req, res) => {
  if (req.user.role !== 'STUDENT') return res.status(403).json({ error: 'Forbidden' });
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ error: 'Student profile not found' });

    const attendanceCount = await prisma.attendance.count({ where: { studentId: student.id } });
    const assignmentsCount = await prisma.assignment.count({ where: { batchId: student.batchId } });
    const feeRecords = await prisma.fee.findMany({
      where: { studentId: student.id, status: { not: 'PAID' } },
      select: { totalFees: true, paidAmount: true },
    });
    const dueAmount = feeRecords.reduce((sum, f) => sum + (f.totalFees - f.paidAmount), 0);

    res.json({ attendanceCount, assignmentsCount, feeDue: dueAmount });
  } catch (err) {
    console.error('Student dashboard error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Parent dashboard
router.get('/parent', auth, async (req, res) => {
  if (req.user.role !== 'PARENT') return res.status(403).json({ error: 'Forbidden' });
  try {
    const parent = await prisma.parent.findUnique({
      where: { userId: req.user.id },
      include: {
        children: {
          include: {
            user: { select: { name: true } },
            batch: { select: { name: true } },
          },
        },
      },
    });
    if (!parent) return res.status(404).json({ error: 'Parent profile not found' });

    const childrenSummary = parent.children.map(c => ({
      id: c.id,
      name: c.user?.name || 'Unknown',
      rollNumber: c.rollNumber,
      batch: c.batch?.name || 'No batch',
    }));

    res.json({ children: childrenSummary });
  } catch (err) {
    console.error('Parent dashboard error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;