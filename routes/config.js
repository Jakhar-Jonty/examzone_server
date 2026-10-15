import express from 'express';
import { getFocus, publicFocus } from '../utils/focus.js';

const router = express.Router();

// GET /api/config — public app config the clients read at start-up
router.get('/', async (req, res) => {
  const focus = await getFocus();
  res.set('Cache-Control', 'public, max-age=60');
  res.json({ focus: publicFocus(focus) });
});

export default router;
