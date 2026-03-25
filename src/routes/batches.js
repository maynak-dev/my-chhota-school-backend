const express = require('express');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const router = express.Router();

// Get all batches (Admin/Teacher)
router.get('/', auth, roleCheck('ADMIN', 'SUB_ADMIN'), async (req, res) => {
  try {
    const batches = await prisma.batch.findMany({
      include: { course: true, teacher: { include: { user: true } }, students: { include: { user: true } } },
    });
    res.json(batches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single batch
router.get('/:id', auth, async (req, res) => {
  const { id } = req.params;
  try {
    const batch = await prisma.batch.findUnique({
      where: { id },
      include: { course: true, teacher: true, students: { include: { user: true } }, timetable: true, videos: true, notes: true, assignments: true },
    });
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    // Authorization: if student/parent, check if student belongs to batch
    if (req.user.role === 'STUDENT') {
      const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
      if (student?.batchId !== id) return res.status(403).json({ error: 'Forbidden' });
    }
    if (req.user.role === 'PARENT') {
      const parent = await prisma.parent.findUnique({ where: { userId: req.user.id }, include: { children: true } });
      const childrenInBatch = parent.children.some(c => c.batchId === id);
      if (!childrenInBatch) return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(batch);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ NEW: Get students of a batch
router.get('/:id/students', auth, async (req, res) => {
  const { id } = req.params;
  try {
    const students = await prisma.student.findMany({
      where: { batchId: id },
      include: { user: true },
    });
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create batch (Admin only)
router.post('/', auth, roleCheck('ADMIN'), async (req, res) => {
  const { name, courseId, startDate, endDate, teacherId } = req.body;
  try {
    const batch = await prisma.batch.create({
      data: { name, courseId, startDate: new Date(startDate), endDate: endDate ? new Date(endDate) : null, teacherId },
    });
    res.status(201).json(batch);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update batch (Admin only)
router.put('/:id', auth, roleCheck('ADMIN'), async (req, res) => {
  const { id } = req.params;
  const { name, courseId, startDate, endDate, teacherId } = req.body;
  try {
    const batch = await prisma.batch.update({
      where: { id },
      data: { name, courseId, startDate: startDate ? new Date(startDate) : undefined, endDate: endDate ? new Date(endDate) : null, teacherId },
    });
    res.json(batch);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete batch (Admin only)
router.delete('/:id', auth, roleCheck('ADMIN'), async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.batch.delete({ where: { id } });
    res.json({ message: 'Batch deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;