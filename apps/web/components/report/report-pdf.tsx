// Server only: imported by the PDF route handler, never by a client component.
import { join } from "node:path";
import { Document, Font, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";

import {
  buildReportModel,
  dateFormatter,
  fill,
  type ModelFinding,
  moneyFormatter,
  percent,
  toTiyn,
} from "../../lib/report-model";
import type { NarrativeLabels, NarrativeReport } from "./report-narrative";

export interface PdfLabels extends NarrativeLabels {
  page: string;
  footer: string;
  evidence: string;
  howToCheck: string;
}

// IBM Plex Sans (OFL-1.1, unmodified): the product font, with full Kazakh Cyrillic and tabular
// figures (docs/design/font-coverage.md). Read from the installed package at runtime.
// ponytail: resolved from the app's working directory; a standalone deploy must trace these files.
const FONT_DIR = join(process.cwd(), "node_modules/@ibm/plex-sans/fonts/complete/woff");
Font.register({
  family: "Plex",
  fonts: [
    { src: join(FONT_DIR, "IBMPlexSans-Regular.woff") },
    { src: join(FONT_DIR, "IBMPlexSans-SemiBold.woff"), fontWeight: 600 },
  ],
});
// Never hyphenate names, codes or amounts.
Font.registerHyphenationCallback((word) => [word]);

const ink = "#101418";
const muted = "#4a5560";
const line = "#cfd6db";
const s = StyleSheet.create({
  page: { fontFamily: "Plex", fontSize: 10, color: ink, padding: 40, paddingBottom: 64 },
  h1: { fontSize: 16, fontWeight: 600, marginBottom: 4 },
  h2: { fontSize: 12, fontWeight: 600, marginTop: 16, marginBottom: 6 },
  muted: { color: muted },
  draft: { color: "#c23b32", fontWeight: 600, marginTop: 4 },
  headline: { borderWidth: 1, borderColor: line, borderRadius: 6, padding: 12, marginTop: 12 },
  big: { fontSize: 22, fontWeight: 600, marginVertical: 2 },
  row: { borderBottomWidth: 1, borderBottomColor: line, paddingVertical: 6, flexDirection: "row" },
  rank: { width: 18, color: muted },
  body: { flex: 1, paddingRight: 8 },
  amount: { width: 110, textAlign: "right", fontWeight: 600 },
  todoAmount: { width: 190, textAlign: "right", fontWeight: 600 },
  evidence: { fontSize: 7, color: muted, marginTop: 2 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 7,
    color: muted,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

export async function renderReportPdf({
  report,
  findings,
  labels,
  locale,
}: {
  report: NarrativeReport;
  findings: ModelFinding[];
  labels: PdfLabels;
  locale: string;
}): Promise<Buffer> {
  const model = buildReportModel(findings);
  const money = moneyFormatter(locale);
  const date = dateFormatter(locale);
  const reviewer = report.approved_by_name ?? report.released_by_name;
  const released = report.status === "released" && report.released_at;
  const footer = fill(labels.footer, {
    id: report.id,
    name: reviewer ?? "QazSupply",
    date: released ? date(report.released_at as string) : labels.notReleased,
  });

  const doc = (
    <Document title={report.title} author="QazSupply" language={locale}>
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>{report.title}</Text>
        <Text style={s.muted}>
          {fill(labels.period, { start: date(report.period_start), end: date(report.period_end) })}
        </Text>
        {released ? (
          <Text style={s.muted}>
            {reviewer
              ? fill(labels.reviewedBy, {
                  name: reviewer,
                  date: date(report.released_at as string),
                })
              : fill(labels.reviewedByUnknown, { date: date(report.released_at as string) })}
          </Text>
        ) : (
          <Text style={s.draft}>{labels.notReleased}</Text>
        )}

        <View style={s.headline}>
          <Text style={s.muted}>{labels.headline}</Text>
          <Text style={s.big}>{money(model.totalTiyn)}</Text>
          <Text style={s.muted}>{fill(labels.headlineHint, { count: model.ranked.length })}</Text>
          <Text style={s.evidence}>
            {labels.evidence}: {labels.headlineEvidence} ({report.id})
          </Text>
        </View>

        <Text style={s.h2}>{labels.top}</Text>
        {model.ranked.map((f, i) => (
          <View key={f.id} style={s.row} wrap={false}>
            <Text style={s.rank}>{i + 1}.</Text>
            <View style={s.body}>
              <Text style={{ fontWeight: 600 }}>
                {labels.types[f.type] ?? f.type}: {f.item_name ?? ""}
              </Text>
              {f.supplier_name ? <Text style={s.muted}>{f.supplier_name}</Text> : null}
              <Text style={s.muted}>
                {fill(labels.confidence, { value: percent(f.confidence) })}
              </Text>
              {labels.actions[f.type] ? (
                <Text>
                  {labels.action}:{" "}
                  {fill(labels.actions[f.type] ?? "", {
                    item: f.item_name ?? "",
                    supplier: f.supplier_name ?? "",
                  })}
                </Text>
              ) : null}
              {f.decision === "edit" && f.decision_note ? (
                <Text style={s.muted}>
                  {labels.note}: {f.decision_note}
                </Text>
              ) : null}
              <Text style={s.evidence}>
                {labels.evidence}: {f.evidence_id ?? "—"}
                {f.decided_by_name ? ` · ${labels.reviewed}: ${f.decided_by_name}` : ""}
              </Text>
            </View>
            <Text style={s.amount}>{money(toTiyn(f.saving_estimate))}</Text>
          </View>
        ))}

        <Text style={s.h2}>{labels.todo}</Text>
        {model.byType.map((t) => (
          <View key={t.type} style={s.row} wrap={false}>
            <Text style={s.body}>{labels.todoLabels[t.type] ?? t.type}</Text>
            <Text style={s.todoAmount}>
              {fill(labels.todoLine, { count: t.count, amount: money(t.tiyn) })}
            </Text>
          </View>
        ))}

        <Text style={[s.muted, { marginTop: 16 }]}>{labels.howToCheck}</Text>

        <View style={s.footer} fixed>
          <Text>{footer}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              fill(labels.page, { page: pageNumber, pages: totalPages })
            }
          />
        </View>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
