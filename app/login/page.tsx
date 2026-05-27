import { LoginForm } from "./login-form";
import { FadeIn } from "@/components/motion";
import { t } from "@/lib/strings";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-bg">
      <FadeIn className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-fg text-white font-bold text-xl mb-4">
            ت
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{t.appName}</h1>
          <p className="text-muted text-sm mt-1.5">{t.loginSubtitle}</p>
        </div>
        <div className="panel p-6">
          <LoginForm />
        </div>
      </FadeIn>
    </div>
  );
}
