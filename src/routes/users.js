const express = require('express');
const bcrypt = require('bcryptjs');
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

// Create a staff / teacher user (Admin only)
router.post('/', auth, roleCheck('ADMIN'), async (req, res) => {
  const { name, email, password, phone, role, subject, qualification } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password, and role are required' });
  }
  const allowedRoles = ['ADMIN', 'SUB_ADMIN'];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: 'Role must be ADMIN or SUB_ADMIN (Teacher)' });
  }
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashed, role, phone: phone || null },
    });

    if (role === 'SUB_ADMIN') {
      await prisma.teacher.create({
        data: { userId: user.id, subject: subject || 'General', qualification: qualification || null },
      });
    }

    res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
