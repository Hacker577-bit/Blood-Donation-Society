import "@testing-library/jest-dom/vitest";

process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
process.env.TWILIO_ACCOUNT_SID = "test-sid";
process.env.TWILIO_AUTH_TOKEN = "test-token";
process.env.TWILIO_FROM_NUMBER = "+15005550006";
process.env.SENDGRID_API_KEY = "test-key";
process.env.SENDGRID_FROM_EMAIL = "test@example.com";
