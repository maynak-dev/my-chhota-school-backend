const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate } = require('../middleware/auth');
const { roleCheck } = require('../middleware/roleCheck');

// GET all permissions
router.get('/', authenticate, roleCheck(['ADMIN']), async (req, res) => {
  try {
    const permissions = await prisma.permission.findMany({ orderBy: { name: 'asc' } });
    res.json(permissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET role permissions
router.get('/role/:role', authenticate, roleCheck(['ADMIN']), async (req, res) => {
  try {
    const rolePerms = await prisma.rolePermission.findMany({
      where: { role: req.params.role },
      include: { permission: true },
    });
    res.json(rolePerms.map(rp => rp.permission));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update role permissions
router.put('/role/:role', authenticate, roleCheck(['ADMIN']), async (req, res) => {
  try {
    const { permissionIds } = req.body;
    const role = req.params.role;

    await prisma.rolePermission.deleteMany({ where: { role } });
    await prisma.rolePermission.createMany({
      data: permissionIds.map(pid => ({ role, permissionId: pid })),
    });

    res.json({ message: 'Permissions updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create permission
router.post('/', authenticate, roleCheck(['ADMIN']), async (req, res) => {
  try {
    const { name, description } = req.body;
    const perm = await prisma.permission.create({ data: { name, description } });
    res.status(201).json(perm);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;