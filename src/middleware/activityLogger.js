const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const logActivity = (action, entity) => {
  return async (req, res, next) => {
    try {
      const originalJson = res.json.bind(res);
      res.json = (data) => {
        prisma.activityLog.create({
          data: {
            userId: req.user?.id || 'system',
            action,
            entity,
            entityId: req.params.id || data?.id || null,
            details: { method: req.method, path: req.originalUrl, body: req.body },
            ipAddress: req.ip,
          },
        }).catch(console.error);
        return originalJson(data);
      };
      next();
    } catch (err) {
      next();
    }
  };
};

module.exports = { logActivity };