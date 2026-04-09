const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate } = require('../middleware/auth');
const { roleCheck } = require('../middleware/roleCheck');

// GET /api/activity-logs - Admin only
router.get('/', authenticate, roleCheck(['ADMIN']), async (req, res) => {
  try {
    const { page = 1, limit = 50, userId, action, entity, from, to } = req.query;
    const where = {};
    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (entity) where.entity = entity;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: parseInt(limit),
      }),
      prisma.activityLog.count({ where }),
    ]);

    res.json({ logs, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;