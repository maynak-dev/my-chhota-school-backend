const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate } = require('../middleware/auth');
const { roleCheck } = require('../middleware/roleCheck');

// Student engagement metrics
router.get('/student-engagement/:batchId', authenticate, roleCheck(['ADMIN', 'SUB_ADMIN']), async (req, res) => {
  try {
    const students = await prisma.student.findMany({
      where: { batchId: req.params.batchId },
      include: { user: { select: { name: true } } },
    });

    const metrics = await Promise.all(students.map(async (s) => {
      const totalClasses = await prisma.attendance.count({ where: { studentId: s.id } });
      const present = await prisma.attendance.count({ where: { studentId: s.id, status: 'PRESENT' } });
      const videoEngagements = await prisma.videoEngagement.findMany({ where: { studentId: s.id } });
      const completedVideos = videoEngagements.filter(v => v.completed).length;

      return {
        studentId: s.id,
        name: s.user.name,
        rollNumber: s.rollNumber,
        attendanceRate: totalClasses > 0 ? ((present / totalClasses) * 100).toFixed(1) : 0,
        videosWatched: videoEngagements.length,
        videosCompleted: completedVideos,
        completionRate: videoEngagements.length > 0 ? ((completedVideos / videoEngagements.length) * 100).toFixed(1) : 0,
      };
    }));

    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Drop-off analytics (video/course level)
router.get('/drop-off/:courseId', authenticate, roleCheck(['ADMIN', 'SUB_ADMIN']), async (req, res) => {
  try {
    const videos = await prisma.video.findMany({
      where: { batch: { courseId: req.params.courseId } },
      include: { engagements: true },
    });

    const analytics = videos.map(v => {
      const total = v.engagements.length;
      const completed = v.engagements.filter(e => e.completed).length;
      const avgDropOff = v.engagements.filter(e => e.dropOffAt)
        .reduce((s, e) => s + e.dropOffAt, 0) / (total || 1);

      return {
        videoId: v.id,
        title: v.title,
        totalViewers: total,
        completedCount: completed,
        dropOffRate: total > 0 ? (((total - completed) / total) * 100).toFixed(1) : 0,
        avgDropOffSecond: Math.round(avgDropOff),
      };
    });

    res.json(analytics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Teacher performance metrics
router.get('/teacher-performance', authenticate, roleCheck(['ADMIN']), async (req, res) => {
  try {
    const teachers = await prisma.teacher.findMany({
      include: {
        user: { select: { name: true } },
        batches: { include: { students: true } },
      },
    });

    const metrics = await Promise.all(teachers.map(async (t) => {
      const studentIds = t.batches.flatMap(b => b.students.map(s => s.id));

      const totalAttendance = await prisma.attendance.count({
        where: { studentId: { in: studentIds }, markedBy: t.id },
      });
      const presentCount = await prisma.attendance.count({
        where: { studentId: { in: studentIds }, markedBy: t.id, status: 'PRESENT' },
      });

      const results = await prisma.result.findMany({
        where: { studentId: { in: studentIds } },
        include: { exam: true },
      });
      const avgScore = results.length > 0
        ? results.reduce((s, r) => s + (r.marksObtained / r.exam.maxMarks * 100), 0) / results.length
        : 0;

      return {
        teacherId: t.id,
        name: t.user.name,
        subject: t.subject,
        totalStudents: studentIds.length,
        batchCount: t.batches.length,
        classAttendanceRate: totalAttendance > 0 ? ((presentCount / totalAttendance) * 100).toFixed(1) : 0,
        avgStudentScore: avgScore.toFixed(1),
      };
    }));

    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;