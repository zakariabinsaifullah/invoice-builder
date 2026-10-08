import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { InvoiceData, Party } from "@shared/invoice";
import { computeTotals, formatMinor, lineAmountMinor } from "@/lib/money";
import { formatDate } from "@/lib/dates";

// Mirrors InvoiceDocument (HTML). Sizes are the HTML px values × 0.75 (A4: 794px ↔ 595pt).
let fontsRegistered = false;

/** Register the PDF fonts once. `base` is a URL (browser) or directory path (Node). */
export function registerPdfFonts(base = "/fonts/") {
  if (fontsRegistered) return;
  fontsRegistered = true;
  Font.register({
    family: "JetBrains Mono",
    fonts: [
      { src: `${base}JetBrainsMono-Regular.ttf`, fontWeight: 400 },
      { src: `${base}JetBrainsMono-Medium.ttf`, fontWeight: 500 },
      { src: `${base}JetBrainsMono-SemiBold.ttf`, fontWeight: 600 },
      { src: `${base}JetBrainsMono-Bold.ttf`, fontWeight: 700 },
    ],
  });
  // Fallbacks for glyphs JetBrains Mono lacks (₹ ₩ ₦…, Bengali, Devanagari, Arabic).
  // Registration is free; a family's files are only fetched when a page lists it.
  for (const f of FALLBACKS) {
    Font.register({
      family: f.family,
      fonts: [
        { src: `${base}${f.file}-400.woff`, fontWeight: 400 },
        { src: `${base}${f.file}-700.woff`, fontWeight: 700 },
      ],
    });
  }
  // Never hyphenate words.
  Font.registerHyphenationCallback((word) => [word]);
}

const FALLBACKS = [
  { family: "Noto Sans", file: "NotoSans-LatinExt", test: /[\u0100-\u024F\u1E00-\u1EFF\u20A0-\u20CF]/ },
  { family: "Noto Sans Bengali", file: "NotoSansBengali", test: /[\u0980-\u09FF]/ },
  { family: "Noto Sans Devanagari", file: "NotoSansDevanagari", test: /[\u0900-\u097F]/ },
  { family: "Noto Sans Arabic", file: "NotoSansArabic", test: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/ },
];

/** Primary font plus only the fallbacks this invoice's text actually needs. */
function fontStack(invoice: InvoiceData): string[] {
  const text = JSON.stringify({ ...invoice, style: null }) + formatMinor(123456, invoice.currency);
  return ["JetBrains Mono", ...FALLBACKS.filter((f) => f.test.test(text)).map((f) => f.family)];
}

const c = {
  s900: "#1c1917",
  s800: "#292524",
  s700: "#44403c",
  s600: "#57534e",
  s500: "#78716c",
  s400: "#a8a29e",
  s300: "#d6d3d1",
  s200: "#e7e5e4",
  s100: "#f5f5f4",
  accent: "#059669",
};

const s = StyleSheet.create({
  page: { fontFamily: "JetBrains Mono", fontSize: 8.6, color: c.s700, paddingHorizontal: 42, paddingTop: 42, paddingBottom: 56 },
  row: { flexDirection: "row" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logo: { maxHeight: 42, maxWidth: 150, objectFit: "contain", marginBottom: 9 },
  title: { fontSize: 21, fontWeight: 700, color: c.s900, lineHeight: 1 },
  number: { marginTop: 6, color: c.s500 },
  metaLabel: { color: c.s400, textAlign: "right", marginRight: 12 },
  metaValue: { color: c.s800, textAlign: "right" },
  parties: { flexDirection: "row", marginTop: 30, paddingTop: 18, borderTopWidth: 0.75, borderTopColor: c.s200 },
  party: { flex: 1, paddingRight: 15 },
  label: { fontSize: 8.25, color: c.s400 },
  partyName: { marginTop: 4, fontSize: 9.75, fontWeight: 600, color: c.s900 },
  muted: { color: c.s500 },
  thead: { flexDirection: "row", marginTop: 30, paddingBottom: 6, borderBottomWidth: 0.75, borderBottomColor: c.s300 },
  th: { fontSize: 8.25, color: c.s400 },
  tr: { flexDirection: "row", paddingVertical: 7, borderBottomWidth: 0.75, borderBottomColor: c.s100 },
  cNum: { width: 24, color: c.s300 },
  cDesc: { flex: 1, paddingRight: 12, color: c.s800 },
  cQty: { width: 48, textAlign: "right" },
  cRate: { width: 84, textAlign: "right" },
  cAmt: { width: 96, textAlign: "right", color: c.s900 },
  totals: { marginTop: 18, marginLeft: "auto", width: 216 },
  totalLine: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  grand: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 4, paddingTop: 8, borderTopWidth: 0.75, borderTopColor: c.s300 },
  grandValue: { fontSize: 12.75, fontWeight: 700, color: c.accent, lineHeight: 1.2 },
  sections: { flexDirection: "row", flexWrap: "wrap", marginTop: 36 },
  section: { width: "50%", paddingRight: 15, marginBottom: 18 },
  // lineHeight lives on `body`, not the page: a `render` text that inherits lineHeight is silently dropped by react-pdf.
  // fontSize repeated here so the unitless lineHeight resolves against 8.6pt, not the 18pt default.
  body: { fontSize: 8.6, lineHeight: 1.6 },
  footer: { position: "absolute", bottom: 24, fontSize: 7.5, color: c.s400 },
});

