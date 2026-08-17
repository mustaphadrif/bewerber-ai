"use client";

import { useTransition, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n/client";
import {
  signInWithPassword,
  signUpWithPassword,
  signInWithGoogle,
} from "@/lib/auth-actions";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isLogin = mode === "login";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const fullName = String(form.get("fullName") ?? "");

    startTransition(async () => {
      const result = isLogin
        ? await signInWithPassword(email, password)
        : await signUpWithPassword(email, password, fullName);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (isLogin) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setNotice(t("auth.signupNotice"));
      }
    });
  }

  function handleGoogle() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await signInWithGoogle();
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && (
          <div>
            <Label htmlFor="fullName">{t("auth.fullName")}</Label>
            <Input id="fullName" name="fullName" autoComplete="name" placeholder={t("auth.namePlaceholder")} />
          </div>
        )}
        <div>
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" placeholder={t("auth.emailPlaceholder")} />
        </div>
        <div>
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input id="password" name="password" type="password" required minLength={8} autoComplete={isLogin ? "current-password" : "new-password"} placeholder={t("auth.passwordPlaceholder")} />
        </div>

        {error && <Alert variant="error">{error}</Alert>}
        {notice && <Alert variant="success">{notice}</Alert>}

        <Button type="submit" className="w-full" size="lg" loading={pending}>
          {isLogin ? t("auth.loginButton") : t("auth.signupButton")}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.or")}</span>
        <Separator className="flex-1" />
      </div>

      <Button type="button" variant="outline" className="w-full" size="lg" onClick={handleGoogle} loading={pending}>
        <GoogleIcon />
        {t("auth.googleButton")}
      </Button>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {isLogin ? (
          <>
            {t("auth.noAccount")}{" "}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              {t("auth.registerFree")}
            </Link>
          </>
        ) : (
          <>
            {t("auth.hasAccount")}{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              {t("auth.loginLink")}
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.81z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.11A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56V6.61H1.28a12 12 0 0 0 0 10.78l4.01-3.11z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.28 6.61l4.01 3.11C6.23 6.88 8.88 4.77 12 4.77z" />
    </svg>
  );
}
