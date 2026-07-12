import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lifeline Lahore",
  description: "Emergency blood-donor matching for Lahore.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-surface-base text-ink-primary font-sans">
        {children}
      </body>
    </html>
  );
}
