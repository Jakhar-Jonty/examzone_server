// Error reporting. Does nothing until SENTRY_DSN is set in .env, so local
// development and the test phase work unchanged.
import dotenv from 'dotenv';
import * as Sentry from '@sentry/node';

dotenv.config();

export const sentryEnabled = !!process.env.SENTRY_DSN;

if (sentryEnabled) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production',
    tracesSampleRate: 0, // errors only; no performance tracing
    sendDefaultPii: false,
  });
}

/** Report an error with request context (no-op when Sentry is off). */
export const reportError = (err, req) => {
  if (!sentryEnabled) return;
  Sentry.withScope((scope) => {
    if (req) {
      scope.setTag('route', `${req.method} ${req.baseUrl || ''}${req.route?.path || req.path}`);
      if (req.user?._id) scope.setUser({ id: String(req.user._id) });
    }
    Sentry.captureException(err);
  });
};

/**
 * Many controllers catch their own errors and answer 500 without throwing;
 * report those responses too so they don't go unseen.
 */
export const reportServerErrors = (req, res, next) => {
  if (!sentryEnabled) return next();
  const json = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 500) {
      reportError(new Error(`${res.statusCode} ${req.method} ${req.originalUrl}: ${body?.message || 'error'}`), req);
    }
    return json(body);
  };
  next();
};

export { Sentry };
