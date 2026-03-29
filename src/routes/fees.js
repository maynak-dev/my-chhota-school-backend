const express = require('express');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { PrismaClient } = require('@prisma/client');
const { sendEmail } = require('../utils/email');
const prisma = new PrismaClient();

const router = express.Router();

// Create a payment (Parent/Student)
router.post('/', auth, async (req, res) => {
  const { feeId, amount, method, transactionId } = req.body;
  const user = req.user;

  try {
    // Fetch fee and student details
    const fee = await prisma.fee.findUnique({
      where: { id: feeId },
      include: { student: { include: { user: true, parent: { include: { user: true } } } } },
    });
    if (!fee) return res.status(404).json({ error: 'Fee record not found' });

    // Authorization: only student or parent of that student
    if (user.role === 'STUDENT') {
      const student = await prisma.student.findUnique({ where: { userId: user.id } });
      if (student?.id !== fee.studentId) return res.status(403).json({ error: 'Forbidden' });
    } else if (user.role === 'PARENT') {
      const parent = await prisma.parent.findUnique({ where: { userId: user.id }, include: { children: true } });
      if (!parent.children.some(c => c.id === fee.studentId)) return res.status(403).json({ error: 'Forbidden' });
    } else {
      return res.status(403).json({ error: 'Only students or parents can make payments' });
    }

    // Check amount not exceeding balance
    const balance = fee.totalFees - fee.paidAmount;
    if (amount > balance) return res.status(400).json({ error: 'Amount exceeds due balance' });

    // Create payment record with PENDING status
    const payment = await prisma.payment.create({
      data: {
        feeId,
        amount,
        method,
        transactionId,
        status: 'PENDING',
      },
    });

    // Notify admin(s) – optional, can be implemented via notification system
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { email: true } });
    for (const admin of admins) {
      await sendEmail(
        admin.email,
        'New Fee Payment Request',
        `A payment of ₹${amount} has been initiated for student ${fee.student.user.name} (${fee.student.id}). Please verify and approve/reject.`
      );
    }

    res.status(201).json(payment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get payments (Admin/SubAdmin can filter; Parent/Student see only their own)
router.get('/', auth, async (req, res) => {
  const { studentId, status } = req.query;
  const user = req.user;

  try {
    let where = {};
    if (status) where.status = status;

    if (user.role === 'ADMIN' || user.role === 'SUB_ADMIN') {
      if (studentId) where.fee = { studentId };
      // Admin can see all payments
      const payments = await prisma.payment.findMany({
        where,
        include: { fee: { include: { student: { include: { user: true } } } } },
        orderBy: { createdAt: 'desc' },
      });
      return res.json(payments);
    }

    // For Student or Parent: they can only see payments for their own children/self
    if (user.role === 'STUDENT') {
      const student = await prisma.student.findUnique({ where: { userId: user.id } });
      if (!student) return res.status(403).json({ error: 'Student not found' });
      where.fee = { studentId: student.id };
    } else if (user.role === 'PARENT') {
      const parent = await prisma.parent.findUnique({ where: { userId: user.id }, include: { children: true } });
      if (!parent) return res.status(403).json({ error: 'Parent not found' });
      const childIds = parent.children.map(c => c.id);
      if (studentId && !childIds.includes(studentId)) return res.status(403).json({ error: 'Forbidden' });
      where.fee = { studentId: studentId ? studentId : { in: childIds } };
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const payments = await prisma.payment.findMany({
      where,
      include: { fee: { include: { feeType: true, student: { include: { user: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update payment status (Admin only)
router.put('/:id', auth, roleCheck('ADMIN'), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // APPROVED or REJECTED

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be APPROVED or REJECTED' });
  }

  try {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { fee: { include: { student: { include: { user: true } } } } },
    });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.status !== 'PENDING') return res.status(400).json({ error: 'Payment already processed' });

    // Update payment status
    const updated = await prisma.payment.update({
      where: { id },
      data: { status },
    });

    // If approved, update fee record
    if (status === 'APPROVED') {
      const newPaidAmount = payment.fee.paidAmount + payment.amount;
      const newStatus = newPaidAmount >= payment.fee.totalFees ? 'PAID' : 'PARTIAL';
      await prisma.fee.update({
        where: { id: payment.feeId },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
        },
      });

      // Notify parent/student
      const recipient = payment.fee.student.user.email;
      await sendEmail(recipient, 'Payment Approved', `Your payment of ₹${payment.amount} has been approved. Your fee status is now ${newStatus}.`);
    } else {
      // Rejected: notify the user
      await sendEmail(payment.fee.student.user.email, 'Payment Rejected', `Your payment of ₹${payment.amount} was rejected. Please contact admin.`);
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;