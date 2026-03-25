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
const feeRoutes = require('./routes/fees');
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

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/parents', parentRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/fees', feeRoutes);
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

app.get('/', (req, res) => {
  res.send('LMS API is running');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));