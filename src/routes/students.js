const express = require('express');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const router = express.Router();

// Get all students (Admin/SubAdmin/Teacher)
router.get('/', auth, roleCheck('ADMIN', 'SUB_ADMIN', 'TEACHER'), async (req, res) => {
  try {
    const students = await prisma.student.findMany({
      include: { user: true, batch: true, parent: { include: { user: true } } },
    });
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get student by ID
router.get('/:id', auth, async (req, res) => {
  const { id } = req.params;
  try {
    const student = await prisma.student.findUnique({
      where: { id },
      include: { user: true, batch: true, parent: { include: { user: true } }, fees: true, attendance: true, results: true },
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    // Authorization: admin, teacher, or the student's own user or parent
    if (req.user.role === 'STUDENT' && student.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (req.user.role === 'PARENT') {
      const parent = await prisma.parent.findUnique({ where: { userId: req.user.id }, include: { children: true } });
      if (!parent.children.some(c => c.id === id)) return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current student (based on logged in user)
router.get('/me', auth, roleCheck('STUDENT'), async (req, res) => {
  try {
    const student = await prisma.student.findUnique({
      where: { userId: req.user.id },
      include: { user: true, batch: true, parent: { include: { user: true } }, fees: true, attendance: true, results: true },
    });
    if (!student) return res.status(404).json({ error: 'Student profile not found' });
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create student (Admin only)
router.post('/', auth, roleCheck('ADMIN'), async (req, res) => {
  const { userId, rollNumber, batchId, parentId } = req.body;
  try {
    const student = await prisma.student.create({
      data: { userId, rollNumber, batchId, parentId },
      include: { user: true },
    });
    res.status(201).json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update student (Admin or teacher)
router.put('/:id', auth, roleCheck('ADMIN', 'SUB_ADMIN'), async (req, res) => {
  const { id } = req.params;
  const { rollNumber, batchId, parentId } = req.body;
  try {
    const student = await prisma.student.update({
      where: { id },
      data: { rollNumber, batchId, parentId },
    });
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete student (Admin only)
router.delete('/:id', auth, roleCheck('ADMIN'), async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.student.delete({ where: { id } });
    res.json({ message: 'Student deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;