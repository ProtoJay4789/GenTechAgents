/**
 * PM2 Ecosystem Config — GenTech-Agency Droplet
 * Run: pm2 start deploy/ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: "gentech-agents",
      script: "packages/jimmy/dist/bin/jimmy.js",
      args: "start",
      cwd: "/home/user/GenTechAgents",
      interpreter: "node",
      user: "gentech",
      env_file: "/home/user/GenTechAgents/.env",
      // Restart if it crashes, but not in a loop
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 3000,
      kill_timeout: 5000,
      // Logging
      out_file: "/home/user/GenTechAgents/logs/pm2-out.log",
      error_file: "/home/user/GenTechAgents/logs/pm2-err.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      // Watch mode off in production
      watch: false,
    },
  ],
};
