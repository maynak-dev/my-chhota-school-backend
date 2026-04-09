const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate } = require('../middleware/auth');

// GET modules by course
router.get('/course/:courseId', authenticate, async (req, res) => {
  try {
    const modules = await prisma.module.findMany({
      where: { courseId: req.params.courseId },
      include: { lessons: { orderBy: { order: 'asc' } }, prerequisite: true },
      orderBy: { order: 'asc' },
    });
    res.json(modules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create module
router.post('/', authenticate, async (req, res) => {
  try {
    const { courseId, title, description, order, dripDate, prerequisiteId } = req.body;
    const mod = await prisma.module.create({
      data: { courseId, title, description, order, dripDate: dripDate ? new Date(dripDate) : null, prerequisiteId },
    });
    res.status(201).json(mod);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update module
router.put('/:id', authenticate, async (req, res) => {
  try {
    const mod = await prisma.module.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(mod);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE module
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await prisma.module.delete({ where: { id: req.params.id } });
    res.json({ message: 'Module deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
