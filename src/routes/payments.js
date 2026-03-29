const express = require('express');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { PrismaClient } = require('@prisma/client');
const { sendEmail, sendEmailWithAttachment } = require('../utils/email');
const { generateReceiptBuffer } = require('../utils/receipt'); // make sure this utility exists
const prisma = new PrismaClient();
const router = express.Router();

const generateReceiptNo = () => `RCPT-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

// ✅ Create a payment request (Parents or Admins only – Students blocked)
router.post('/', auth, async (req, res) => {
  const { feeId, amount, method, transactionId } = req.body;
  const user = req.user;

  // Basic validation
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

  // Block students
  if (user.role === 'STUDENT') {
    return res.status(403).json({ error: 'Students cannot make payments. Please ask your parent/guardian.' });
  }

  try {
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

    // Authorization
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

    // Check balance
    const balance = fee.totalFees - fee.paidAmount;
    if (amount > balance) {
      return res.status(400).json({ error: `Amount exceeds due balance of ₹${balance}` });
    }

    // Create payment record
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

    // Notify admins (non-blocking)
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { email: true }
    });
    admins.forEach(admin => {
      sendEmail(
        admin.email,
        'New Fee Payment Request',
        `A payment of ₹${amount} has been initiated for student ${fee.student.user.name} (${fee.student.id}). Receipt: ${receiptNo}. Please verify and approve/reject.`
      ).catch(console.error);
    });

    // In-app notification for admins
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
    }).catch(console.error);

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
            }
          }
        },
        orderBy: { createdAt: 'desc' },
      });
      return res.json(payments);
    }

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
      let feeStatus = payment.fee.status;

      if (newPaidAmount >= totalFees) {
        feeStatus = 'PAID';
      } else if (new Date() > payment.fee.dueDate) {
        feeStatus = 'OVERDUE';
      } else {
        feeStatus = 'PENDING';
      }

      await prisma.fee.update({
        where: { id: payment.feeId },
        data: {
          paidAmount: newPaidAmount,
          status: feeStatus,
        },
      });

      // Generate PDF receipt (if utility exists)
      let pdfBuffer = null;
      try {
        pdfBuffer = await generateReceiptBuffer(updatedPayment, payment.fee.student, payment.fee);
      } catch (err) {
        console.error('Receipt generation failed:', err);
      }

      // Send email with receipt
      const studentEmail = payment.fee.student.user.email;
      const parentEmail = payment.fee.student.parent?.user?.email;
      const emailHtml = `
        <h2>Payment Approved</h2>
        <p>Dear ${payment.fee.student.user.name},</p>
        <p>Your payment of ₹${payment.amount} has been approved.</p>
        <p>Receipt No: ${payment.receiptNo}</p>
        <p>Fee status: ${feeStatus}</p>
        ${pdfBuffer ? '<p>Please find attached receipt.</p>' : ''}
        <p>Thank you!</p>
      `;
      if (pdfBuffer) {
        const attachment = {
          filename: `receipt_${payment.receiptNo}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        };
        if (studentEmail) await sendEmailWithAttachment(studentEmail, 'Fee Payment Receipt', emailHtml, [attachment]);
        if (parentEmail && parentEmail !== studentEmail) await sendEmailWithAttachment(parentEmail, `Fee Payment Receipt for ${payment.fee.student.user.name}`, emailHtml, [attachment]);
      } else {
        if (studentEmail) await sendEmail(studentEmail, 'Payment Approved', emailHtml);
        if (parentEmail && parentEmail !== studentEmail) await sendEmail(parentEmail, `Payment Approved for ${payment.fee.student.user.name}`, emailHtml);
      }
    } else {
      // REJECTED
      const studentEmail = payment.fee.student.user.email;
      const parentEmail = payment.fee.student.parent?.user?.email;
      const rejectHtml = `
        <h2>Payment Rejected</h2>
        <p>Dear ${payment.fee.student.user.name},</p>
        <p>Your payment of ₹${payment.amount} (Receipt: ${payment.receiptNo}) has been rejected.</p>
        <p>Please contact the admin for further details.</p>
      `;
      if (studentEmail) await sendEmail(studentEmail, 'Payment Rejected', rejectHtml);
      if (parentEmail && parentEmail !== studentEmail) await sendEmail(parentEmail, `Payment Rejected for ${payment.fee.student.user.name}`, rejectHtml);
    }

    res.json(updatedPayment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Download receipt (only after approval)
router.get('/receipt/:paymentId', auth, async (req, res) => {
  const { paymentId } = req.params;
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        fee: {
          include: {
            student: { include: { user: true, batch: true, parent: { include: { user: true } } } },
          },
        },
      },
    });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.status !== 'APPROVED') {
      return res.status(403).json({ error: 'Receipt available only after payment is approved' });
    }

    // Authorization
    const studentId = payment.fee.student.id;
    if (req.user.role === 'STUDENT') {
      const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
      if (student?.id !== studentId) return res.status(403).json({ error: 'Forbidden' });
    } else if (req.user.role === 'PARENT') {
      const parent = await prisma.parent.findUnique({
        where: { userId: req.user.id },
        include: { children: true },
      });
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