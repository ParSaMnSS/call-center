import { UploadForm } from "./upload-form";
import { t } from "@/lib/strings";

export default function UploadPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t.uploadTitle}</h1>
        <p className="text-muted text-sm mt-1">{t.uploadHint}</p>
      </div>
      <div className="panel p-6">
        <UploadForm />
      </div>
    </div>
  );
}
