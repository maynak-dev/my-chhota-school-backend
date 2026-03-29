const express = require('express');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { PrismaClient } = require('@prisma/client');
const { generateReceiptBuffer } = require('../utils/receipt');
const { sendEmailWithAttachment, sendEmail } = require('../utils/email');

const prisma = new PrismaClient();
const router = express.Router();

// ✅ Create a payment request (Parent only – Students not allowed)
router.post('/', auth, async (req, res) => {
  const { feeId, amount, method, transactionId } = req.body;

  // Block students
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

    // Authorization: only PARENT of that student or ADMIN/SUB_ADMIN
    if (req.user.role === 'PARENT') {
      const parent = await prisma.parent.findUnique({
        where: { userId: req.user.id },
        include: { children: true }
      });
      if (!parent || !parent.children.some(c => c.id === fee.studentId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    } else if (req.user.role !== 'ADMIN' && req.user.role !== 'SUB_ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Check amount not exceeding balance
    const balance = fee.totalFees - fee.paidAmount;
    if (amount > balance) return res.status(400).json({ error: 'Amount exceeds due balance' });

    // Create payment with PENDING status
    const receiptNo = `RCPT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
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

    // Notify admins
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { email: true }
    });
    for (const admin of admins) {
      await sendEmail(
        admin.email,
        'New Fee Payment Request',
        `A payment of ₹${amount} has been initiated for student ${fee.student.user.name} (${fee.student.id}). Receipt: ${receiptNo}. Please verify and approve/reject.`
      );
    }

    // Create notification in DB for admin panel
    await prisma.notification.create({
      data: {
        type: 'FEE_PAYMENT',
        title: 'Payment Pending Approval',
        message: `Parent of ${fee.student.user.name} paid ₹${amount} via ${method}. Receipt: ${receiptNo}. Please approve.`,
        paymentId: payment.id,
        studentId: fee.student.id,
        studentName: fee.student.user.name,
        amount: amount,
        isRead: false,
      },
    });

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
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      return res.json(payments);
    }

    // For Student or Parent
    if (user.role === 'STUDENT') {
      const student = await prisma.student.findUnique({ where: { userId: user.id } });
      if (!student) return res.status(403).json({ error: 'Student not found' });
      where.fee = { studentId: student.id };
    } else if (user.role === 'PARENT') {
      const parent = await prisma.parent.findUnique({
        where: { userId: user.id },
        include: { children: true },
      });
      if (!parent) return res.status(403).json({ error: 'Parent not found' });
      const childIds = parent.children.map(c => c.id);
      if (studentId && !childIds.includes(studentId)) return res.status(403).json({ error: 'Forbidden' });
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
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(payments);
  } catch (err) {
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
            student: { include: { user: true, parent: { include: { user: true } } } },
          },
        },
      },
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
      let feeStatus = 'PENDING';
      if (newPaidAmount >= payment.fee.totalFees) feeStatus = 'PAID';
      else if (new Date() > payment.fee.dueDate) feeStatus = 'OVERDUE';
      else feeStatus = 'PENDING';

      await prisma.fee.update({
        where: { id: payment.feeId },
        data: {
          paidAmount: newPaidAmount,
          status: feeStatus,
        },
      });

      // Generate PDF receipt
      const pdfBuffer = await generateReceiptBuffer(updatedPayment, payment.fee.student, payment.fee);

      // Send email with receipt to student and parent
      const studentEmail = payment.fee.student.user.email;
      const parentEmail = payment.fee.student.parent?.user?.email;
      const emailHtml = `
        <h2>Payment Approved</h2>
        <p>Dear ${payment.fee.student.user.name},</p>
        <p>Your payment of ₹${payment.amount} has been approved.</p>
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
        await sendEmailWithAttachment(parentEmail, `Fee Payment Receipt for ${payment.fee.student.user.name}`, emailHtml, [attachment]);
      }
    } else {
      // Rejected – send notification email
      const studentEmail = payment.fee.student.user.email;
      const parentEmail = payment.fee.student.parent?.user?.email;
      const rejectHtml = `
        <h2>Payment Rejected</h2>
        <p>Dear ${payment.fee.student.user.name},</p>
        <p>Your payment of ₹${payment.amount} (Receipt: ${payment.receiptNo}) has been rejected.</p>
        <p>Please contact the admin for further details.</p>
      `;
      if (studentEmail) await sendEmail(studentEmail, 'Fee Payment Rejected', rejectHtml);
      if (parentEmail && parentEmail !== studentEmail) await sendEmail(parentEmail, `Fee Payment Rejected for ${payment.fee.student.user.name}`, rejectHtml);
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