const express = require('express');
const auth = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = express.Router();

// Admin dashboard statistics
router.get('/admin', auth, async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
  try {
    const totalStudents = await prisma.student.count();
    const totalTeachers = await prisma.teacher.count();
    const totalBatches = await prisma.batch.count();
    const totalFeesCollected = await prisma.payment.aggregate({ _sum: { amount: true } });
    const attendanceToday = await prisma.attendance.count({
      where: { date: { gte: new Date().setHours(0, 0, 0, 0) } },
    });

    res.json({
      totalStudents,
      totalTeachers,
      totalBatches,
      totalFeesCollected: totalFeesCollected._sum.amount || 0,
      attendanceToday,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Teacher dashboard statistics
router.get('/teacher', auth, async (req, res) => {
  if (req.user.role !== 'SUB_ADMIN') return res.status(403).json({ error: 'Forbidden' });
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: req.user.id },
      include: { batches: true },
    });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });

    const batchIds = teacher.batches.map(b => b.id);
    const students = await prisma.student.count({ where: { batchId: { in: batchIds } } });
    const assignments = await prisma.assignment.count({ where: { batchId: { in: batchIds } } });
    const attendanceToday = await prisma.attendance.count({
      where: {
        student: { batchId: { in: batchIds } },
        date: { gte: new Date().setHours(0, 0, 0, 0) },
      },
    });

    res.json({ students, assignments, attendanceToday });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Student dashboard statistics
router.get('/student', auth, async (req, res) => {
  if (req.user.role !== 'STUDENT') return res.status(403).json({ error: 'Forbidden' });
  try {
    const student = await prisma.student.findUnique({
      where: { userId: req.user.id },
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const attendanceCount = await prisma.attendance.count({ where: { studentId: student.id } });
    const assignmentsCount = await prisma.assignment.count({
      where: { batchId: student.batchId },
    });
    const feeDue = await prisma.fee.aggregate({
      where: { studentId: student.id, status: { not: 'PAID' } },
      _sum: { totalFees: true, paidAmount: true },
    });
    const dueAmount = (feeDue._sum.totalFees || 0) - (feeDue._sum.paidAmount || 0);

    res.json({ attendanceCount, assignmentsCount, feeDue: dueAmount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Parent dashboard statistics
router.get('/parent', auth, async (req, res) => {
  if (req.user.role !== 'PARENT') return res.status(403).json({ error: 'Forbidden' });
  try {
    const parent = await prisma.parent.findUnique({
      where: { userId: req.user.id },
      include: {
        children: {
          include: { user: true, batch: true },
        },
      },
    });
    if (!parent) return res.status(404).json({ error: 'Parent not found' });

    // For simplicity, return children list (frontend can compute stats per child)
    const childrenSummary = parent.children.map(c => ({
      id: c.id,
      name: c.user.name,
      rollNumber: c.rollNumber,
      batch: c.batch.name,
    }));

    res.json({ children: childrenSummary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;