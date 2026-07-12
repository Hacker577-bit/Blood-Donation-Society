import sgMail from "@sendgrid/mail";
import type { EmailNotifier } from "@/lib/domain/notify";

if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) {
  throw new Error(
    "SENDGRID_API_KEY and SENDGRID_FROM_EMAIL must be set before using the SendGrid client.",
  );
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const fromEmail = process.env.SENDGRID_FROM_EMAIL;

export const sendgridEmailNotifier: EmailNotifier = {
  async send({ to, subject, body }) {
    await sgMail.send({ to, from: fromEmail, subject, text: body });
  },
};
