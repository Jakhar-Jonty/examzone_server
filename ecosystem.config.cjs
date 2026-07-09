module.exports = {
  apps: [
    {
      name: 'goprep-api',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
        PORT: 8000,
      },
    },
  ],
};
