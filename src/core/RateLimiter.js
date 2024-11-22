const redisClient = require("./RedisClient");
const logger = require("../utils/logger");
const config = require("../utils/config");
const crypto = require("crypto");

class RateLimiter {
  constructor() {
    this.nodeId = crypto.randomBytes(8).toString("hex");
    this.localCache = new Map(); // Fallback in-memory cache
    this.setupHeartbeat();
  }

  /**
   * Setup periodic heartbeat to maintain node health status
   */
  setupHeartbeat() {
    const heartbeatInterval = setInterval(async () => {
      try {
        if (await redisClient.isReady()) {
          const client = await redisClient.getClient();
          await client
            .multi()
            .hset(`node:${this.nodeId}`, {
              lastHeartbeat: Date.now(),
              status: "active",
            })
            .expire(`node:${this.nodeId}`, 30)
            .exec();
        }
      } catch (error) {
        logger.debug("Heartbeat skipped - Redis unavailable");
      }
    }, config.heartbeatInterval || 5000);

    // Cleanup on application shutdown
    process.on("SIGTERM", async () => {
      clearInterval(heartbeatInterval);
      try {
        if (await redisClient.isReady()) {
          const client = await redisClient.getClient();
          await client.hset(`node:${this.nodeId}`, "status", "shutdown");
        }
      } catch (error) {
        logger.error("Shutdown cleanup failed", { error: error.message });
      }
    });
  }

  /**
   * Generate a unique key for rate limiting
   * @param {string} identifier - User identifier (IP, API key, etc.)
   * @param {string} action - Optional action identifier
   * @returns {string} Unique rate limit key
   */
  generateKey(identifier, action = "default") {
    return `ratelimit:${identifier}:${action}`;
  }

  /**
   * Check if a request is allowed based on rate limits
   * @param {string} identifier - User identifier (IP, API key, etc.)
   * @param {Object} options - Rate limiting options
   * @returns {Promise<Object>} Rate limit check result
   */
  async isAllowed(identifier, options = {}) {
    const {
      limit = config.defaultLimit || 100,
      window = config.defaultWindow || 60000,
      action = "default",
      burst = Math.ceil(limit * 0.1), // Allow 10% burst
    } = options;

    const key = this.generateKey(identifier, action);
    const now = Date.now();
    const windowStart = now - window;

    try {
      // Check Redis availability
      if (!(await redisClient.isReady())) {
        return this.fallbackCheck(key, limit, window);
      }

      const client = await redisClient.getClient();

      // Using Redis sorted set for sliding window
      const multi = client.multi();

      // Remove old entries outside the window
      multi.zremrangebyscore(key, 0, windowStart);

      // Add current request timestamp
      multi.zadd(key, now, `${now}:${crypto.randomBytes(6).toString("hex")}`);

      // Get count of requests in current window
      multi.zcard(key);

      // Set expiry on the key
      multi.expire(key, Math.ceil(window / 1000));

      // Execute transaction
      const results = await multi.exec();

      if (!results) {
        logger.error("Redis transaction failed");
        return this.fallbackCheck(key, limit, window);
      }

      const requestCount = results[2][1];
      const isAllowed = requestCount <= limit + burst;

      // Record metrics
      this.recordMetrics(identifier, isAllowed, requestCount);

      return {
        allowed: isAllowed,
        current: requestCount,
        limit: limit,
        remaining: Math.max(0, limit + burst - requestCount),
        reset: new Date(now + window),
        burst: requestCount > limit ? "used" : "available",
      };
    } catch (error) {
      logger.error("Rate limit check failed", {
        error: error.message,
        identifier,
        action,
      });
      return this.fallbackCheck(key, limit, window);
    }
  }

  /**
   * Fallback to in-memory rate limiting when Redis is unavailable
   * @param {string} key - Rate limit key
   * @param {number} limit - Rate limit
   * @param {number} window - Time window in ms
   * @returns {Object} Rate limit check result
   */
  fallbackCheck(key, limit, window) {
    const now = Date.now();

    if (!this.localCache.has(key)) {
      this.localCache.set(key, []);
    }

    let requests = this.localCache.get(key);

    // Clean old requests
    requests = requests.filter((timestamp) => timestamp > now - window);

    // Add current request
    requests.push(now);

    // Update cache
    this.localCache.set(key, requests);

    // Clean up old entries periodically
    if (this.localCache.size > 10000) {
      this.cleanupLocalCache();
    }

    return {
      allowed: true, // Fail open in fallback mode
      current: requests.length,
      limit: limit,
      remaining: limit,
      reset: new Date(now + window),
      fallback: true,
    };
  }

  /**
   * Clean up expired entries from local cache
   */
  cleanupLocalCache() {
    const now = Date.now();
    for (const [key, timestamps] of this.localCache.entries()) {
      const valid = timestamps.filter((ts) => ts > now - 3600000); // Keep last hour
      if (valid.length === 0) {
        this.localCache.delete(key);
      } else {
        this.localCache.set(key, valid);
      }
    }
  }

  /**
   * Record metrics for monitoring
   * @param {string} identifier - User identifier
   * @param {boolean} allowed - Whether request was allowed
   * @param {number} count - Current request count
   */
  async recordMetrics(identifier, allowed, count) {
    try {
      if (await redisClient.isReady()) {
        const client = await redisClient.getClient();
        const now = Date.now();
        const hour = Math.floor(now / 3600000);

        await client
          .multi()
          .hincrby(`stats:${hour}`, "total", 1)
          .hincrby(`stats:${hour}`, allowed ? "allowed" : "blocked", 1)
          .hincrby(`stats:${hour}:users`, identifier, 1)
          .expire(`stats:${hour}`, 86400) // Keep for 24 hours
          .expire(`stats:${hour}:users`, 86400)
          .exec();
      }
    } catch (error) {
      logger.debug("Failed to record metrics", { error: error.message });
    }
  }

  /**
   * Get current rate limit status for an identifier
   * @param {string} identifier - User identifier
   * @param {string} action - Optional action identifier
   * @returns {Promise<Object>} Current rate limit status
   */
  async getStatus(identifier, action = "default") {
    try {
      if (!(await redisClient.isReady())) {
        return { error: "Redis unavailable" };
      }

      const key = this.generateKey(identifier, action);
      const client = await redisClient.getClient();
      const count = await client.zcard(key);

      return {
        current: count,
        identifier,
        action,
      };
    } catch (error) {
      logger.error("Failed to get rate limit status", { error: error.message });
      return { error: "Status check failed" };
    }
  }

  /**
   * Reset rate limit for an identifier
   * @param {string} identifier - User identifier
   * @param {string} action - Optional action identifier
   * @returns {Promise<boolean>} Success status
   */
  async reset(identifier, action = "default") {
    try {
      if (!(await redisClient.isReady())) {
        this.localCache.delete(this.generateKey(identifier, action));
        return true;
      }

      const key = this.generateKey(identifier, action);
      const client = await redisClient.getClient();
      await client.del(key);
      return true;
    } catch (error) {
      logger.error("Failed to reset rate limit", { error: error.message });
      return false;
    }
  }
}

module.exports = new RateLimiter();
