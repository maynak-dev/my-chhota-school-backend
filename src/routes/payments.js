const express = require('express');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { PrismaClient } = require('@prisma/client');
const { generateReceiptBuffer } = require('../utils/receipt');
const { sendEmailWithAttachment } = require('../utils/email');

const prisma = new PrismaClient();
const router = express.Router();

// Record a payment (Admin/SubAdmin/Parent ONLY — Students are NOT allowed)
router.post('/', auth, async (req, res) => {
  const { feeId, amount, method, transactionId } = req.body;

  // Block students from making payments
  if (req.user.role === 'STUDENT') {
    return res.status(403).json({ error: 'Students cannot make payments. Please ask your parent/guardian to pay.' });
  }

  try {
    const fee = await prisma.fee.findUnique({
      where: { id: feeId },
      include: {
        student: {
          include: {
            user: true,
            batch: true,
            parent: { include: { user: true } }
          }
        }
      }
    });
    if (!fee) return res.status(404).json({ error: 'Fee record not found' });

    // Authorization
    if (req.user.role === 'PARENT') {
      const parent = await prisma.parent.findUnique({ where: { userId: req.user.id }, include: { children: true } });
      if (!parent || !parent.children.some(c => c.id === fee.studentId)) return res.status(403).json({ error: 'Forbidden' });
    } else if (req.user.role !== 'ADMIN' && req.user.role !== 'SUB_ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const receiptNo = `RCPT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const payment = await prisma.payment.create({
      data: { feeId, amount, method, receiptNo, transactionId },
    });

    // Create admin notification if payment is made by PARENT
    if (req.user.role === 'PARENT') {
      await prisma.notification.create({
        data: {
          type: 'FEE_PAYMENT',
          title: 'Fee Payment Received',
          message: `Parent of ${fee.student.user.name} has paid \u20B9${amount} via ${method}. Receipt: ${receiptNo}. Please verify and update fee status if needed.`,
          paymentId: payment.id,
          studentId: fee.student.id,
          studentName: fee.student.user.name,
          amount: amount,
          isRead: false,
        },
      });
    }

    // Update fee record
    const newPaidAmount = fee.paidAmount + amount;
    let status = 'PENDING';
    if (newPaidAmount >= fee.totalFees) status = 'PAID';
    else if (new Date() > fee.dueDate) status = 'OVERDUE';
    else status = 'PENDING';

    await prisma.fee.update({
      where: { id: feeId },
      data: { paidAmount: newPaidAmount, status },
    });

    // Generate PDF buffer
    const pdfBuffer = await generateReceiptBuffer(payment, fee.student, fee);

    // Send email with attachment
    const studentEmail = fee.student.user.email;
    const parentEmail = fee.student.parent?.user?.email;

    const emailHtml = `
      <h2>Payment Received</h2>
      <p>Dear ${fee.student.user.name},</p>
      <p>Your payment of ₹${amount} has been successfully processed.</p>
      <p>Receipt No: ${payment.receiptNo}</p>
      <p>Please find the attached receipt for your records.</p>
      <p>Thank you!</p>
    `;

    const attachment = {
      filename: `receipt_${payment.receiptNo}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    };

    if (studentEmail) {
      await sendEmailWithAttachment(studentEmail, 'Fee Payment Receipt', emailHtml, [attachment]);
    }
    if (parentEmail && parentEmail !== studentEmail) {
      await sendEmailWithAttachment(parentEmail, `Fee Payment Receipt for ${fee.student.user.name}`, emailHtml, [attachment]);
    }

    res.status(201).json({ ...payment, receiptUrl: `/api/payments/receipt/${payment.id}` });
  } catch (err) {
    console.error(err);
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

// Download receipt (stream PDF)
router.get('/receipt/:paymentId', auth, async (req, res) => {
  const { paymentId } = req.params;
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        fee: {
          include: {
            student: { include: { user: true, batch: true } },
          },
        },
      },
    });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

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

    const pdfBuffer = await generateReceiptBuffer(payment, payment.fee.student, payment.fee);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt_${payment.receiptNo}.pdf`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
