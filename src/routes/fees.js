const express = require('express');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { PrismaClient } = require('@prisma/client');
const { sendEmail } = require('../utils/email');
const prisma = new PrismaClient();

const router = express.Router();

// Helper to generate receipt number
const generateReceiptNo = () => `RCPT-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

// ✅ Create a payment request (Only PARENT or ADMIN/SUB_ADMIN – Students NOT allowed)
router.post('/', auth, async (req, res) => {
  const { feeId, amount, method, transactionId } = req.body;
  const user = req.user;

  // 1. Basic validation
  if (!feeId || !amount || !method) {
    return res.status(400).json({ error: 'Missing required fields: feeId, amount, method' });
  }
  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number' });
  }
  const validMethods = ['CASH', 'ONLINE', 'CARD'];
  if (!validMethods.includes(method)) {
    return res.status(400).json({ error: `Invalid method. Allowed: ${validMethods.join(', ')}` });
  }

  // 2. Block students
  if (user.role === 'STUDENT') {
    return res.status(403).json({ error: 'Students cannot make payments. Please ask your parent/guardian.' });
  }

  try {
    // 3. Fetch fee with student and parent details
    const fee = await prisma.fee.findUnique({
      where: { id: feeId },
      include: {
        student: {
          include: {
            user: true,
            parent: { include: { user: true } }
          }
        }
      }
    });
    if (!fee) return res.status(404).json({ error: 'Fee record not found' });

    // 4. Authorization: only PARENT of that student or ADMIN/SUB_ADMIN
    if (user.role === 'PARENT') {
      const parent = await prisma.parent.findUnique({
        where: { userId: user.id },
        include: { children: true }
      });
      if (!parent || !parent.children.some(c => c.id === fee.studentId)) {
        return res.status(403).json({ error: 'You are not authorized to pay for this student' });
      }
    } else if (user.role !== 'ADMIN' && user.role !== 'SUB_ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // 5. Check balance
    const balance = fee.totalFees - fee.paidAmount;
    if (amount > balance) {
      return res.status(400).json({ error: `Amount exceeds due balance of ₹${balance}` });
    }

    // 6. Create payment record with PENDING status
    const receiptNo = generateReceiptNo();
    const payment = await prisma.payment.create({
      data: {
        feeId,
        amount,
        method,
        transactionId: transactionId || null,
        receiptNo,
        status: 'PENDING',
      },
    });

    // 7. Notify all admins via email (non‑blocking)
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { email: true }
    });
    const emailPromises = admins.map(admin =>
      sendEmail(
        admin.email,
        'New Fee Payment Request',
        `A payment of ₹${amount} has been initiated for student ${fee.student.user.name} (${fee.student.id}). Receipt: ${receiptNo}. Please verify and approve/reject.`
      )
    );
    Promise.all(emailPromises).catch(err => console.error('Email sending failed:', err));

    // 8. Create in‑app notification for admins
    await prisma.notification.create({
      data: {
        type: 'FEE_PAYMENT',
        title: 'Payment Pending Approval',
        message: `Parent of ${fee.student.user.name} paid ₹${amount} via ${method}. Receipt: ${receiptNo}.`,
        paymentId: payment.id,
        studentId: fee.student.id,
        studentName: fee.student.user.name,
        amount: amount,
        isRead: false,
      }
    }).catch(err => console.error('Notification creation failed:', err));

    res.status(201).json(payment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get payments (Admin sees all; Parent sees own children; Student sees own)
router.get('/', auth, async (req, res) => {
  const { studentId, status } = req.query;
  const user = req.user;

  try {
    let where = {};
    if (status) where.status = status;

    if (user.role === 'ADMIN' || user.role === 'SUB_ADMIN') {
      if (studentId) where.fee = { studentId };
      const payments = await prisma.payment.findMany({
        where,
        include: {
          fee: {
            include: {
              student: { include: { user: true } },
              feeType: true   // optional, if your schema has feeType
            }
          }
        },
        orderBy: { createdAt: 'desc' },
      });
      return res.json(payments);
    }

    // For Student or Parent
    if (user.role === 'STUDENT') {
      const student = await prisma.student.findUnique({ where: { userId: user.id } });
      if (!student) return res.status(403).json({ error: 'Student profile not found' });
      where.fee = { studentId: student.id };
    } else if (user.role === 'PARENT') {
      const parent = await prisma.parent.findUnique({
        where: { userId: user.id },
        include: { children: true }
      });
      if (!parent) return res.status(403).json({ error: 'Parent profile not found' });
      const childIds = parent.children.map(c => c.id);
      if (studentId && !childIds.includes(studentId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      where.fee = { studentId: studentId ? studentId : { in: childIds } };
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        fee: {
          include: {
            student: { include: { user: true } },
            feeType: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(payments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Admin approves or rejects a payment
router.put('/:id', auth, roleCheck('ADMIN'), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'APPROVED' or 'REJECTED'

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be APPROVED or REJECTED' });
  }

  try {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        fee: {
          include: {
            student: { include: { user: true, parent: { include: { user: true } } } }
          }
        }
      }
    });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.status !== 'PENDING') {
      return res.status(400).json({ error: 'Payment already processed' });
    }

    // Update payment status
    const updatedPayment = await prisma.payment.update({
      where: { id },
      data: { status },
    });

    if (status === 'APPROVED') {
      // Update fee record
      const newPaidAmount = payment.fee.paidAmount + payment.amount;
      const totalFees = payment.fee.totalFees;
      let feeStatus = payment.fee.status; // keep existing (PENDING or OVERDUE)

      if (newPaidAmount >= totalFees) {
        feeStatus = 'PAID';
      } else if (new Date() > payment.fee.dueDate) {
        feeStatus = 'OVERDUE';
      } else {
        feeStatus = 'PENDING'; // partially paid but not overdue
      }

      await prisma.fee.update({
        where: { id: payment.feeId },
        data: {
          paidAmount: newPaidAmount,
          status: feeStatus,
        },
      });

      // Notify student & parent
      const studentEmail = payment.fee.student.user.email;
      const parentEmail = payment.fee.student.parent?.user?.email;
      const message = `Your payment of ₹${payment.amount} (Receipt: ${payment.receiptNo}) has been approved. Fee status: ${feeStatus}.`;
      if (studentEmail) await sendEmail(studentEmail, 'Payment Approved', message);
      if (parentEmail && parentEmail !== studentEmail) {
        await sendEmail(parentEmail, `Payment Approved for ${payment.fee.student.user.name}`, message);
      }
    } else {
      // REJECTED
      const studentEmail = payment.fee.student.user.email;
      const parentEmail = payment.fee.student.parent?.user?.email;
      const message = `Your payment of ₹${payment.amount} (Receipt: ${payment.receiptNo}) was rejected. Please contact admin.`;
      if (studentEmail) await sendEmail(studentEmail, 'Payment Rejected', message);
      if (parentEmail && parentEmail !== studentEmail) {
        await sendEmail(parentEmail, `Payment Rejected for ${payment.fee.student.user.name}`, message);
      }
    }

    res.json(updatedPayment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;