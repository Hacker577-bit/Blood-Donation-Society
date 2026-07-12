import twilio from "twilio";
import type { OtpSender } from "@/lib/domain/otp";
import type { SmsNotifier } from "@/lib/domain/notify";

const globalForTwilio = globalThis as unknown as {
  twilioClient?: ReturnType<typeof twilio>;
};

function createTwilioClient(): ReturnType<typeof twilio> {
  if (
    !process.env.TWILIO_ACCOUNT_SID ||
    !process.env.TWILIO_AUTH_TOKEN ||
    !process.env.TWILIO_FROM_NUMBER
  ) {
    throw new Error(
      "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER must be set before using the Twilio client.",
    );
  }

  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

export const twilioClient = globalForTwilio.twilioClient ?? createTwilioClient();

if (process.env.NODE_ENV !== "production") {
  globalForTwilio.twilioClient = twilioClient;
}

export const twilioOtpSender: OtpSender = {
  async send(phone, code) {
    await twilioClient.messages.create({
      to: phone,
      from: process.env.TWILIO_FROM_NUMBER,
      body: `Your Lifeline Lahore verification code is ${code}. It expires in 5 minutes.`,
    });
  },
};

export const twilioNotificationSender: SmsNotifier = {
  async send(phone, message) {
    await twilioClient.messages.create({
      to: phone,
      from: process.env.TWILIO_FROM_NUMBER,
      body: message,
    });
  },
};
