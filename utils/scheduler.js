import cron from 'node-cron';
import {
  runDailyQuizReminders,
  runStreakReminders,
  runLiveTestReminders,
  runLiveMockEveReminders,
  runLiveMockResults,
} from './reminders.js';
import { ensureUpcomingLiveMock } from './liveMock.js';
import { expireSubscriptions } from './referral.js';
import { autoDraftCurrentAffairs } from './currentAffairsAutoDraft.js';

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

  // Current affairs: draft 2 items from official PIB releases, morning and evening.
  // Drafts only — an admin publishes them. Set AUTO_CURRENT_AFFAIRS=false to stop.
  if (process.env.AUTO_CURRENT_AFFAIRS !== 'false') {
    const draftCA = run('current-affairs-drafts', () => autoDraftCurrentAffairs({ max: 2 }));
    cron.schedule('0 7 * * *', draftCA, { timezone, name: 'ca-drafts-am', noOverlap: true });
    cron.schedule('0 18 * * *', draftCA, { timezone, name: 'ca-drafts-pm', noOverlap: true });
  }

  // premium (incl. referral rewards) ends when its expiry passes
  cron.schedule('7 * * * *', run('expire-subscriptions', expireSubscriptions, { quiet: true }), {
    timezone,
    name: 'expire-subscriptions',
    noOverlap: true,
  });

  console.log(
    '[scheduler] scheduled (IST): premium expiry hourly, daily quiz 8:00, streak 20:00, live tests every 5 min, ' +
      'live mock create 6:00 daily, live mock eve Sat 19:00, live mock results every 5 min, ' +
      'current-affairs drafts 7:00 + 18:00'
  );
};
