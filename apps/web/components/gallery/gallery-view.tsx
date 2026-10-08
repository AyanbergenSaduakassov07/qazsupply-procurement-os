"use client";

import { AskBar } from "@qazsupply/ui/components/ask-bar";
import { Badge } from "@qazsupply/ui/components/badge";
import { Button } from "@qazsupply/ui/components/button";
import { Card, CardBody, CardHeader, CardTitle } from "@qazsupply/ui/components/card";
import {
  ConcentrationPareto,
  EtaBandChart,
  PriceVariancePlot,
} from "@qazsupply/ui/components/charts";
import { CommandPalette } from "@qazsupply/ui/components/command-palette";
import { type Column, DataTable } from "@qazsupply/ui/components/data-table";
import { EvidenceDrawer, type EvidenceDrawerProps } from "@qazsupply/ui/components/evidence-drawer";
import { FindingCard } from "@qazsupply/ui/components/finding-card";
import { Kpi } from "@qazsupply/ui/components/kpi";
import { ProbabilityBar } from "@qazsupply/ui/components/probability-bar";
import { EmptyState, ErrorState, LoadingState } from "@qazsupply/ui/components/states";
import { Timeline, type TimelineItem } from "@qazsupply/ui/components/timeline";
import { toast } from "@qazsupply/ui/components/toast";
import { useState } from "react";

type Labels = {
  title: string;
  intro: string;
  buttons: string;
  badges: string;
  states: string;
  empty: string;
  emptyHint: string;
  loading: string;
  errorTitle: string;
  errorHint: string;
  kpi: string;
  potentialSaving: string;
  probability: string;
  timeline: string;
  timelineRecorded: string;
  timelineConflict: string;
  finding: string;
  table: string;
  tableCaption: string;
  charts: string;
  chartVariance: string;
  chartVarianceDesc: string;
  chartConcentration: string;
  chartConcentrationDesc: string;
  chartEta: string;
  chartEtaDesc: string;
  chartTable: string;
  drawer: string;
  openDrawer: string;
  evidenceTitle: string;
  method: string;
  version: string;
  computation: string;
  sources: string;
  file: string;
  row: string;
  item: string;
  supplier: string;
  qty: string;
  price: string;
  date: string;
  ask: string;
  askPlaceholder: string;
  askReadOnly: string;
  palette: string;
  openPalette: string;
  paletteTitle: string;
  palettePlaceholder: string;
  paletteEmpty: string;
  toasts: string;
  showToast: string;
  toastMessage: string;
  confidence: string;
  confHigh: string;
  confMedium: string;
  confLow: string;
  notAvailable: string;
  close: string;
};

const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "KZT",
  maximumFractionDigits: 0,
});

const SUPPLIERS = [
  { id: "s1", name: "ТОО «Астана-Снаб»", bin: "123456789012", spend: 42_500_000, items: 312 },
  { id: "s2", name: "ТОО «КазПромТорг»", bin: "987654321098", spend: 18_900_000, items: 140 },
  { id: "s3", name: "ИП Серіков А.", bin: "010203040506", spend: 7_400_000, items: 58 },
  { id: "s4", name: "ТОО «Ресурс Плюс»", bin: "111222333444", spend: 3_100_000, items: 21 },
];
const SUPPLIER_TOTAL = SUPPLIERS.reduce((sum, s) => sum + s.spend, 0);

const VARIANCE = [
  { label: "Кабель ВВГ 3х2.5", low: 720, high: 1180, point: 1140 },
  { label: "Насос ЦНС 38-220", low: 410_000, high: 512_000, point: 498_000 },
  { label: "Болт М16х60", low: 90, high: 140, point: 96 },
  { label: "Масло И-40А", low: 1_050, high: 1_390, point: 1_320 },
];

const CONCENTRATION = (() => {
  let cumulative = 0;
  return [...SUPPLIERS]
    .sort((a, b) => b.spend - a.spend)
    .map((s) => {
      cumulative += s.spend / SUPPLIER_TOTAL;
      return {
        label: s.name.slice(0, 14),
        spend: Math.round(s.spend / 1_000_000),
        cumulative: Math.round(cumulative * 100),
      };
    });
})();

