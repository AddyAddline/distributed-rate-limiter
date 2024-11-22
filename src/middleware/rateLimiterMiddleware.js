const rateLimiter = require("../core/RateLimiter");

const rateLimiterMiddleware = (options = {}) => {
  return async (req, res, next) => {
    try {
      const identifier = req.ip; // Or custom identifier
      const result = await rateLimiter.isAllowed(identifier, options);

      res.set({
        "X-RateLimit-Limit": result.limit,
        "X-RateLimit-Remaining": result.remaining,
        "X-RateLimit-Reset": result.reset.getTime(),
        "X-RateLimit-Used": result.current,
      });

      if (!result.allowed) {
        return res.status(429).json({
          error: "Too Many Requests",
          retryAfter: result.reset,
        });
      }

      next();
    } catch (error) {
      logger.error("Rate limiter middleware error", { error: error.message });
      next();
    }
  };
};

module.exports = rateLimiterMiddleware;
