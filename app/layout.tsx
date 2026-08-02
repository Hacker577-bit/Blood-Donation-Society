import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/app/components/providers/AuthProvider";
import { SiteHeader } from "@/app/components/ui/SiteHeader";
import { SiteFooter } from "@/app/components/ui/SiteFooter";

export const metadata: Metadata = {
  title: "Lifeline Lahore",
  description: "Find blood donors near you in Lahore — fast, free, and verified with Google.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-surface-base text-ink-primary font-sans">
        <AuthProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </AuthProvider>
      </body>
    </html>
  );
}
