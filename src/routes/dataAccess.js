const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate } = require('../middleware/auth');
const { roleCheck } = require('../middleware/roleCheck');

// Middleware to track data access
const trackAccess = (resource, action) => {
  return async (req, res, next) => {
    try {
      await prisma.dataAccessLog.create({
        data: {
          userId: req.user.id,
          resource,
          action,
          details: { params: req.params, query: req.query },
          ipAddress: req.ip,
        },
      });
    } catch (err) {
      console.error('Data access tracking failed:', err);
    }
    next();
  };
};

// GET access logs (admin only)
router.get('/logs', authenticate, roleCheck(['ADMIN']), async (req, res) => {
  try {
    const { page = 1, limit = 50, userId, resource, from, to } = req.query;
    const where = {};
    if (userId) where.userId = userId;
    if (resource) where.resource = resource;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      prisma.dataAccessLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: parseInt(limit),
      }),
      prisma.dataAccessLog.count({ where }),
    ]);

    res.json({ logs, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.trackAccess = trackAccess;