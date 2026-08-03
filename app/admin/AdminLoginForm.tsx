"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/components/ui/Button";
import { InputField } from "@/app/components/ui/InputField";
import { adminLogin } from "@/app/actions/admin";

export function AdminLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!password) {
      setError("Enter the admin password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await adminLogin(password);
      if (!result.ok) {
        setError(result.error ?? "Sign-in failed.");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <InputField
        id="admin-password"
        label="Admin password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={error ?? undefined}
        autoComplete="current-password"
      />
      <Button loading={isSubmitting} loadingText="Signing in…">
        Sign in
      </Button>
    </form>
  );
}