const ETA = [
  { day: "Д−2", p10: 0, p50: 0, p90: 1 },
  { day: "Д−1", p10: 2, p50: 6, p90: 14 },
  { day: "Д+0", p10: 20, p50: 38, p90: 60 },
  { day: "Д+1", p10: 55, p50: 78, p90: 92 },
  { day: "Д+2", p10: 88, p50: 96, p90: 99 },
];

export function GalleryView({ labels }: { labels: Labels }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const evidence: EvidenceDrawerProps["evidence"] = {
    id: "ev-8f31c0",
    computationId: "price_variance@2026-10-01",
    method: "SQL window function over purchase_lines",
    codeVersion: "services.analyze.price_variance@a91c2",
    confidence: labels.confHigh,
    formula:
      "Median unit price per item over the period; the line price divided by the median gives the variance.",
    result: `+18% · ${money.format(2_140_000)}`,
    sources: [
      {
        id: "p1",
        fileName: "spend_2026_H1.xlsx",
        sourceRow: 214,
        itemText: "Кабель ВВГ 3х2.5",
        supplierText: "ТОО «Астана-Снаб»",
        quantity: "120",
        unitPrice: "1 140,00",
        currency: "KZT",
        purchasedOn: "08.04.2026",
      },
      {
        id: "p2",
        fileName: "spend_2026_H1.xlsx",
        sourceRow: 118,
        itemText: "Кабель ВВГ 3х2.5",
        supplierText: "ТОО «КазПромТорг»",
        quantity: "80",
        unitPrice: "720,00",
        currency: "KZT",
        purchasedOn: "02.03.2026",
      },
    ],
  };

  const confidence = {
    high: labels.confHigh,
    medium: labels.confMedium,
    low: labels.confLow,
  } as const;
  const timeline: TimelineItem[] = [
    {
      id: "t1",
      title: "Загружен инвойс № 4471",
      occurredAt: "01.10.2026 09:12",
      recordedAt: "01.10.2026 09:14",
      source: "manual",
      confidence: "medium",
    },
    {
      id: "t2",
      title: "Отгрузка из Алматы",
      occurredAt: "02.10.2026 18:00",
      recordedAt: "02.10.2026 18:02",
      source: "carrier:KTZ",
      confidence: "high",
    },
    {
      id: "t3",
      title: "Отгрузка из Алматы",
      occurredAt: "02.10.2026 20:00",
      source: "manual",
      confidence: "low",
      conflicting: true,
    },
  ];

  const supplierColumns: Column<(typeof SUPPLIERS)[number]>[] = [
    { id: "name", header: labels.supplier, cell: (row) => row.name, sortValue: (row) => row.name },
    {
      id: "bin",
      header: "BIN",
      cell: (row) => row.bin,
      sortValue: (row) => row.bin,
    },
    {
      id: "spend",
      header: labels.potentialSaving,
      numeric: true,
      cell: (row) => money.format(row.spend),
      sortValue: (row) => row.spend,
    },
    {
      id: "items",
      header: labels.item,
      numeric: true,
      cell: (row) => row.items,
      sortValue: (row) => row.items,
    },
  ];

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold text-ink">{labels.title}</h1>
        <p className="mt-1 text-sm text-muted">{labels.intro}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{labels.buttons}</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-wrap items-center gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button disabled>Disabled · {labels.notAvailable}</Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{labels.badges}</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-wrap items-center gap-2">
          <Badge>neutral</Badge>
          <Badge variant="accent">accent</Badge>
          <Badge variant="ok">{labels.confHigh}</Badge>
          <Badge variant="gold">{labels.confMedium}</Badge>
          <Badge variant="risk">{labels.confLow}</Badge>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{labels.states}</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-4 md:grid-cols-3">
          <EmptyState title={labels.empty} message={labels.emptyHint} />
          <div className="rounded-[var(--qs-card-radius)] border border-line bg-surface px-4">
            <LoadingState label={labels.loading} />
          </div>
          <ErrorState title={labels.errorTitle} message={labels.errorHint} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{labels.kpi}</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-6 sm:grid-cols-2">
          <Kpi label={labels.potentialSaving} value={2_140_000} format={(v) => money.format(v)} />
          <Kpi label={labels.supplier} value={4_120} hint="KZT" />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{labels.probability}</CardTitle>
        </CardHeader>
        <CardBody>
          <ProbabilityBar
            min={0}
            max={4}
            p10={1}
            p50={2.4}
            p90={3.6}
            promiseAt={3}
            probabilityByPromise={0.72}
            labels={{
              p10: "p10",
              p50: "p50",
              p90: "p90",
              promise: "promise",
              probability: "P(≤ promise)",
            }}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{labels.timeline}</CardTitle>
        </CardHeader>
        <CardBody>
          <Timeline
            items={timeline}
            labels={{
              confidence,
              recorded: labels.timelineRecorded,
              conflict: labels.timelineConflict,
            }}
          />
        </CardBody>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-ink">{labels.finding}</h2>
        <FindingCard
          type="price_variance"
          title="Кабель ВВГ 3х2.5: цена выше медианы на 58%"
          saving={money.format(2_140_000)}
          savingLabel={labels.potentialSaving}
          confidenceLabel={`${labels.confidence}: ${labels.confHigh}`}
          evidenceLabel={labels.openDrawer}
          onOpenEvidence={() => setDrawerOpen(true)}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{labels.table}</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          <DataTable
            columns={supplierColumns}
            rows={SUPPLIERS}
            getRowId={(row) => row.id}
            caption={labels.tableCaption}
            emptyLabel={labels.empty}
            initialSort={{ id: "spend", direction: "desc" }}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{labels.charts}</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-8">
          <PriceVariancePlot
            data={VARIANCE}
            title={labels.chartVariance}
            description={labels.chartVarianceDesc}
            table={{
              label: labels.chartTable,
              headers: [labels.item, "min", "max", labels.price],
              rows: VARIANCE.map((d) => [d.label, d.low, d.high, d.point]),
            }}
          />
          <ConcentrationPareto
            data={CONCENTRATION}
            title={labels.chartConcentration}
            description={labels.chartConcentrationDesc}
            table={{
              label: labels.chartTable,
              headers: [labels.supplier, "spend (M KZT)", "cumulative %"],
              rows: CONCENTRATION.map((d) => [d.label, d.spend, d.cumulative]),
            }}
          />
          <EtaBandChart
            data={ETA}
            promiseDay="Д+1"
            promiseLabel="promise"
            title={labels.chartEta}
            description={labels.chartEtaDesc}
            table={{
              label: labels.chartTable,
              headers: ["day", "p10", "p50", "p90"],
              rows: ETA.map((d) => [d.day, d.p10, d.p50, d.p90]),
            }}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{labels.ask}</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <AskBar
            labels={{
              placeholder: labels.askPlaceholder,
              submit: labels.ask,
              disabledReason: labels.notAvailable,
              readOnly: labels.askReadOnly,
            }}
          />
          <AskBar
            disabled
            labels={{
              placeholder: labels.askPlaceholder,
              submit: labels.ask,
              disabledReason: labels.notAvailable,
              readOnly: labels.askReadOnly,
            }}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{labels.palette}</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setPaletteOpen(true)}>
            {labels.openPalette}
          </Button>
          <Button variant="secondary" onClick={() => toast.success(labels.toastMessage)}>
            {labels.showToast}
          </Button>
          <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
            {labels.openDrawer}
          </Button>
        </CardBody>
      </Card>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        labels={{
          title: labels.paletteTitle,
          placeholder: labels.palettePlaceholder,
          empty: labels.paletteEmpty,
        }}
        items={[
          {
            id: "c1",
            label: labels.openDrawer,
            group: labels.drawer,
            onSelect: () => setDrawerOpen(true),
          },
          {
            id: "c2",
            label: labels.showToast,
            group: labels.toasts,
            onSelect: () => toast(labels.toastMessage),
          },
          { id: "c3", label: labels.notAvailable, group: labels.table, disabled: true },
        ]}
      />

      <EvidenceDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        evidence={evidence}
        labels={{
          title: labels.evidenceTitle,
          method: labels.method,
          confidence: labels.confidence,
          version: labels.version,
          computation: labels.computation,
          sources: labels.sources,
          empty: labels.empty,
          close: labels.close,
          file: labels.file,
          row: labels.row,
          item: labels.item,
          supplier: labels.supplier,
          qty: labels.qty,
          price: labels.price,
          date: labels.date,
        }}
      />
    </div>
  );
}
