import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import connectDB from './config/db.js';
import { setIo } from './utils/socket.js';
import { startScheduler } from './utils/scheduler.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import examRoutes from './routes/exam.js';
import adminRoutes from './routes/admin.js';
import articleRoutes from './routes/article.js';
import subscriptionRoutes from './routes/subscription.js';
import categoryRoutes from './routes/category.js';
import subjectRoutes from './routes/subject.js';
import gamificationRoutes from './routes/gamification.js';
import notificationRoutes from './routes/notification.js';
import testSeriesRoutes from './routes/testSeries.js';
import reviewRoutes from './routes/review.js';
import studyPlanRoutes from './routes/studyPlan.js';
import practiceSessionRoutes from './routes/practiceSession.js';
import pyqRoutes from './routes/pyq.js';
import haryanaGkRoutes from './routes/haryanaGk.js';
import currentAffairRoutes from './routes/currentAffair.js';
import configRoutes from './routes/config.js';
import questionReviewRoutes from './routes/questionReview.js';
import liveMockRoutes from './routes/liveMock.js';
import referralRoutes from './routes/referral.js';
import homeRoutes from './routes/home.js';
import questionRoutes from './routes/question.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;
const isServerless = !!process.env.VERCEL;

if (!isServerless) {
  app.set('trust proxy', 1);
}

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serverless only: connect DB per request. EC2 connects once at startup.
if (isServerless) {
  app.use(async (req, res, next) => {
    if (req.path === '/api/health' || req.path === '/health') return next();
    try {
      await connectDB();
      return next();
    } catch (error) {
      console.error('DB connection failed:', error.message);
      return res.status(503).json({ message: 'Database connection failed' });
    }
  });
}

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/test-series', testSeriesRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/study-plans', studyPlanRoutes);
app.use('/api/practice-sessions', practiceSessionRoutes);
app.use('/api/pyq', pyqRoutes);
app.use('/api/haryana-gk', haryanaGkRoutes);
app.use('/api/current-affairs', currentAffairRoutes);
app.use('/api/config', configRoutes);
app.use('/api/question-review', questionReviewRoutes);
app.use('/api/live-mock', liveMockRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/questions', questionRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'GopPrep API is running',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'GopPrep API is running',
    timestamp: new Date().toISOString(),
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err : {},
  });
});

if (!isServerless) {
  const httpServer = http.createServer(app);

  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  setIo(io);

  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);
    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
    });
  });

  const startServer = async () => {
    try {
      await connectDB();
      httpServer.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
        startScheduler(); // push reminders (long-lived server only, not serverless)
      });
    } catch (error) {
      console.error('Server startup failed:', error.message);
      process.exit(1);
    }
  };

  startServer();
}

export default app;
