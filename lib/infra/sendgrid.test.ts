import { describe, expect, it, beforeAll, vi } from "vitest";
import type { EmailNotifier } from "@/lib/domain/notify";

const setApiKeyMock = vi.fn();
const sendMock = vi.fn();

vi.mock("@sendgrid/mail", () => ({
  default: {
    setApiKey: (...args: unknown[]) => setApiKeyMock(...args),
    send: (...args: unknown[]) => sendMock(...args),
  },
}));

describe("sendgridEmailNotifier", () => {
  it("throws at import time if SENDGRID_API_KEY is missing", async () => {
    vi.resetModules();
    delete process.env.SENDGRID_API_KEY;
    process.env.SENDGRID_FROM_EMAIL = "notify@example.com";

    await expect(import("./sendgrid")).rejects.toThrow();
  });

  it("throws at import time if SENDGRID_FROM_EMAIL is missing", async () => {
    vi.resetModules();
    process.env.SENDGRID_API_KEY = "unit-test-key";
    delete process.env.SENDGRID_FROM_EMAIL;

    await expect(import("./sendgrid")).rejects.toThrow();
  });

  it("sends an email via sgMail using the configured from address", async () => {
    vi.resetModules();
    process.env.SENDGRID_API_KEY = "unit-test-key";
    process.env.SENDGRID_FROM_EMAIL = "notify@example.com";

    const { sendgridEmailNotifier } = (await import("./sendgrid")) as {
      sendgridEmailNotifier: EmailNotifier;
    };

    await sendgridEmailNotifier.send({
      to: "amara@example.com",
      subject: "Someone needs your blood type",
      body: "Zara needs O- blood in Gulberg.",
    });

    expect(setApiKeyMock).toHaveBeenCalledWith("unit-test-key");
    expect(sendMock).toHaveBeenCalledWith({
      to: "amara@example.com",
      from: "notify@example.com",
      subject: "Someone needs your blood type",
      text: "Zara needs O- blood in Gulberg.",
    });
  });
});
