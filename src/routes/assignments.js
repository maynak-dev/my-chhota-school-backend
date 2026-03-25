const express = require('express');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const router = express.Router();

// Get assignments for a batch
router.get('/batch/:batchId', auth, async (req, res) => {
  const { batchId } = req.params;
  try {
    const assignments = await prisma.assignment.findMany({
      where: { batchId },
      include: { teacher: { include: { user: true } } },
      orderBy: { dueDate: 'asc' },
    });
    res.json(assignments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create assignment (Teacher)
router.post('/', auth, roleCheck('SUB_ADMIN'), async (req, res) => {
  const { title, description, dueDate, fileUrl, batchId } = req.body;
  try {
    const assignment = await prisma.assignment.create({
      data: {
        title,
        description,
        dueDate: new Date(dueDate),
        fileUrl,
        batchId,
        createdBy: req.user.id,
      },
    });
    res.status(201).json(assignment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete assignment (Teacher/Admin)
router.delete('/:id', auth, roleCheck('ADMIN', 'SUB_ADMIN'), async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.assignment.delete({ where: { id } });
    res.json({ message: 'Assignment deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;