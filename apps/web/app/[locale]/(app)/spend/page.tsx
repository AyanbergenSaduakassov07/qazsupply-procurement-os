import { isLocale, t } from "@qazsupply/i18n";
import { notFound } from "next/navigation";

import { UploadWizard } from "../../../../components/spend/upload-wizard";
import { uploadLabels } from "../../../../lib/spend-labels";

export default async function SpendUploadPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t(locale, "upload.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t(locale, "upload.intro")}</p>
      </div>
      <UploadWizard labels={uploadLabels(locale)} reviewHref={`/${locale}/spend/review`} />
    </div>
  );
}
