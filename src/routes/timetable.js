const express = require('express');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const router = express.Router();

// Get timetable for a batch
router.get('/batch/:batchId', auth, async (req, res) => {
  const { batchId } = req.params;
  try {
    const timetable = await prisma.timetable.findMany({
      where: { batchId },
      include: { teacher: { include: { user: true } } },
      orderBy: { day: 'asc', startTime: 'asc' },
    });
    res.json(timetable);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create timetable entry (Admin/Teacher)
router.post('/', auth, roleCheck('ADMIN', 'SUB_ADMIN'), async (req, res) => {
  const { batchId, day, subject, startTime, endTime, teacherId } = req.body;
  try {
    const entry = await prisma.timetable.create({
      data: { batchId, day, subject, startTime, endTime, teacherId },
    });
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update timetable entry
router.put('/:id', auth, roleCheck('ADMIN', 'SUB_ADMIN'), async (req, res) => {
  const { id } = req.params;
  const { day, subject, startTime, endTime, teacherId } = req.body;
  try {
    const entry = await prisma.timetable.update({
      where: { id },
      data: { day, subject, startTime, endTime, teacherId },
    });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete timetable entry
router.delete('/:id', auth, roleCheck('ADMIN', 'SUB_ADMIN'), async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.timetable.delete({ where: { id } });
    res.json({ message: 'Timetable entry deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;