function PartyBlock({ label, party }: { label: string; party: Party }) {
  return (
    <View style={s.party}>
      <Text style={s.label}>// {label}</Text>
      <Text style={s.partyName}>{party.name || " "}</Text>
      <View style={{ marginTop: 3 }}>
        {party.address ? <Text style={s.muted}>{party.address}</Text> : null}
        {party.email ? <Text style={s.muted}>{party.email}</Text> : null}
        {party.phone ? <Text style={s.muted}>{party.phone}</Text> : null}
        {party.taxId ? (
          <Text style={s.muted}>
            <Text style={{ color: c.s400 }}>tax_id: </Text>
            {party.taxId}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function TotalLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.totalLine}>
      <Text style={s.muted}>{label}</Text>
      <Text style={{ color: c.s800 }}>{value}</Text>
    </View>
  );
}

export function InvoicePdf({ invoice }: { invoice: InvoiceData }) {
  const t = computeTotals(invoice);
  const money = (minor: number) => formatMinor(minor, invoice.currency, t.digits);
  const items = invoice.items.filter((i) => i.description || i.rate || i.quantity !== 1);
  const sections = (
    [
      ["payment", invoice.paymentInfo],
      ["notes", invoice.notes],
      ["terms", invoice.terms],
    ] as const
  ).filter(([, text]) => text.trim());

  return (
    <Document
      title={`Invoice ${invoice.number}`}
      author={invoice.from.name || undefined}
      subject={invoice.to.name ? `Invoice for ${invoice.to.name}` : undefined}
      creator="Invoice Builder · tinytools.work"
      producer="Invoice Builder · tinytools.work"
    >
      <Page size="A4" style={[s.page, { fontFamily: fontStack(invoice) }]}>
        <View style={s.body}>
        <View style={s.header}>
          <View>
            {invoice.style.logo ? <Image src={invoice.style.logo} style={s.logo} /> : null}
            <Text style={s.title}>
              INVOICE<Text style={{ color: c.accent }}>_</Text>
            </Text>
            <Text style={s.number}>#{invoice.number}</Text>
          </View>
          <View style={s.row}>
            <View>
              <Text style={s.metaLabel}>issued</Text>
              <Text style={s.metaLabel}>due</Text>
              <Text style={s.metaLabel}>amount_due</Text>
            </View>
            <View>
              <Text style={s.metaValue}>{formatDate(invoice.issueDate)}</Text>
              <Text style={s.metaValue}>{formatDate(invoice.dueDate)}</Text>
              <Text style={[s.metaValue, { color: c.accent, fontWeight: 600 }]}>{money(t.total)}</Text>
            </View>
          </View>
        </View>

        <View style={s.parties}>
          <PartyBlock label="from" party={invoice.from} />
          <PartyBlock label="bill_to" party={invoice.to} />
        </View>

        {/* Header is fixed inside the table view, so it repeats only on pages the item rows reach. */}
        <View>
        <View style={s.thead} fixed>
          <Text style={[s.th, { width: 24 }]}>#</Text>
          <Text style={[s.th, { flex: 1 }]}>description</Text>
          <Text style={[s.th, s.cQty]}>qty</Text>
          <Text style={[s.th, s.cRate]}>rate</Text>
          <Text style={[s.th, s.cAmt, { color: c.s400 }]}>amount</Text>
        </View>
        {items.map((item, n) => (
          <View key={item.id} style={s.tr} wrap={false}>
            <Text style={s.cNum}>{String(n + 1).padStart(2, "0")}</Text>
            <Text style={s.cDesc}>{item.description}</Text>
            <Text style={s.cQty}>{item.quantity}</Text>
            <Text style={s.cRate}>{money(Math.round(item.rate * 10 ** t.digits))}</Text>
            <Text style={s.cAmt}>{money(lineAmountMinor(item, t.digits))}</Text>
          </View>
        ))}
        </View>

        <View style={s.totals} wrap={false}>
          <TotalLine label="subtotal" value={money(t.subtotal)} />
          {t.discount > 0 && (
            <TotalLine
              label={invoice.discount.type === "percent" ? `discount (${invoice.discount.value}%)` : "discount"}
              value={`−${money(t.discount)}`}
            />
          )}
          {invoice.taxRate > 0 && <TotalLine label={`tax (${invoice.taxRate}%)`} value={money(t.tax)} />}
          {t.shipping > 0 && <TotalLine label="shipping" value={money(t.shipping)} />}
          <View style={s.grand}>
            <Text style={s.muted}>
              total <Text style={{ color: c.s400 }}>{invoice.currency}</Text>
            </Text>
            <Text style={s.grandValue}>{money(t.total)}</Text>
          </View>
        </View>

        {sections.length > 0 && (
          <View style={s.sections}>
            {sections.map(([label, text]) => (
              <View key={label} style={s.section} wrap={false}>
                <Text style={s.label}>// {label}</Text>
                <Text style={{ marginTop: 3, color: c.s600 }}>{text}</Text>
              </View>
            ))}
          </View>
        )}

        </View>

        {/* Two separate fixed nodes: a dynamic `render` Text inside a flex row makes react-pdf drop the whole row. */}
        <Text style={[s.footer, { left: 42 }]} fixed>
          {invoice.from.name ? `${invoice.from.name} · ` : ""}#{invoice.number}
        </Text>
        <Text
          style={[s.footer, { right: 42, textAlign: "right" }]}
          fixed
          render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`}
        />
      </Page>
    </Document>
  );
}
