export interface SmsNotifier {
  send(phone: string, message: string): Promise<void>;
}

export interface EmailNotifier {
  send(input: { to: string; subject: string; body: string }): Promise<void>;
}

export interface NotifyMatch {
  name: string;
  phone: string;
  email: string | null;
}

export interface NotifyContext {
  searcherName: string;
  searcherPhone: string;
  bloodType: string;
  area: string;
}

function buildSmsMessage(context: NotifyContext): string {
  return (
    `URGENT: ${context.searcherName} (${context.searcherPhone}) needs ` +
    `${context.bloodType} blood in ${context.area}. ` +
    `Please call them directly if you are able to donate. ` +
    `Reply to this message is not monitored. – Lifeline Lahore`
  );
}

function buildEmailBody(context: NotifyContext): string {
  return (
    `Someone in your area needs ${context.bloodType} blood.\n\n` +
    `Searcher: ${context.searcherName}\n` +
    `Phone: ${context.searcherPhone}\n` +
    `Blood type needed: ${context.bloodType}\n` +
    `Location: ${context.area}\n\n` +
    `Please call them directly if you are able to help. ` +
    `Do not reply to this email.\n\n` +
    `– Lifeline Lahore`
  );
}

async function sendSafely(send: () => Promise<void>, label: string): Promise<void> {
  try {
    await send();
  } catch (err) {
    console.error(`notifyMatches: ${label} failed`, err);
  }
}

export async function notifyMatches(
  matches: NotifyMatch[],
  context: NotifyContext,
  smsNotifier: SmsNotifier,
  emailNotifier: EmailNotifier,
): Promise<void> {
  const smsMessage = buildSmsMessage(context);
  const emailBody = buildEmailBody(context);

  const sends = matches.flatMap((match) => {
    const tasks: Array<Promise<void>> = [
      sendSafely(() => smsNotifier.send(match.phone, smsMessage), `SMS to ${match.phone}`),
    ];

    if (match.email) {
      tasks.push(
        sendSafely(
          () =>
            emailNotifier.send({
              to: match.email as string,
              subject: `${context.searcherName} needs ${context.bloodType} blood in ${context.area}`,
              body: emailBody,
            }),
          `email to ${match.email}`,
        ),
      );
    }

    return tasks;
  });

  await Promise.allSettled(sends);
}
