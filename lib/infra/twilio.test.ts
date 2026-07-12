import { describe, expect, it, beforeAll, vi } from "vitest";
import type { SmsNotifier } from "@/lib/domain/notify";

const messagesCreateMock = vi.fn();

vi.mock("twilio", () => ({
  default: () => ({
    messages: { create: (...args: unknown[]) => messagesCreateMock(...args) },
  }),
}));

let twilioNotificationSender: SmsNotifier;

beforeAll(async () => {
  process.env.TWILIO_ACCOUNT_SID = "unit-test-sid";
  process.env.TWILIO_AUTH_TOKEN = "unit-test-token";
  process.env.TWILIO_FROM_NUMBER = "+15005550006";
  ({ twilioNotificationSender } = await import("./twilio"));
});

describe("twilioNotificationSender", () => {
  it("sends the given message to the given phone from the configured number", async () => {
    messagesCreateMock.mockResolvedValue({});

    await twilioNotificationSender.send("+923001234567", "Someone needs your blood type.");

    expect(messagesCreateMock).toHaveBeenCalledWith({
      to: "+923001234567",
      from: "+15005550006",
      body: "Someone needs your blood type.",
    });
  });
});
