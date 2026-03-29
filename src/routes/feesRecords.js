const express = require('express');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();

// ----------------------------------------------------------------------
// 🔒 ADMIN / SUB_ADMIN only routes
// ----------------------------------------------------------------------
router.get('/', auth, roleCheck('ADMIN', 'SUB_ADMIN'), async (req, res) => {
  try {
    const fees = await prisma.fee.findMany({
      include: { student: { include: { user: true } } },
      orderBy: { dueDate: 'asc' }
    });
    res.json(fees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, roleCheck('ADMIN', 'SUB_ADMIN'), async (req, res) => {
  const { studentId, totalFees, dueDate } = req.body;
  if (!studentId || !totalFees || !dueDate) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const fee = await prisma.fee.create({
      data: {
        studentId,
        totalFees: parseFloat(totalFees),
        dueDate: new Date(dueDate),
        paidAmount: 0,
        status: 'PENDING'
      }
    });
    res.status(201).json(fee);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, roleCheck('ADMIN', 'SUB_ADMIN'), async (req, res) => {
  const { id } = req.params;
  const { totalFees, dueDate, status } = req.body;
  try {
    const fee = await prisma.fee.update({
      where: { id },
      data: {
        totalFees: totalFees ? parseFloat(totalFees) : undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        status: status || undefined
      }
    });
    res.json(fee);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------
// 👪 PARENT / STUDENT accessible routes
// ----------------------------------------------------------------------

// 1) Get fees for a specific student (by student ID)
router.get('/student/:studentId', auth, async (req, res) => {
  const { studentId } = req.params;
  const user = req.user;

  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { parent: { include: { user: true } }, user: true }
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    let isAuthorized = false;
    if (user.role === 'ADMIN' || user.role === 'SUB_ADMIN') {
      isAuthorized = true;
    } else if (user.role === 'STUDENT') {
      const currentStudent = await prisma.student.findUnique({ where: { userId: user.id } });
      if (currentStudent && currentStudent.id === studentId) isAuthorized = true;
    } else if (user.role === 'PARENT') {
      const parent = await prisma.parent.findUnique({
        where: { userId: user.id },
        include: { children: true }
      });
      if (parent && parent.children.some(c => c.id === studentId)) isAuthorized = true;
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Forbidden: You cannot view fees for this student' });
    }

    const fees = await prisma.fee.findMany({
      where: { studentId },
      include: { payments: true },
      orderBy: { dueDate: 'asc' }
    });
    res.json(fees);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 2) NEW: Get fees for all children of the logged-in parent (or the student themselves)
router.get('/my-fees', auth, async (req, res) => {
  const user = req.user;
  try {
    let studentIds = [];
    if (user.role === 'STUDENT') {
      const student = await prisma.student.findUnique({ where: { userId: user.id } });
      if (!student) return res.status(404).json({ error: 'Student not found' });
      studentIds = [student.id];
    } else if (user.role === 'PARENT') {
      const parent = await prisma.parent.findUnique({
        where: { userId: user.id },
        include: { children: true }
      });
      if (!parent) return res.status(404).json({ error: 'Parent not found' });
      studentIds = parent.children.map(c => c.id);
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }

    const fees = await prisma.fee.findMany({
      where: { studentId: { in: studentIds } },
      include: { student: { include: { user: true } }, payments: true },
      orderBy: { dueDate: 'asc' }
    });
    res.json(fees);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;