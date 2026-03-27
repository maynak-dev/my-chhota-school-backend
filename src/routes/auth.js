const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const prisma = new PrismaClient();

const router = express.Router();

// Register (Admin only for now)
router.post('/register', auth, async (req, res) => {
  const { email, password, name, role, phone, ...extra } = req.body;
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Email already exists' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashed, name, role, phone },
    });

    // Create role-specific record if needed
    if (role === 'STUDENT') {
      const { batchId, parentId } = extra;
      await prisma.student.create({
        data: { userId: user.id, rollNumber: `STU${Date.now()}`, batchId, parentId },
      });
    } else if (role === 'TEACHER') {
      await prisma.teacher.create({
        data: { userId: user.id, subject: extra.subject, qualification: extra.qualification },
      });
    } else if (role === 'PARENT') {
      await prisma.parent.create({ data: { userId: user.id } });
    }

    res.status(201).json({ message: 'User created', user: { id: user.id, name, email, role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        student: { include: { batch: true } },
        teacher: true,
        parent: { include: { children: true } },
      },
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admit student with parent credentials (Admin only)
router.post('/admit', auth, async (req, res) => {
  const {
    // Student fields
    studentName, studentEmail, studentPassword, studentPhone, batchId, rollNumber,
    // Parent fields (optional)
    parentName, parentEmail, parentPassword,
  } = req.body;

  if (!studentName || !studentEmail || !studentPassword || !batchId) {
    return res.status(400).json({ error: 'Student name, email, password, and batch are required' });
  }

  try {
    let parentId = null;

    // Create parent user if credentials provided
    if (parentName && parentEmail && parentPassword) {
      const existingParent = await prisma.user.findUnique({ where: { email: parentEmail } });
      if (existingParent) return res.status(400).json({ error: 'Parent email already registered' });

      const hashedParentPass = await bcrypt.hash(parentPassword, 10);
      const parentUser = await prisma.user.create({
        data: { email: parentEmail, password: hashedParentPass, name: parentName, role: 'PARENT' },
      });
      const parent = await prisma.parent.create({ data: { userId: parentUser.id } });
      parentId = parent.id;
    }

    // Create student user
    const existingStudent = await prisma.user.findUnique({ where: { email: studentEmail } });
    if (existingStudent) return res.status(400).json({ error: 'Student email already registered' });

    const hashedStudentPass = await bcrypt.hash(studentPassword, 10);
    const studentUser = await prisma.user.create({
      data: { email: studentEmail, password: hashedStudentPass, name: studentName, role: 'STUDENT', phone: studentPhone || null },
    });

    const student = await prisma.student.create({
      data: {
        userId: studentUser.id,
        rollNumber: rollNumber || `STU${Date.now()}`,
        batchId,
        parentId,
      },
      include: { user: true, batch: true },
    });

    res.status(201).json({ message: 'Student admitted successfully', student });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
