const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate } = require('../middleware/auth');
const { roleCheck } = require('../middleware/roleCheck');

// ─── Badges ─────────────────────────────────────────────
router.get('/badges', authenticate, async (req, res) => {
  try {
    const badges = await prisma.badge.findMany();
    res.json(badges);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/badges', authenticate, roleCheck(['ADMIN']), async (req, res) => {
  try {
    const badge = await prisma.badge.create({ data: req.body });
    res.status(201).json(badge);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET student badges
router.get('/badges/student/:studentId', authenticate, async (req, res) => {
  try {
    const badges = await prisma.studentBadge.findMany({
      where: { studentId: req.params.studentId },
      include: { badge: true },
      orderBy: { earnedAt: 'desc' },
    });
    res.json(badges);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST award badge
router.post('/badges/award', authenticate, roleCheck(['ADMIN', 'SUB_ADMIN']), async (req, res) => {
  try {
    const { studentId, badgeId } = req.body;
    const sb = await prisma.studentBadge.create({ data: { studentId, badgeId } });
    res.status(201).json(sb);
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Badge already awarded' });
    res.status(500).json({ error: err.message });
  }
});

// ─── Leaderboard ────────────────────────────────────────
router.get('/leaderboard/:batchId', authenticate, async (req, res) => {
  try {
    const students = await prisma.student.findMany({
      where: { batchId: req.params.batchId },
      include: { user: { select: { name: true, profilePic: true } } },
    });

    const leaderboard = await Promise.all(students.map(async (s) => {
      const [badges, streak, results] = await Promise.all([
        prisma.studentBadge.count({ where: { studentId: s.id } }),
        prisma.studentStreak.findUnique({ where: { studentId: s.id } }),
        prisma.result.findMany({ where: { studentId: s.id } }),
      ]);
      const avgScore = results.length > 0
        ? results.reduce((sum, r) => sum + r.marksObtained, 0) / results.length
        : 0;

      return {
        studentId: s.id,
        name: s.user.name,
        profilePic: s.user.profilePic,
        rollNumber: s.rollNumber,
        badgeCount: badges,
        currentStreak: streak?.currentStreak || 0,
        avgScore: Math.round(avgScore * 10) / 10,
        points: badges * 10 + (streak?.currentStreak || 0) * 2 + Math.round(avgScore),
      };
    }));

    leaderboard.sort((a, b) => b.points - a.points);
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Streak ─────────────────────────────────────────────
router.post('/streak/checkin', authenticate, async (req, res) => {
  try {
    const studentId = req.user.studentId || req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let streak = await prisma.studentStreak.findUnique({ where: { studentId } });

    if (!streak) {
      streak = await prisma.studentStreak.create({
        data: { studentId, currentStreak: 1, longestStreak: 1, lastActiveDate: today },
      });
    } else {
      const lastDate = new Date(streak.lastActiveDate);
      lastDate.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return res.json(streak); // Already checked in today
      const newStreak = diffDays === 1 ? streak.currentStreak + 1 : 1;

      streak = await prisma.studentStreak.update({
        where: { studentId },
        data: {
          currentStreak: newStreak,
          longestStreak: Math.max(newStreak, streak.longestStreak),
          lastActiveDate: today,
        },
      });
    }

    res.json(streak);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Certificates ───────────────────────────────────────
router.post('/certificates', authenticate, roleCheck(['ADMIN', 'SUB_ADMIN']), async (req, res) => {
  try {
    const cert = await prisma.certificate.create({ data: req.body });
    res.status(201).json(cert);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/certificates/student/:studentId', authenticate, async (req, res) => {
  try {
    const certs = await prisma.certificate.findMany({
      where: { studentId: req.params.studentId },
      orderBy: { issuedAt: 'desc' },
    });
    res.json(certs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;