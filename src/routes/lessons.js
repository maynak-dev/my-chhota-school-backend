const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate } = require('../middleware/auth');

// GET lessons by module
router.get('/module/:moduleId', authenticate, async (req, res) => {
  try {
    const lessons = await prisma.lesson.findMany({
      where: { moduleId: req.params.moduleId },
      orderBy: { order: 'asc' },
    });
    res.json(lessons);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create lesson
router.post('/', authenticate, async (req, res) => {
  try {
    const { moduleId, title, content, videoUrl, duration, order } = req.body;
    const lesson = await prisma.lesson.create({
      data: { moduleId, title, content, videoUrl, duration, order },
    });
    res.status(201).json(lesson);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update lesson
router.put('/:id', authenticate, async (req, res) => {
  try {
    const lesson = await prisma.lesson.update({ where: { id: req.params.id }, data: req.body });
    res.json(lesson);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE lesson
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await prisma.lesson.delete({ where: { id: req.params.id } });
    res.json({ message: 'Lesson deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;