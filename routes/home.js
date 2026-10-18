import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { getHome } from '../controllers/homeController.js';

const router = express.Router();

// GET /api/home — the app's Home screen in one request
router.get('/', authenticate, getHome);

export default router;
