const express = require('express');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { PrismaClient } = require('@prisma/client');
const { generateReceipt } = require('../utils/receipt');
const { sendEmail } = require('../utils/email');
const prisma = new PrismaClient();

const router = express.Router();

// Record a payment (Admin/SubAdmin/Student/Parent via online)
router.post('/', auth, async (req, res) => {
  const { feeId, amount, method, transactionId } = req.body;
  try {
    const fee = await prisma.fee.findUnique({ where: { id: feeId }, include: { student: { include: { user: true, batch: true, parent: { include: { user: true } } } } } });
    if (!fee) return res.status(404).json({ error: 'Fee record not found' });

    // Authorization: can only pay for own child/self
    if (req.user.role === 'STUDENT') {
      const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
      if (student?.id !== fee.studentId) return res.status(403).json({ error: 'Forbidden' });
    } else if (req.user.role === 'PARENT') {
      const parent = await prisma.parent.findUnique({ where: { userId: req.user.id }, include: { children: true } });
      if (!parent.children.some(c => c.id === fee.studentId)) return res.status(403).json({ error: 'Forbidden' });
    } else if (req.user.role !== 'ADMIN' && req.user.role !== 'SUB_ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const receiptNo = `RCPT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const payment = await prisma.payment.create({
      data: {
        feeId,
        amount,
        method,
        receiptNo,
        transactionId,
      },
    });

    // Update fee paid amount and status
    const newPaidAmount = fee.paidAmount + amount;
    let status = 'PENDING';
    if (newPaidAmount >= fee.totalFees) status = 'PAID';
    else if (new Date() > fee.dueDate) status = 'OVERDUE';
    else status = 'PENDING';

    await prisma.fee.update({
      where: { id: feeId },
      data: { paidAmount: newPaidAmount, status },
    });

    // Generate PDF receipt
    const receiptPath = await generateReceipt(payment, fee.student, fee);

    // Send email with receipt
    if (fee.student.user.email) {
      await sendEmail(
        fee.student.user.email,
        'Fee Payment Receipt',
        `Your payment of ₹${amount} has been received. Receipt No: ${receiptNo}. Thank you.`
      );
    }

    res.status(201).json({ ...payment, receiptPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all payments (Admin only)
router.get('/', auth, roleCheck('ADMIN'), async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      include: { fee: { include: { student: { include: { user: true } } } } },
    });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get payments for a student
router.get('/student/:studentId', auth, async (req, res) => {
  const { studentId } = req.params;
  // Authorization checks similar to fees
  if (req.user.role === 'STUDENT') {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (student?.id !== studentId) return res.status(403).json({ error: 'Forbidden' });
  } else if (req.user.role === 'PARENT') {
    const parent = await prisma.parent.findUnique({ where: { userId: req.user.id }, include: { children: true } });
    if (!parent.children.some(c => c.id === studentId)) return res.status(403).json({ error: 'Forbidden' });
  } else if (req.user.role !== 'ADMIN' && req.user.role !== 'SUB_ADMIN') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const payments = await prisma.payment.findMany({
      where: { fee: { studentId } },
      include: { fee: true },
    });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download receipt
router.get('/receipt/:paymentId', auth, async (req, res) => {
  const { paymentId } = req.params;
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { fee: { include: { student: { include: { user: true, batch: true } } } } },
    });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    // Authorization
    const studentId = payment.fee.studentId;
    if (req.user.role === 'STUDENT') {
      const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
      if (student?.id !== studentId) return res.status(403).json({ error: 'Forbidden' });
    } else if (req.user.role === 'PARENT') {
      const parent = await prisma.parent.findUnique({ where: { userId: req.user.id }, include: { children: true } });
      if (!parent.children.some(c => c.id === studentId)) return res.status(403).json({ error: 'Forbidden' });
    } else if (req.user.role !== 'ADMIN' && req.user.role !== 'SUB_ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const receiptPath = `./receipts/receipt_${payment.receiptNo}.pdf`;
    res.sendFile(receiptPath, { root: __dirname });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;