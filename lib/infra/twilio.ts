import twilio from "twilio";
import type { SmsNotifier } from "@/lib/domain/notify";

const globalForTwilio = globalThis as unknown as {
  twilioClient?: ReturnType<typeof twilio>;
};

function getTwilioClient(): ReturnType<typeof twilio> | null {
  if (globalForTwilio.twilioClient) {
    return globalForTwilio.twilioClient;
  }

  if (
    !process.env.TWILIO_ACCOUNT_SID ||
    !process.env.TWILIO_AUTH_TOKEN ||
    !process.env.TWILIO_FROM_NUMBER
  ) {
    console.warn(
      "twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER not set. " +
        "SMS sending will be skipped. Set these in production.",
    );
    return null;
  }

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  if (process.env.NODE_ENV !== "production") {
    globalForTwilio.twilioClient = client;
  }

  return client;
}

async function sendSms(to: string, body: string): Promise<void> {
  if (process.env.SKIP_SMS_NOTIFICATIONS === "true" || process.env.NODE_ENV !== "production") {
    console.log(`[DEV] SMS to ${to}: ${body}`);
    return;
  }

  const client = getTwilioClient();
  if (!client) {
    console.warn(`twilio: skipping SMS to ${to} (Twilio not configured)`);
    return;
  }

  await client.messages.create({
    to,
    from: process.env.TWILIO_FROM_NUMBER as string,
    body,
  });
}

export const twilioNotificationSender: SmsNotifier = {
  async send(phone, message) {
    await sendSms(phone, message);
  },
};
