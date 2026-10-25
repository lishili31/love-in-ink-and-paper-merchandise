module.exports = {
  apps: [
    {
      name: "letters",
      cwd: __dirname,
      script: "dist/boot.js",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "300M",
      time: true,
      env: {
        NODE_ENV: "production",
        PORT: 3022,
      },
    },
  ],
};
