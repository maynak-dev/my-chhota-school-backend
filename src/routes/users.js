const express = require('express');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const router = express.Router();

// Get all users (Admin only)
router.get('/', auth, roleCheck('ADMIN'), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, phone: true, createdAt: true },
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single user
router.get('/:id', auth, async (req, res) => {
  const { id } = req.params;
  // Only allow admin or self
  if (req.user.id !== id && req.user.role !== 'ADMIN')
    return res.status(403).json({ error: 'Forbidden' });
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { student: true, teacher: true, parent: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user (Admin only or self)
router.put('/:id', auth, async (req, res) => {
  const { id } = req.params;
  if (req.user.id !== id && req.user.role !== 'ADMIN')
    return res.status(403).json({ error: 'Forbidden' });
  const { name, email, phone } = req.body;
  try {
    const user = await prisma.user.update({
      where: { id },
      data: { name, email, phone },
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user (Admin only)
router.delete('/:id', auth, roleCheck('ADMIN'), async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.user.delete({ where: { id } });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;