// Server only: imported by the decision PDF route handler.
import { join } from "node:path";
import { Document, Font, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";

import { fill } from "../../lib/procurement-labels";
import { dateFormatter, moneyFormatter } from "../../lib/report-model";

const FONT_DIR = join(process.cwd(), "node_modules/@ibm/plex-sans/fonts/complete/woff");
Font.register({
  family: "Plex",
  fonts: [
    { src: join(FONT_DIR, "IBMPlexSans-Regular.woff") },
    { src: join(FONT_DIR, "IBMPlexSans-SemiBold.woff"), fontWeight: 600 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const s = StyleSheet.create({
  page: { fontFamily: "Plex", fontSize: 10, color: "#101418", padding: 40 },
  h1: { fontSize: 16, fontWeight: 600, marginBottom: 6 },
  h2: { fontSize: 12, fontWeight: 600, marginTop: 14, marginBottom: 6 },
  muted: { color: "#4a5560" },
  quote: { borderLeftWidth: 2, borderLeftColor: "#cfd6db", paddingLeft: 8, marginTop: 8 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#cfd6db",
    paddingVertical: 4,
  },
  cell: { flex: 1 },
  num: { width: 120, textAlign: "right" },
});

type Alt = {
  offer_id: string;
  supplier: string;
  total_kzt: string | null;
  score: string | null;
  excluded: string | null;
};

/** The decision record as a short memo: who, what, why, and the alternatives considered. */
export async function renderDecisionPdf(input: {
  title: string;
  decision: {
    offer_id: string;
    reason: string;
    created_at: string;
    alternatives: Alt[];
    decided_by: string;
  };
  l: Record<string, string>;
  locale: string;
}): Promise<Buffer> {
  const { title, decision: d, l, locale } = input;
  const money = moneyFormatter(locale);
  const date = dateFormatter(locale);
  return renderToBuffer(
    <Document title={`${l.memo}: ${title}`} language={locale}>
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>
          {l.memo}: {title}
        </Text>
        <Text style={s.muted}>
          {fill(l.memoBy ?? "", { date: date(d.created_at), name: d.decided_by })}
        </Text>
        <View style={s.quote}>
          <Text>{d.reason}</Text>
        </View>
        <Text style={s.h2}>{l.alternatives}</Text>
        {d.alternatives.map((a) => (
          <View key={a.offer_id} style={s.row}>
            <Text style={s.cell}>
              {a.offer_id === d.offer_id ? `${l.chosen}: ` : ""}
              {a.supplier}
            </Text>
            <Text style={s.num}>
              {a.total_kzt
                ? money(Math.round(Number(a.total_kzt) * 100))
                : (l[`cmp.excluded.${a.excluded}`] ?? "—")}
            </Text>
            <Text style={s.num}>
              {a.score ? `${l["cmp.score"]}: ${Math.round(Number(a.score) * 100)}` : ""}
            </Text>
          </View>
        ))}
      </Page>
    </Document>,
  );
}
