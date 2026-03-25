const express = require('express');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const router = express.Router();

// Get all announcements (filter by role)
router.get('/', auth, async (req, res) => {
  try {
    const announcements = await prisma.announcement.findMany({
      where: {
        OR: [
          { targetRole: null },
          { targetRole: req.user.role },
        ],
      },
      include: { creator: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(announcements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create announcement (Admin/Teacher)
router.post('/', auth, roleCheck('ADMIN', 'SUB_ADMIN'), async (req, res) => {
  const { title, content, targetRole } = req.body;
  try {
    const announcement = await prisma.announcement.create({
      data: {
        title,
        content,
        targetRole,
        createdBy: req.user.id,
      },
    });
    res.status(201).json(announcement);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete announcement (Admin only)
router.delete('/:id', auth, roleCheck('ADMIN'), async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.announcement.delete({ where: { id } });
    res.json({ message: 'Announcement deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;