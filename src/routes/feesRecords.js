const express = require('express');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();

// GET all fees (Admin/SubAdmin only)
router.get('/', auth, roleCheck('ADMIN', 'SUB_ADMIN'), async (req, res) => {
  try {
    const fees = await prisma.fee.findMany({
      include: {
        student: {
          include: { user: true }   // includes student.name
        }
      },
      orderBy: { dueDate: 'asc' }
    });
    res.json(fees);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST create a new fee record
router.post('/', auth, roleCheck('ADMIN', 'SUB_ADMIN'), async (req, res) => {
  const { studentId, totalFees, dueDate } = req.body;
  if (!studentId || !totalFees || !dueDate) {
    return res.status(400).json({ error: 'Missing required fields: studentId, totalFees, dueDate' });
  }
  try {
    const fee = await prisma.fee.create({
      data: {
        studentId,
        totalFees: parseFloat(totalFees),
        dueDate: new Date(dueDate),
        paidAmount: 0,
        status: 'PENDING'
      }
    });
    res.status(201).json(fee);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT update a fee record
router.put('/:id', auth, roleCheck('ADMIN', 'SUB_ADMIN'), async (req, res) => {
  const { id } = req.params;
  const { totalFees, dueDate, status } = req.body;
  try {
    const fee = await prisma.fee.update({
      where: { id },
      data: {
        totalFees: totalFees ? parseFloat(totalFees) : undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        status: status || undefined
      }
    });
    res.json(fee);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;