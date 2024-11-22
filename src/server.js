const express = require("express");
const rateLimiterMiddleware = require("./middleware/rateLimiterMiddleware");
const logger = require("./utils/logger");
const config = require("./utils/config");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(rateLimiterMiddleware());

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date(),
    nodeId: config.app.nodeId,
  });
});

app.get("/api/test", (req, res) => {
  res.json({
    message: "Success",
    nodeId: config.app.nodeId,
    timestamp: new Date(),
  });
});

app.use((err, req, res, next) => {
  logger.error("Unhandled error", { error: err.message });
  res.status(500).json({ error: "Internal Server Error" });
});

const server = app.listen(config.app.port, () => {
  logger.info(`Rate limiter service started on port ${config.app.port}`);
});

server.on("error", (error) => {
  logger.error("Server error", { error: error.message });
  process.exit(1);
});

process.on("unhandledRejection", (error) => {
  logger.error("Unhandled rejection", { error: error.message });
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", { error: error.message });
  process.exit(1);
});

module.exports = app;
