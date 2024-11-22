require("dotenv").config();

const config = {
  app: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || "development",
    nodeId: `node-${Math.random().toString(36).substr(2, 9)}`,
  },

  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    retryStrategy: (times) => {
      const delay = Math.min(times * 100, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
  },

  rateLimit: {
    defaultLimit: parseInt(process.env.DEFAULT_RATE_LIMIT) || 100,
    defaultWindow: parseInt(process.env.DEFAULT_WINDOW) || 60000, // 1 minute
    heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL) || 5000,
  },

  logging: {
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
    dirname: "logs",
    filename: "app-%DATE%.log",
    datePattern: "YYYY-MM-DD",
    maxSize: "20m",
    maxFiles: "14d",
  },
};

module.exports = config;
