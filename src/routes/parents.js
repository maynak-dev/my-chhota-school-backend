const express = require('express');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const router = express.Router();

// Get current parent
router.get('/me', auth, roleCheck('PARENT'), async (req, res) => {
  try {
    const parent = await prisma.parent.findUnique({
      where: { userId: req.user.id },
      include: { user: true, children: { include: { user: true, batch: true } } },
    });
    if (!parent) return res.status(404).json({ error: 'Parent profile not found' });
    res.json(parent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get parent by ID (Admin)
router.get('/:id', auth, roleCheck('ADMIN'), async (req, res) => {
  const { id } = req.params;
  try {
    const parent = await prisma.parent.findUnique({
      where: { id },
      include: { user: true, children: true },
    });
    if (!parent) return res.status(404).json({ error: 'Parent not found' });
    res.json(parent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create parent (Admin)
router.post('/', auth, roleCheck('ADMIN'), async (req, res) => {
  const { userId } = req.body;
  try {
    const parent = await prisma.parent.create({ data: { userId } });
    res.status(201).json(parent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;