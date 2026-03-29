const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const studentRoutes = require('./routes/students');
const teacherRoutes = require('./routes/teachers');
const parentRoutes = require('./routes/parents');
const batchRoutes = require('./routes/batches');
const courseRoutes = require('./routes/courses');
const attendanceRoutes = require('./routes/attendance');
const feeRecordsRoutes = require('./routes/feeRecords');   // ✅ NEW: fee CRUD
const paymentRoutes = require('./routes/payments');        // ✅ payment routes
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

// CORS configuration
const allowedOrigins = [
  'https://my-chhota-school.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8081',
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ API Routes – order does not matter because paths are distinct
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/parents', parentRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/fees', feeRecordsRoutes);        // ✅ handles GET, POST, PUT /api/fees
app.use('/api/payments', paymentRoutes);       // ✅ handles POST, GET, PUT /api/payments
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

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'LMS API is running', status: 'OK' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.originalUrl}` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));