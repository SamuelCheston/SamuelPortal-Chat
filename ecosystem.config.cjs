module.exports = {
  apps: [
    {
      name: "samuel-portal-chat",
      script: "npm",
      args: "start -- --hostname 127.0.0.1 --port 3001",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "1G",
    },
  ],
};
