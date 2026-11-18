// pm2: `npm ci && npm run build && pm2 start ecosystem.config.cjs && pm2 save`
module.exports = {
  apps: [{
    name: 'chat-server',
    script: 'dist/main.js',
    cwd: __dirname,
    instances: 1, // single instance: presence + rooms live in this process (no Redis adapter yet)
    exec_mode: 'fork',
    autorestart: true,
    max_restarts: 20,
    restart_delay: 3000,
    max_memory_restart: '500M',
    env: { NODE_ENV: 'production' },
  }],
};
