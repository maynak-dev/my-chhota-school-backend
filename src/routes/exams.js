const express = require('express');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const router = express.Router();

// Get exams for a batch
router.get('/batch/:batchId', auth, async (req, res) => {
  const { batchId } = req.params;
  try {
    const exams = await prisma.exam.findMany({
      where: { batchId },
      include: { results: true },
      orderBy: { date: 'asc' },
    });
    res.json(exams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create exam (Teacher/Admin)
router.post('/', auth, roleCheck('ADMIN', 'SUB_ADMIN'), async (req, res) => {
  const { name, date, maxMarks, batchId } = req.body;
  try {
    const exam = await prisma.exam.create({
      data: { name, date: new Date(date), maxMarks, batchId },
    });
    res.status(201).json(exam);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update exam
router.put('/:id', auth, roleCheck('ADMIN', 'SUB_ADMIN'), async (req, res) => {
  const { id } = req.params;
  const { name, date, maxMarks } = req.body;
  try {
    const exam = await prisma.exam.update({
      where: { id },
      data: { name, date: date ? new Date(date) : undefined, maxMarks },
    });
    res.json(exam);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete exam
router.delete('/:id', auth, roleCheck('ADMIN'), async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.exam.delete({ where: { id } });
    res.json({ message: 'Exam deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/exams — all exams (ADMIN/SUB_ADMIN)
router.get('/', auth, roleCheck('ADMIN', 'SUB_ADMIN'), async (req, res) => {
  try {
    const exams = await prisma.exam.findMany({
      include: { batch: true },
      orderBy: { date: 'desc' },
    });
    res.json(exams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/exams — create exam (ADMIN/SUB_ADMIN)
router.post('/', auth, roleCheck('ADMIN', 'SUB_ADMIN'), async (req, res) => {
  const { name, date, maxMarks, batchId } = req.body;
  if (!name || !date || !maxMarks || !batchId)
    return res.status(400).json({ error: 'Missing required fields' });
  try {
    const exam = await prisma.exam.create({
      data: { name, date: new Date(date), maxMarks: parseInt(maxMarks), batchId },
      include: { batch: true },
    });
    res.status(201).json(exam);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/exams/:id
router.delete('/:id', auth, roleCheck('ADMIN'), async (req, res) => {
  try {
    await prisma.exam.delete({ where: { id: req.params.id } });
    res.json({ message: 'Exam deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;