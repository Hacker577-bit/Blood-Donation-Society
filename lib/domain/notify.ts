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
  /** Human-readable blood type label (e.g. "O-"), not the raw enum value. */
  bloodType: string;
  /** Human-readable area label (e.g. "Gulberg"). */
  area: string;
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
  const message = `${context.searcherName} (${context.searcherPhone}) needs ${context.bloodType} blood in ${context.area}. Call them directly if you're able to help.`;

  const sends = matches.flatMap((match) => {
    const tasks: Array<Promise<void>> = [
      sendSafely(() => smsNotifier.send(match.phone, message), `SMS to ${match.phone}`),
    ];

    if (match.email) {
      tasks.push(
        sendSafely(
          () =>
            emailNotifier.send({
              to: match.email as string,
              subject: "Someone needs your blood type",
              body: message,
            }),
          `email to ${match.email}`,
        ),
      );
    }

    return tasks;
  });

  await Promise.allSettled(sends);
}
