const express = require('express');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const router = express.Router();

// Get results for a student
router.get('/student/:studentId', auth, async (req, res) => {
  const { studentId } = req.params;
  // Authorization checks
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
    const results = await prisma.result.findMany({
      where: { studentId },
      include: { exam: true },
      orderBy: { exam: { date: 'desc' } },
    });
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add/update result (Teacher)
router.post('/', auth, roleCheck('SUB_ADMIN'), async (req, res) => {
  const { studentId, examId, marksObtained, feedback } = req.body;
  try {
    // Check if result already exists
    let result = await prisma.result.findFirst({
      where: { studentId, examId },
    });
    if (result) {
      result = await prisma.result.update({
        where: { id: result.id },
        data: { marksObtained, feedback },
      });
    } else {
      result = await prisma.result.create({
        data: { studentId, examId, marksObtained, feedback },
      });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;