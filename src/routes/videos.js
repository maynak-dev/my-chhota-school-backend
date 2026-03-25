const express = require('express');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const router = express.Router();

// Get videos for a batch (Student/Parent/Teacher)
router.get('/batch/:batchId', auth, async (req, res) => {
  const { batchId } = req.params;
  try {
    const videos = await prisma.video.findMany({
      where: { batchId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(videos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload video (Teacher only)
router.post('/', auth, roleCheck('SUB_ADMIN'), async (req, res) => {
  const { title, url, batchId, duration } = req.body;
  try {
    const video = await prisma.video.create({
      data: {
        title,
        url,
        batchId,
        uploadedBy: req.user.id,
        duration,
      },
    });
    res.status(201).json(video);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete video (Admin/Teacher)
router.delete('/:id', auth, roleCheck('ADMIN', 'SUB_ADMIN'), async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.video.delete({ where: { id } });
    res.json({ message: 'Video deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;