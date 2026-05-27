import { UploadForm } from "./upload-form";
import { FadeIn } from "@/components/motion";
import { t } from "@/lib/strings";

export default function UploadPage() {
  return (
    <FadeIn className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-fg">{t.uploadTitle}</h1>
        <p className="text-muted text-sm mt-1.5">{t.uploadHint}</p>
      </div>
      <UploadForm />
    </FadeIn>
  );
}
