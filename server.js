import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import connectDB from './config/db.js';
import { setIo } from './utils/socket.js';
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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
connectDB();

// Routes
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'GopPrep API is running',
    timestamp: new Date().toISOString(),
  });
});

// Platform/liveness health route
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'GopPrep API is running',
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});


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

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

