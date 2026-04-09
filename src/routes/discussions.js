const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate } = require('../middleware/auth');

// GET discussions for a course
router.get('/course/:courseId', authenticate, async (req, res) => {
  try {
    const discussions = await prisma.discussion.findMany({
      where: { courseId: req.params.courseId },
      include: { replies: { take: 3, orderBy: { createdAt: 'desc' } } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(discussions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single discussion with all replies (threaded)
router.get('/:id', authenticate, async (req, res) => {
  try {
    const discussion = await prisma.discussion.findUnique({
      where: { id: req.params.id },
      include: {
        replies: {
          where: { parentId: null },
          include: { children: { orderBy: { createdAt: 'asc' } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    res.json(discussion);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create discussion
router.post('/', authenticate, async (req, res) => {
  try {
    const { courseId, title, body } = req.body;
    const discussion = await prisma.discussion.create({
      data: { courseId, title, body, userId: req.user.id, userName: req.user.name, userRole: req.user.role },
    });
    res.status(201).json(discussion);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST reply to discussion
router.post('/:id/reply', authenticate, async (req, res) => {
  try {
    const { body, parentId } = req.body;
    const reply = await prisma.discussionReply.create({
      data: {
        discussionId: req.params.id, body, parentId: parentId || null,
        userId: req.user.id, userName: req.user.name, userRole: req.user.role,
      },
    });
    await prisma.discussion.update({ where: { id: req.params.id }, data: { updatedAt: new Date() } });
    res.status(201).json(reply);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;