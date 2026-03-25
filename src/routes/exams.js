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

module.exports = router;