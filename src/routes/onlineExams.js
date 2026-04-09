const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate } = require('../middleware/auth');
const { roleCheck } = require('../middleware/roleCheck');

// ─── Question Bank ──────────────────────────────────────
router.get('/question-bank/:courseId', authenticate, async (req, res) => {
  try {
    const questions = await prisma.questionBank.findMany({
      where: { courseId: req.params.courseId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(questions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/question-bank', authenticate, roleCheck(['ADMIN', 'SUB_ADMIN']), async (req, res) => {
  try {
    const q = await prisma.questionBank.create({ data: req.body });
    res.status(201).json(q);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk import questions
router.post('/question-bank/bulk', authenticate, roleCheck(['ADMIN', 'SUB_ADMIN']), async (req, res) => {
  try {
    const { questions } = req.body; // array of question objects
    const created = await prisma.questionBank.createMany({ data: questions });
    res.status(201).json({ count: created.count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Online Exams ───────────────────────────────────────
router.get('/batch/:batchId', authenticate, async (req, res) => {
  try {
    const exams = await prisma.onlineExam.findMany({
      where: { batchId: req.params.batchId },
      orderBy: { startTime: 'desc' },
    });
    res.json(exams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const exam = await prisma.onlineExam.findUnique({
      where: { id: req.params.id },
      include: { questions: { orderBy: { order: 'asc' } } },
    });

    // If student, check timing and randomize if needed
    if (req.user.role === 'STUDENT') {
      const now = new Date();
      if (now < exam.startTime) return res.status(400).json({ error: 'Exam has not started yet' });
      if (now > exam.endTime) return res.status(400).json({ error: 'Exam has ended' });

      // Remove correct answers from response
      const sanitized = {
        ...exam,
        questions: exam.questions.map(q => {
          const { correctIndex, ...rest } = q;
          return rest;
        }),
      };

      // Randomize if enabled
      if (exam.randomize) {
        sanitized.questions = sanitized.questions.sort(() => Math.random() - 0.5);
      }

      return res.json(sanitized);
    }

    res.json(exam);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create exam
router.post('/', authenticate, roleCheck(['ADMIN', 'SUB_ADMIN']), async (req, res) => {
  try {
    const { title, batchId, duration, totalMarks, randomize, proctoring, startTime, endTime, questions } = req.body;
    const exam = await prisma.onlineExam.create({
      data: {
        title, batchId, duration, totalMarks, randomize, proctoring,
        startTime: new Date(startTime), endTime: new Date(endTime),
        questions: { create: questions },
      },
      include: { questions: true },
    });
    res.status(201).json(exam);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST auto-generate exam from question bank
router.post('/generate', authenticate, roleCheck(['ADMIN', 'SUB_ADMIN']), async (req, res) => {
  try {
    const { title, batchId, courseId, duration, count, difficulty, randomize, proctoring, startTime, endTime } = req.body;

    const where = { courseId };
    if (difficulty) where.difficulty = difficulty;

    const allQuestions = await prisma.questionBank.findMany({ where });
    const shuffled = allQuestions.sort(() => Math.random() - 0.5).slice(0, count);

    const exam = await prisma.onlineExam.create({
      data: {
        title, batchId, duration, totalMarks: shuffled.length, randomize: randomize ?? true,
        proctoring: proctoring ?? false,
        startTime: new Date(startTime), endTime: new Date(endTime),
        questions: {
          create: shuffled.map((q, i) => ({
            questionBankId: q.id, question: q.question, options: q.options, correctIndex: q.correctIndex, marks: 1, order: i,
          })),
        },
      },
      include: { questions: true },
    });
    res.status(201).json(exam);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST submit exam (auto-evaluate)
router.post('/:id/submit', authenticate, async (req, res) => {
  try {
    const { answers, tabSwitches } = req.body;
    const exam = await prisma.onlineExam.findUnique({
      where: { id: req.params.id },
      include: { questions: true },
    });

    // Auto-evaluate
    let score = 0;
    exam.questions.forEach(q => {
      if (answers[q.id] === q.correctIndex) score += q.marks;
    });

    const submission = await prisma.examSubmission.create({
      data: {
        examId: req.params.id,
        studentId: req.user.studentId || req.user.id,
        answers,
        score,
        tabSwitches: tabSwitches || 0,
      },
    });

    res.status(201).json({ ...submission, totalMarks: exam.totalMarks });
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Already submitted' });
    res.status(500).json({ error: err.message });
  }
});

// GET exam results
router.get('/:id/results', authenticate, async (req, res) => {
  try {
    const submissions = await prisma.examSubmission.findMany({
      where: { examId: req.params.id },
      orderBy: { score: 'desc' },
    });
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;