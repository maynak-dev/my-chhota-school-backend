const express = require('express');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const router = express.Router();

router.get('/', auth, roleCheck('ADMIN', 'SUB_ADMIN'), async (req, res) => {
  try {
    const where = req.user.role === 'SUB_ADMIN'
      ? { type: { not: 'FEE_PAYMENT' } }
      : {};
    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/my', auth, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: {
        OR: [
          { targetRole: null },
          { targetRole: req.user.role },
        ],
        type: 'ANNOUNCEMENT',
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/unread-count', auth, roleCheck('ADMIN', 'SUB_ADMIN'), async (req, res) => {
  try {
    const where = { isRead: false };
    if (req.user.role === 'SUB_ADMIN') {
      where.type = { not: 'FEE_PAYMENT' };
    }
    const count = await prisma.notification.count({ where });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, roleCheck('ADMIN'), async (req, res) => {
  const { title, message, targetRole } = req.body;
  if (!title || !message) {
    return res.status(400).json({ error: 'Title and message are required.' });
  }
  try {
    const notification = await prisma.notification.create({
      data: {
        type: 'ANNOUNCEMENT',
        title,
        message,
        targetRole: targetRole || null,
        isRead: false,
      },
    });
    res.status(201).json(notification);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/read', auth, roleCheck('ADMIN', 'SUB_ADMIN'), async (req, res) => {
  try {
    const notification = await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });
    res.json(notification);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/mark-all-read', auth, roleCheck('ADMIN', 'SUB_ADMIN'), async (req, res) => {
  try {
    const where = {};
    if (req.user.role === 'SUB_ADMIN') {
      where.type = { not: 'FEE_PAYMENT' };
    }
    await prisma.notification.updateMany({ where, data: { isRead: true } });
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;