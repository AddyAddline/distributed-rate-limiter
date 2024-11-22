const request = require("supertest");
const express = require("express");
const rateLimiterMiddleware = require("../../src/middleware/rateLimiterMiddleware");

const app = express();
app.use(rateLimiterMiddleware(2, 1000)); // 2 requests per second for testing

app.get("/test", (req, res) => {
  res.json({ message: "success" });
});

describe("Rate Limiter API", () => {
  test("should allow requests within limit", async () => {
    await request(app).get("/test").expect(200);
  });

  test("should block requests over limit", async () => {
    await request(app).get("/test");
    await request(app).get("/test");
    await request(app).get("/test").expect(429);
  });
});
