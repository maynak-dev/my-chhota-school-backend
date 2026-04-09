const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate } = require('../middleware/auth');

// GET live classes for a batch
router.get('/batch/:batchId', authenticate, async (req, res) => {
  try {
    const classes = await prisma.liveClass.findMany({
      where: { batchId: req.params.batchId },
      orderBy: { scheduledAt: 'desc' },
    });
    res.json(classes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET upcoming live classes
router.get('/upcoming', authenticate, async (req, res) => {
  try {
    const classes = await prisma.liveClass.findMany({
      where: { scheduledAt: { gte: new Date() }, status: 'SCHEDULED' },
      orderBy: { scheduledAt: 'asc' },
      take: 20,
    });
    res.json(classes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST schedule live class
router.post('/', authenticate, async (req, res) => {
  try {
    const { title, description, batchId, platform, meetingUrl, meetingId, scheduledAt, duration } = req.body;
    const liveClass = await prisma.liveClass.create({
      data: { title, description, batchId, hostId: req.user.id, platform, meetingUrl, meetingId, scheduledAt: new Date(scheduledAt), duration },
    });
    res.status(201).json(liveClass);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update status
router.put('/:id/status', authenticate, async (req, res) => {
  try {
    const { status, recordingUrl } = req.body;
    const liveClass = await prisma.liveClass.update({
      where: { id: req.params.id },
      data: { status, ...(recordingUrl && { recordingUrl }) },
    });
    res.json(liveClass);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST chat message
router.post('/:id/chat', authenticate, async (req, res) => {
  try {
    const chat = await prisma.liveChat.create({
      data: { liveClassId: req.params.id, userId: req.user.id, userName: req.user.name, message: req.body.message },
    });
    res.status(201).json(chat);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET chat messages
router.get('/:id/chat', authenticate, async (req, res) => {
  try {
    const chats = await prisma.liveChat.findMany({
      where: { liveClassId: req.params.id },
      orderBy: { createdAt: 'asc' },
    });
    res.json(chats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST raise hand
router.post('/:id/hand', authenticate, async (req, res) => {
  try {
    const hand = await prisma.handRaise.create({
      data: { liveClassId: req.params.id, userId: req.user.id, userName: req.user.name },
    });
    res.status(201).json(hand);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT resolve hand raise
router.put('/hand/:id/resolve', authenticate, async (req, res) => {
  try {
    const hand = await prisma.handRaise.update({ where: { id: req.params.id }, data: { resolved: true } });
    res.json(hand);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create poll
router.post('/:id/poll', authenticate, async (req, res) => {
  try {
    const { question, options } = req.body;
    const poll = await prisma.livePoll.create({
      data: { liveClassId: req.params.id, question, options },
    });
    res.status(201).json(poll);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST respond to poll
router.post('/poll/:id/respond', authenticate, async (req, res) => {
  try {
    const { optionIndex } = req.body;
    const poll = await prisma.livePoll.findUnique({ where: { id: req.params.id } });
    const responses = poll.responses || {};
    responses[req.user.id] = optionIndex;
    const updated = await prisma.livePoll.update({
      where: { id: req.params.id },
      data: { responses },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE live class
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await prisma.liveClass.delete({ where: { id: req.params.id } });
    res.json({ message: 'Live class deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;