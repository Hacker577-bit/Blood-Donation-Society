import { describe, expect, it } from "vitest";
import { notifyMatches, type EmailNotifier, type SmsNotifier } from "./notify";

const CONTEXT = {
  searcherName: "Zara",
  searcherPhone: "+923009999999",
  bloodType: "O_NEG",
  area: "Gulberg",
};

function createFakeSms(impl?: (phone: string) => Promise<void>): SmsNotifier & {
  calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    async send(phone, message) {
      calls.push(phone);
      if (impl) {
        await impl(phone);
        return;
      }
      void message;
    },
  };
}

function createFakeEmail(impl?: (to: string) => Promise<void>): EmailNotifier & {
  calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    async send({ to, subject, body }) {
      calls.push(to);
      void subject;
      void body;
      if (impl) {
        await impl(to);
      }
    },
  };
}

describe("notifyMatches", () => {
  it("sends an SMS to every match", async () => {
    const sms = createFakeSms();
    const email = createFakeEmail();
    const matches = [
      { name: "Amara", phone: "+923001111111", email: null },
      { name: "Bilal", phone: "+923002222222", email: null },
    ];

    await notifyMatches(matches, CONTEXT, sms, email);

    expect(sms.calls).toEqual(["+923001111111", "+923002222222"]);
  });

  it("sends an email only to matches with a non-null email", async () => {
    const sms = createFakeSms();
    const email = createFakeEmail();
    const matches = [
      { name: "Amara", phone: "+923001111111", email: "amara@example.com" },
      { name: "Bilal", phone: "+923002222222", email: null },
    ];

    await notifyMatches(matches, CONTEXT, sms, email);

    expect(email.calls).toEqual(["amara@example.com"]);
  });

  it("does not let one match's SMS failure block delivery to the rest", async () => {
    const sms = createFakeSms(async (phone) => {
      if (phone === "+923001111111") {
        throw new Error("Twilio down");
      }
    });
    const email = createFakeEmail();
    const matches = [
      { name: "Amara", phone: "+923001111111", email: null },
      { name: "Bilal", phone: "+923002222222", email: null },
    ];

    await notifyMatches(matches, CONTEXT, sms, email);

    expect(sms.calls).toEqual(["+923001111111", "+923002222222"]);
  });

  it("does not let one match's email failure block delivery to the rest", async () => {
    const sms = createFakeSms();
    const email = createFakeEmail(async (to) => {
      if (to === "amara@example.com") {
        throw new Error("SendGrid down");
      }
    });
    const matches = [
      { name: "Amara", phone: "+923001111111", email: "amara@example.com" },
      { name: "Bilal", phone: "+923002222222", email: "bilal@example.com" },
    ];

    await notifyMatches(matches, CONTEXT, sms, email);

    expect(email.calls).toEqual(["amara@example.com", "bilal@example.com"]);
  });

  it("never rejects even when every send fails", async () => {
    const sms = createFakeSms(async () => {
      throw new Error("Twilio down");
    });
    const email = createFakeEmail(async () => {
      throw new Error("SendGrid down");
    });
    const matches = [{ name: "Amara", phone: "+923001111111", email: "amara@example.com" }];

    await expect(notifyMatches(matches, CONTEXT, sms, email)).resolves.toBeUndefined();
  });
});
