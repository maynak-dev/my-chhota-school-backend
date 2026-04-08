const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const studentRoutes = require('./routes/students');
const teacherRoutes = require('./routes/teachers');
const parentRoutes = require('./routes/parents');
const batchRoutes = require('./routes/batches');
const courseRoutes = require('./routes/courses');
const attendanceRoutes = require('./routes/attendance');
// const feeRoutes = require('./routes/fees');
const feeRecordsRoutes = require('./routes/feesRecords');
const paymentRoutes = require('./routes/payments');
const videoRoutes = require('./routes/videos');
const noteRoutes = require('./routes/notes');
const announcementRoutes = require('./routes/announcements');
const timetableRoutes = require('./routes/timetable');
const assignmentRoutes = require('./routes/assignments');
const examRoutes = require('./routes/exams');
const resultRoutes = require('./routes/results');
const leaveRoutes = require('./routes/leaves');
const payrollRoutes = require('./routes/payroll');
const expenseRoutes = require('./routes/expenses');
const diaryRoutes = require('./routes/diary');
const dashboardRoutes = require('./routes/dashboard');
const notificationRoutes = require('./routes/notifications');

const app = express();

// ✅ CORS configuration – allow multiple origins including mobile apps
const allowedOrigins = [
  'https://my-chhota-school.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8081', // React Native Metro bundler
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Body parsing middleware with increased limit for large payloads (e.g., video URLs, notes)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/parents', parentRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/attendance', attendanceRoutes);
// app.use('/api/fees', feeRoutes);
app.use('/api/fees', feeRecordsRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/diary', diaryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check / root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'LMS API is running', status: 'OK' });
});

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.originalUrl}` });
});

// Global error handler (must be last)
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ error: message });
});

// Fee reminder scheduler — runs every day at 8:00 AM
const { sendFeeReminders } = require('./utils/feeReminder');

function scheduleDailyReminder() {
  const now = new Date();
  const nextRun = new Date();
  nextRun.setHours(8, 0, 0, 0);
  if (nextRun <= now) nextRun.setDate(nextRun.getDate() + 1);
  const msUntilNextRun = nextRun.getTime() - now.getTime();

  setTimeout(() => {
    sendFeeReminders();
    setInterval(sendFeeReminders, 24 * 60 * 60 * 1000); // repeat every 24h
  }, msUntilNextRun);

  console.log(`[FeeReminder] Scheduled. Next run at ${nextRun.toLocaleString()}`);
}

scheduleDailyReminder();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));