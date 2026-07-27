import twilio from "twilio";
import type { OtpSender } from "@/lib/domain/otp";
import type { SmsNotifier } from "@/lib/domain/notify";

const globalForTwilio = globalThis as unknown as {
  twilioClient?: ReturnType<typeof twilio>;
};

function getTwilioClient(): ReturnType<typeof twilio> {
  if (globalForTwilio.twilioClient) {
    return globalForTwilio.twilioClient;
  }

  if (
    !process.env.TWILIO_ACCOUNT_SID ||
    !process.env.TWILIO_AUTH_TOKEN ||
    !process.env.TWILIO_FROM_NUMBER
  ) {
    throw new Error(
      "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER must be set before using the Twilio client.",
    );
  }

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  if (process.env.NODE_ENV !== "production") {
    globalForTwilio.twilioClient = client;
  }

  return client;
}

export const twilioOtpSender: OtpSender = {
  async send(phone, code) {
    if (process.env.SKIP_OTP_VERIFICATION === "true") {
      console.log(`[DEV] OTP for ${phone}: ${code}`);
      return;
    }

    const client = getTwilioClient();
    await client.messages.create({
      to: phone,
      from: process.env.TWILIO_FROM_NUMBER,
      body: `Your Lifeline Lahore verification code is ${code}. It expires in 5 minutes.`,
    });
  },
};

export const twilioNotificationSender: SmsNotifier = {
  async send(phone, message) {
    if (process.env.SKIP_OTP_VERIFICATION === "true") {
      console.log(`[DEV] Notification to ${phone}: ${message}`);
      return;
    }

    const client = getTwilioClient();
    await client.messages.create({
      to: phone,
      from: process.env.TWILIO_FROM_NUMBER,
      body: message,
    });
  },
};