import cron from 'node-cron';
import {
  runDailyQuizReminders,
  runStreakReminders,
  runLiveTestReminders,
  runLiveMockEveReminders,
  runLiveMockResults,
} from './reminders.js';
import { ensureUpcomingLiveMock } from './liveMock.js';

/**
 * Timed jobs. Runs only on the long-lived server (EC2 / PM2 with one
 * instance), never on Vercel serverless. Times are India time.
 * Set DISABLE_SCHEDULER=true to turn it off (e.g. on a second instance).
 */
export const startScheduler = () => {
  if (process.env.DISABLE_SCHEDULER === 'true') {
    console.log('[scheduler] disabled (DISABLE_SCHEDULER=true)');
    return;
  }

  const timezone = 'Asia/Kolkata';
  const run = (name, job, { quiet = false } = {}) => async () => {
    try {
      const result = await job();
      const sent = result?.recipients ?? result?.results?.reduce((n, r) => n + (r.recipients || 0), 0) ?? 0;
      if (!quiet || sent > 0) console.log(`[scheduler] ${name}:`, JSON.stringify(result));
    } catch (err) {
      console.error(`[scheduler] ${name} failed:`, err.message);
    }
  };

  cron.schedule('0 8 * * *', run('daily-quiz', runDailyQuizReminders), { timezone, name: 'daily-quiz', noOverlap: true });
  cron.schedule('0 20 * * *', run('streak', runStreakReminders), { timezone, name: 'streak', noOverlap: true });
  cron.schedule('*/5 * * * *', run('live-tests', runLiveTestReminders, { quiet: true }), {
    timezone,
    name: 'live-tests',
    noOverlap: true,
  });

  // Weekly All-Haryana live mock: create next Sunday's paper, remind the evening before, send results
  cron.schedule('0 6 * * *', run('live-mock-create', async () => {
    const { exam, created } = await ensureUpcomingLiveMock();
    return { created, exam: exam?.title || null };
  }), { timezone, name: 'live-mock-create', noOverlap: true });
  cron.schedule('0 19 * * 6', run('live-mock-eve', runLiveMockEveReminders), { timezone, name: 'live-mock-eve', noOverlap: true });
  cron.schedule('*/5 * * * *', run('live-mock-results', runLiveMockResults, { quiet: true }), {
    timezone,
    name: 'live-mock-results',
    noOverlap: true,
  });

  console.log(
    '[scheduler] scheduled (IST): daily quiz 8:00, streak 20:00, live tests every 5 min, ' +
      'live mock create 6:00 daily, live mock eve Sat 19:00, live mock results every 5 min'
  );
};
