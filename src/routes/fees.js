const express = require('express');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { PrismaClient } = require('@prisma/client');
const { sendEmail } = require('../utils/email');
const prisma = new PrismaClient();

const router = express.Router();

// ✅ Fee Report (Admin)
router.get('/report', auth, roleCheck('ADMIN'), async (req, res) => {
  try {
    const fees = await prisma.fee.findMany({
      include: {
        student: { include: { user: { select: { name: true } }, batch: { select: { name: true } } } },
        payments: true,
      },
    });

    const report = fees.map((f) => ({
      Student: f.student.user.name,
      Batch: f.student.batch?.name || '—',
      'Total Fees': f.totalFees,
      'Paid Amount': f.paidAmount,
      'Due Amount': f.totalFees - f.paidAmount,
      Status: f.status,
      'Due Date': new Date(f.dueDate).toLocaleDateString('en-IN'),
      Payments: f.payments.length,
    }));

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all fees (Admin only)
router.get('/', auth, roleCheck('ADMIN'), async (req, res) => {
  try {
    const fees = await prisma.fee.findMany({
      include: { student: { include: { user: true } }, payments: true },
    });
    res.json(fees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get fees for a student (Student/Parent/Admin)
router.get('/student/:studentId', auth, async (req, res) => {
  const { studentId } = req.params;
  const user = req.user;
  if (user.role === 'STUDENT') {
    const student = await prisma.student.findUnique({ where: { userId: user.id } });
    if (student?.id !== studentId) return res.status(403).json({ error: 'Forbidden' });
  } else if (user.role === 'PARENT') {
    const parent = await prisma.parent.findUnique({ where: { userId: user.id }, include: { children: true } });
    if (!parent.children.some(c => c.id === studentId)) return res.status(403).json({ error: 'Forbidden' });
  } else if (user.role !== 'ADMIN' && user.role !== 'SUB_ADMIN') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const fees = await prisma.fee.findMany({
      where: { studentId },
      include: { payments: true },
    });
    res.json(fees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new fee record (Admin/SubAdmin)
router.post('/', auth, roleCheck('ADMIN', 'SUB_ADMIN'), async (req, res) => {
  const { studentId, totalFees, dueDate } = req.body;
  try {
    const fee = await prisma.fee.create({
      data: {
        studentId,
        totalFees: parseFloat(totalFees),
        dueDate: new Date(dueDate),
        status: 'PENDING',
      },
    });
    const student = await prisma.student.findUnique({ where: { id: studentId }, include: { user: true } });
    if (student.user.email) {
      await sendEmail(student.user.email, 'Fee Reminder', `Your fee of ₹${totalFees} is due on ${new Date(dueDate).toLocaleDateString()}. Please pay on time.`);
    }
    res.status(201).json(fee);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update fee record (Admin/SubAdmin)
router.put('/:id', auth, roleCheck('ADMIN', 'SUB_ADMIN'), async (req, res) => {
  const { id } = req.params;
  const { totalFees, dueDate, status } = req.body;
  try {
    const fee = await prisma.fee.update({
      where: { id },
      data: { totalFees: totalFees ? parseFloat(totalFees) : undefined, dueDate: dueDate ? new Date(dueDate) : undefined, status },
    });
    res.json(fee);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
