const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate } = require('../middleware/auth');

// POST/PUT upsert engagement
router.post('/', authenticate, async (req, res) => {
  try {
    const { videoId, watchTime, completed, dropOffAt } = req.body;
    const studentId = req.user.studentId || req.user.id;
    
    const engagement = await prisma.videoEngagement.upsert({
      where: { videoId_studentId: { videoId, studentId } },
      update: { watchTime, completed, dropOffAt, lastWatched: new Date() },
      create: { videoId, studentId, watchTime, completed, dropOffAt },
    });
    res.json(engagement);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET analytics for a video (admin/teacher)
router.get('/analytics/:videoId', authenticate, async (req, res) => {
  try {
    const engagements = await prisma.videoEngagement.findMany({
      where: { videoId: req.params.videoId },
    });
    const total = engagements.length;
    const completed = engagements.filter(e => e.completed).length;
    const avgWatchTime = total > 0 ? engagements.reduce((s, e) => s + e.watchTime, 0) / total : 0;
    const dropOffs = engagements.filter(e => e.dropOffAt).map(e => e.dropOffAt);

    res.json({
      totalViewers: total,
      completionRate: total > 0 ? ((completed / total) * 100).toFixed(1) : 0,
      avgWatchTime: Math.round(avgWatchTime),
      dropOffPoints: dropOffs,
      engagements,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;