const express = require('express');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const router = express.Router();

router.get('/report', auth, roleCheck('ADMIN'), async (req, res) => {
  try {
    const results = await prisma.result.findMany({
      include: {
        student: { include: { user: { select: { name: true } }, batch: { select: { name: true } } } },
        exam: true,
      },
    });
    const report = results.map((r) => ({
      Student: r.student.user.name,
      Batch: r.student.batch?.name || '—',
      Exam: r.exam.name,
      'Max Marks': r.exam.maxMarks,
      'Marks Obtained': r.marksObtained,
      'Percentage': ((r.marksObtained / r.exam.maxMarks) * 100).toFixed(1) + '%',
      Feedback: r.feedback || '—',
    }));
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

router.get('/teacher/exams', auth, roleCheck('SUB_ADMIN'), async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: req.user.id },
      include: { batches: { include: { exams: true, students: { include: { user: { select: { name: true } } } } } } },
    });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
    res.json(teacher.batches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, roleCheck('SUB_ADMIN', 'ADMIN'), async (req, res) => {
  const { studentId, examId, marksObtained, feedback } = req.body;
  try {
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

router.post('/bulk', auth, roleCheck('SUB_ADMIN', 'ADMIN'), async (req, res) => {
  const { results } = req.body;
  if (!results || !Array.isArray(results)) {
    return res.status(400).json({ error: 'Results array is required.' });
  }
  try {
    const saved = [];
    for (const r of results) {
      let existing = await prisma.result.findFirst({
        where: { studentId: r.studentId, examId: r.examId },
      });
      if (existing) {
        existing = await prisma.result.update({
          where: { id: existing.id },
          data: { marksObtained: r.marksObtained, feedback: r.feedback || null },
        });
        saved.push(existing);
      } else {
        const created = await prisma.result.create({
          data: { studentId: r.studentId, examId: r.examId, marksObtained: r.marksObtained, feedback: r.feedback || null },
        });
        saved.push(created);
      }
    }
    res.json({ message: `${saved.length} results published.`, results: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;