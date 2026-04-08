const express = require('express');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const router = express.Router();

// Get payroll for current teacher
router.get('/me', auth, roleCheck('SUB_ADMIN'), async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
    const payroll = await prisma.payroll.findMany({
      where: { teacherId: teacher.id },
      orderBy: { year: 'desc', month: 'desc' },
    });
    res.json(payroll);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add payroll (Admin)
router.post('/', auth, roleCheck('ADMIN'), async (req, res) => {
  const { teacherId, month, year, amount, deductions } = req.body;
  const parsedAmount = parseFloat(amount);
  const parsedDeductions = parseFloat(deductions) || 0;
  const netAmount = parsedAmount - parsedDeductions;
  try {
    const payroll = await prisma.payroll.create({
      data: {
        teacherId,
        month: parseInt(month),
        year: parseInt(year),
        amount: parsedAmount,
        deductions: parsedDeductions,
        netAmount,
        paid: false,
      },
    });
    res.status(201).json(payroll);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark payroll as paid (Admin)
router.put('/:id/pay', auth, roleCheck('ADMIN'), async (req, res) => {
  const { id } = req.params;
  try {
    const payroll = await prisma.payroll.update({
      where: { id },
      data: { paid: true, paidAt: new Date() },
    });
    res.json(payroll);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all payroll records (Admin)
router.get('/', auth, roleCheck('ADMIN'), async (req, res) => {
  try {
    const payroll = await prisma.payroll.findMany({
      include: { teacher: { include: { user: true } } },
      orderBy: { year: 'desc', month: 'desc' },
    });
    res.json(payroll);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;