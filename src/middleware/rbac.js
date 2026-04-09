const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const checkPermission = (permissionName) => {
  return async (req, res, next) => {
    try {
      const userRole = req.user.role;
      const permission = await prisma.rolePermission.findFirst({
        where: {
          role: userRole,
          permission: { name: permissionName },
        },
      });
      if (!permission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      next();
    } catch (err) {
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
};

module.exports = { checkPermission };