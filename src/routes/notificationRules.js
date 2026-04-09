const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate } = require('../middleware/auth');
const { roleCheck } = require('../middleware/roleCheck');

// GET all rules
router.get('/', authenticate, roleCheck(['ADMIN']), async (req, res) => {
  try {
    const rules = await prisma.notificationRule.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create rule
router.post('/', authenticate, roleCheck(['ADMIN']), async (req, res) => {
  try {
    const rule = await prisma.notificationRule.create({ data: req.body });
    res.status(201).json(rule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update rule
router.put('/:id', authenticate, roleCheck(['ADMIN']), async (req, res) => {
  try {
    const rule = await prisma.notificationRule.update({ where: { id: req.params.id }, data: req.body });
    res.json(rule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST trigger evaluation of all rules (called by cron or manually)
router.post('/evaluate', authenticate, roleCheck(['ADMIN']), async (req, res) => {
  try {
    const rules = await prisma.notificationRule.findMany({ where: { isActive: true } });
    let notifications = [];

    for (const rule of rules) {
      switch (rule.trigger) {
        case 'LOW_ATTENDANCE': {
          const threshold = rule.condition.threshold || 75;
          const students = await prisma.student.findMany({ include: { user: true } });
          for (const s of students) {
            const total = await prisma.attendance.count({ where: { studentId: s.id } });
            const present = await prisma.attendance.count({ where: { studentId: s.id, status: 'PRESENT' } });
            const rate = total > 0 ? (present / total * 100) : 100;
            if (rate < threshold) {
              notifications.push({
                type: 'LOW_ATTENDANCE',
                title: 'Low Attendance Alert',
                message: rule.template.replace('{{name}}', s.user.name).replace('{{rate}}', rate.toFixed(1)),
                targetRole: rule.targetRole,
                studentId: s.id,
                studentName: s.user.name,
              });
            }
          }
          break;
        }
        case 'FEE_DUE': {
          const daysBefore = rule.condition.daysBefore || 3;
          const targetDate = new Date();
          targetDate.setDate(targetDate.getDate() + daysBefore);
          const fees = await prisma.fee.findMany({
            where: { status: { in: ['PENDING', 'PARTIAL'] }, dueDate: { lte: targetDate } },
            include: { student: { include: { user: true } } },
          });
          for (const f of fees) {
            notifications.push({
              type: 'FEE_DUE',
              title: 'Fee Due Reminder',
              message: rule.template
                .replace('{{name}}', f.student.user.name)
                .replace('{{amount}}', (f.totalFees - f.paidAmount).toString())
                .replace('{{date}}', f.dueDate.toLocaleDateString()),
              targetRole: rule.targetRole,
              studentId: f.studentId,
              studentName: f.student.user.name,
              amount: f.totalFees - f.paidAmount,
            });
          }
          break;
        }
        case 'MISSED_CLASS': {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const absent = await prisma.attendance.findMany({
            where: { status: 'ABSENT', date: { gte: yesterday } },
            include: { student: { include: { user: true } } },
          });
          for (const a of absent) {
            notifications.push({
              type: 'MISSED_CLASS',
              title: 'Missed Class Alert',
              message: rule.template.replace('{{name}}', a.student.user.name),
              targetRole: rule.targetRole,
              studentId: a.studentId,
              studentName: a.student.user.name,
            });
          }
          break;
        }
      }
    }

    if (notifications.length > 0) {
      await prisma.notification.createMany({ data: notifications });
    }

    res.json({ triggered: notifications.length, notifications });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;