import sgMail from "@sendgrid/mail";
import type { EmailNotifier } from "@/lib/domain/notify";

let initialized = false;

function ensureInit(): void {
  if (initialized) return;
  if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) {
    console.warn(
      "sendgrid: SENDGRID_API_KEY and SENDGRID_FROM_EMAIL not set. " +
        "Email sending will be skipped. Set these in production.",
    );
    return;
  }
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  initialized = true;
}

const getFromEmail = (): string | null =>
  process.env.SENDGRID_FROM_EMAIL ?? null;

export const sendgridEmailNotifier: EmailNotifier = {
  async send({ to, subject, body }) {
    ensureInit();

    const fromEmail = getFromEmail();
    if (!initialized || !fromEmail) {
      console.warn(`sendgrid: skipping email to ${to} (SendGrid not configured)`);
      return;
    }

    await sgMail.send({ to, from: fromEmail, subject, text: body });
  },
};
