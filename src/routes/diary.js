const express = require('express');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();

// GET all diary entries — ADMIN/SUB_ADMIN
router.get('/', auth, roleCheck('ADMIN', 'SUB_ADMIN'), async (req, res) => {
  try {
    const entries = await prisma.studentDiary.findMany({
      include: { student: { include: { user: true } } },
      orderBy: { date: 'desc' },
    });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET diary entries for a specific student
router.get('/student/:studentId', auth, async (req, res) => {
  try {
    const entries = await prisma.studentDiary.findMany({
      where: { studentId: req.params.studentId },
      orderBy: { date: 'desc' },
    });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET my diary (for student's own view)
router.get('/my', auth, async (req, res) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    const entries = await prisma.studentDiary.findMany({
      where: { studentId: student.id },
      orderBy: { date: 'desc' },
    });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create diary entry — SUB_ADMIN/ADMIN (teachers)
router.post('/', auth, roleCheck('ADMIN', 'SUB_ADMIN'), async (req, res) => {
  const { studentId, content, type } = req.body;
  if (!studentId || !content || !type)
    return res.status(400).json({ error: 'Missing required fields' });
  try {
    const entry = await prisma.studentDiary.create({
      data: {
        studentId,
        content,
        type, // HOMEWORK, REMARK, BEHAVIOR
        createdBy: req.user.id,
      },
      include: { student: { include: { user: true } } },
    });
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;