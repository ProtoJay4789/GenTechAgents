/**
 * PM2 Ecosystem Config — GenTech-Agency Droplet
 * Run: pm2 start deploy/ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: "gentech-agents",
      script: "node_modules/.bin/jinn",
      args: "start",
      cwd: "/opt/gentech-agents",
      interpreter: "none",
      env_file: "/opt/gentech-agents/.env",
      // Restart if it crashes, but not in a loop
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 3000,
      // Logging
      out_file: "/opt/gentech-agents/logs/pm2-out.log",
      error_file: "/opt/gentech-agents/logs/pm2-err.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      // Watch mode off in production
      watch: false,
    },
  ],
};
