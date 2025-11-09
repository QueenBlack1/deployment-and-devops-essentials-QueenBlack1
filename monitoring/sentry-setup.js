// Sentry configuration for both frontend and backend
const Sentry = {
  init: (platform) => {
    const config = {
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.APP_VERSION || '1.0.0',
      tracesSampleRate: 1.0,
      profilesSampleRate: 1.0,
    };

    if (platform === 'node') {
      const SentryNode = require('@sentry/node');
      SentryNode.init({
        ...config,
        integrations: [
          new SentryNode.Integrations.Http({ tracing: true }),
          new SentryNode.Integrations.Express({ app: require('./app') }),
          new SentryNode.Integrations.Mongo({ useMongoose: true }),
        ],
      });
    } else if (platform === 'react') {
      const SentryReact = require('@sentry/react');
      SentryReact.init({
        ...config,
        integrations: [
          new SentryReact.BrowserTracing({
            tracePropagationTargets: [
              process.env.REACT_APP_API_URL,
              /^\//
            ],
          }),
          new SentryReact.Replay(),
        ],
      });
    }
  },

  captureException: (error, context) => {
    if (process.env.NODE_ENV === 'production') {
      const Sentry = require('@sentry/node');
      Sentry.captureException(error, {
        extra: context
      });
    } else {
      console.error('Error captured:', error, context);
    }
  },

  captureMessage: (message, level = 'info') => {
    if (process.env.NODE_ENV === 'production') {
      const Sentry = require('@sentry/node');
      Sentry.captureMessage(message, level);
    } else {
      console.log(`[${level.toUpperCase()}] ${message}`);
    }
  }
};

module.exports = Sentry;