const express = require('express');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const router = express.Router();

// Get notes for a batch (Student/Parent/Teacher)
router.get('/batch/:batchId', auth, async (req, res) => {
  const { batchId } = req.params;
  try {
    const notes = await prisma.note.findMany({
      where: { batchId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload note (Teacher)
router.post('/', auth, roleCheck('SUB_ADMIN'), async (req, res) => {
  const { title, fileUrl, batchId, type } = req.body;
  try {
    const note = await prisma.note.create({
      data: {
        title,
        fileUrl,
        batchId,
        type,
        uploadedBy: req.user.id,
      },
    });
    res.status(201).json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete note (Admin/Teacher)
router.delete('/:id', auth, roleCheck('ADMIN', 'SUB_ADMIN'), async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.note.delete({ where: { id } });
    res.json({ message: 'Note deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;