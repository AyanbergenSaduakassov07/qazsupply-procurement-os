import { isLocale, t } from "@qazsupply/i18n";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GalleryView } from "../../../../components/gallery/gallery-view";

export const metadata: Metadata = { robots: { index: false } };

export default async function GalleryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <GalleryView
      labels={{
        title: t(locale, "gallery.title"),
        intro: t(locale, "gallery.intro"),
        buttons: t(locale, "gallery.buttons"),
        badges: t(locale, "gallery.badges"),
        states: t(locale, "gallery.states"),
        empty: t(locale, "gallery.empty"),
        emptyHint: t(locale, "gallery.emptyHint"),
        loading: t(locale, "gallery.loading"),
        errorTitle: t(locale, "gallery.errorTitle"),
        errorHint: t(locale, "gallery.errorHint"),
        kpi: t(locale, "gallery.kpi"),
        potentialSaving: t(locale, "gallery.potentialSaving"),
        probability: t(locale, "gallery.probability"),
        timeline: t(locale, "gallery.timeline"),
        timelineRecorded: t(locale, "gallery.timelineRecorded"),
        timelineConflict: t(locale, "gallery.timelineConflict"),
        finding: t(locale, "gallery.finding"),
        table: t(locale, "gallery.table"),
        tableCaption: t(locale, "gallery.tableCaption"),
        charts: t(locale, "gallery.charts"),
        chartVariance: t(locale, "gallery.chartVariance"),
        chartVarianceDesc: t(locale, "gallery.chartVarianceDesc"),
        chartConcentration: t(locale, "gallery.chartConcentration"),
        chartConcentrationDesc: t(locale, "gallery.chartConcentrationDesc"),
        chartEta: t(locale, "gallery.chartEta"),
        chartEtaDesc: t(locale, "gallery.chartEtaDesc"),
        chartTable: t(locale, "gallery.chartTable"),
        drawer: t(locale, "gallery.drawer"),
        openDrawer: t(locale, "gallery.openDrawer"),
        evidenceTitle: t(locale, "gallery.evidenceTitle"),
        method: t(locale, "gallery.method"),
        version: t(locale, "gallery.version"),
        computation: t(locale, "gallery.computation"),
        sources: t(locale, "gallery.sources"),
        file: t(locale, "gallery.file"),
        row: t(locale, "gallery.row"),
        item: t(locale, "gallery.item"),
        supplier: t(locale, "gallery.supplier"),
        qty: t(locale, "gallery.qty"),
        price: t(locale, "gallery.price"),
        date: t(locale, "gallery.date"),
        ask: t(locale, "gallery.ask"),
        askPlaceholder: t(locale, "gallery.askPlaceholder"),
        askReadOnly: t(locale, "gallery.askReadOnly"),
        palette: t(locale, "gallery.palette"),
        openPalette: t(locale, "gallery.openPalette"),
        paletteTitle: t(locale, "gallery.paletteTitle"),
        palettePlaceholder: t(locale, "gallery.palettePlaceholder"),
        paletteEmpty: t(locale, "gallery.paletteEmpty"),
        toasts: t(locale, "gallery.toasts"),
        showToast: t(locale, "gallery.showToast"),
        toastMessage: t(locale, "gallery.toastMessage"),
        confidence: t(locale, "gallery.confidence"),
        confHigh: t(locale, "gallery.confHigh"),
        confMedium: t(locale, "gallery.confMedium"),
        confLow: t(locale, "gallery.confLow"),
        notAvailable: t(locale, "common.notAvailable"),
        close: t(locale, "common.close"),
      }}
    />
  );
}
