const express = require('express');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const router = express.Router();

// Get leaves for current teacher
router.get('/me', auth, roleCheck('SUB_ADMIN'), async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
    const leaves = await prisma.leave.findMany({
      where: { teacherId: teacher.id },
      orderBy: { startDate: 'desc' },
    });
    res.json(leaves);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Apply for leave (Teacher)
router.post('/', auth, roleCheck('SUB_ADMIN'), async (req, res) => {
  const { startDate, endDate, reason } = req.body;
  try {
    const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
    const leave = await prisma.leave.create({
      data: {
        teacherId: teacher.id,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
        status: 'PENDING',
      },
    });
    res.status(201).json(leave);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all leave applications (Admin)
router.get('/', auth, roleCheck('ADMIN'), async (req, res) => {
  try {
    const leaves = await prisma.leave.findMany({
      include: { teacher: { include: { user: true } } },
      orderBy: { startDate: 'desc' },
    });
    res.json(leaves);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update leave status (Admin)
router.put('/:id', auth, roleCheck('ADMIN'), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const leave = await prisma.leave.update({
      where: { id },
      data: { status },
    });
    res.json(leave);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/leaves/my — teacher's own leaves
router.get('/my', auth, async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
    const leaves = await prisma.leave.findMany({
      where: { teacherId: teacher.id },
      orderBy: { startDate: 'desc' },
    });
    res.json(leaves);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/leaves — apply leave
router.post('/', auth, roleCheck('SUB_ADMIN'), async (req, res) => {
  const { startDate, endDate, reason } = req.body;
  if (!startDate || !endDate || !reason)
    return res.status(400).json({ error: 'Missing required fields' });
  try {
    const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
    const leave = await prisma.leave.create({
      data: { teacherId: teacher.id, startDate: new Date(startDate), endDate: new Date(endDate), reason, status: 'PENDING' },
    });
    res.status(201).json(leave);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/leaves — all leaves (ADMIN only)
router.get('/', auth, roleCheck('ADMIN'), async (req, res) => {
  try {
    const leaves = await prisma.leave.findMany({
      include: { teacher: { include: { user: true } } },
      orderBy: { startDate: 'desc' },
    });
    res.json(leaves);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/leaves/:id/approve or /reject
router.put('/:id/status', auth, roleCheck('ADMIN'), async (req, res) => {
  const { status } = req.body; // APPROVED or REJECTED
  if (!['APPROVED', 'REJECTED'].includes(status))
    return res.status(400).json({ error: 'Invalid status' });
  try {
    const leave = await prisma.leave.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json(leave);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;