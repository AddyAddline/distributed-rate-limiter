const RateLimiter = require("../../src/core/RateLimiter");
const Redis = require("ioredis-mock");

jest.mock("ioredis", () => require("ioredis-mock"));

describe("RateLimiter", () => {
  let rateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter();
  });

  test("should allow requests within limit", async () => {
    const result = await rateLimiter.isAllowed("test-key", 2, 1000);
    expect(result.allowed).toBe(true);
  });

  test("should block requests over limit", async () => {
    await rateLimiter.isAllowed("test-key", 1, 1000);
    const result = await rateLimiter.isAllowed("test-key", 1, 1000);
    expect(result.allowed).toBe(false);
  });
});
