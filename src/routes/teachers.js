const express = require('express');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const router = express.Router();

// Get all teachers (Admin)
router.get('/', auth, roleCheck('ADMIN'), async (req, res) => {
  try {
    const teachers = await prisma.teacher.findMany({
      include: { user: true, batches: true },
    });
    res.json(teachers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current teacher (own profile)
router.get('/me', auth, roleCheck('SUB_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: req.user.id },
      include: { user: true, batches: true, timetable: true, assignments: true },
    });
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });
    res.json(teacher);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ NEW: Get teacher's batches
router.get('/me/batches', auth, roleCheck('SUB_ADMIN'), async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: req.user.id },
      include: { batches: true },
    });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
    res.json(teacher.batches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get teacher by ID (Admin only)
router.get('/:id', auth, roleCheck('ADMIN'), async (req, res) => {
  const { id } = req.params;
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { id },
      include: { user: true, batches: true },
    });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
    res.json(teacher);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create teacher (Admin only)
router.post('/', auth, roleCheck('ADMIN'), async (req, res) => {
  const { userId, subject, qualification } = req.body;
  try {
    const teacher = await prisma.teacher.create({
      data: { userId, subject, qualification },
      include: { user: true },
    });
    res.status(201).json(teacher);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update teacher (Admin only)
router.put('/:id', auth, roleCheck('ADMIN'), async (req, res) => {
  const { id } = req.params;
  const { subject, qualification } = req.body;
  try {
    const teacher = await prisma.teacher.update({
      where: { id },
      data: { subject, qualification },
    });
    res.json(teacher);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;