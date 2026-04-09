const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate } = require('../middleware/auth');

// GET weekly summary for parent's child
router.get('/weekly-summary/:studentId', authenticate, async (req, res) => {
  try {
    const studentId = req.params.studentId;
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const [attendance, results, videos] = await Promise.all([
      prisma.attendance.findMany({
        where: { studentId, date: { gte: oneWeekAgo } },
      }),
      prisma.result.findMany({
        where: { studentId },
        include: { exam: true },
        orderBy: { exam: { date: 'desc' } },
        take: 5,
      }),
      prisma.videoEngagement.findMany({
        where: { studentId, lastWatched: { gte: oneWeekAgo } },
      }),
    ]);

    const totalDays = attendance.length;
    const presentDays = attendance.filter(a => a.status === 'PRESENT').length;

    res.json({
      attendance: { total: totalDays, present: presentDays, rate: totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(1) : 0 },
      recentResults: results.map(r => ({
        exam: r.exam.name,
        marks: r.marksObtained,
        total: r.exam.maxMarks,
        percentage: ((r.marksObtained / r.exam.maxMarks) * 100).toFixed(1),
      })),
      videosWatched: videos.length,
      videosCompleted: videos.filter(v => v.completed).length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST schedule parent-teacher meeting
router.post('/meeting', authenticate, async (req, res) => {
  try {
    const { parentId, teacherId, scheduledAt } = req.body;
    const meeting = await prisma.parentMeeting.create({
      data: { parentId, teacherId, scheduledAt: new Date(scheduledAt) },
    });
    res.status(201).json(meeting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET meetings for parent
router.get('/meetings/:parentId', authenticate, async (req, res) => {
  try {
    const meetings = await prisma.parentMeeting.findMany({
      where: { parentId: req.params.parentId },
      orderBy: { scheduledAt: 'desc' },
    });
    res.json(meetings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update meeting status
router.put('/meeting/:id', authenticate, async (req, res) => {
  try {
    const meeting = await prisma.parentMeeting.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(meeting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;