import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { InvoiceData, Party } from "@shared/invoice";
import { computeTotals, formatMinor, lineAmountMinor } from "@shared/money";
import { DEFAULT_ACCENT } from "@shared/constants";
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
  Font.register({
    family: "Geist",
    fonts: [
      { src: `${base}Geist-Regular.ttf`, fontWeight: 400 },
      { src: `${base}Geist-Medium.ttf`, fontWeight: 500 },
      { src: `${base}Geist-SemiBold.ttf`, fontWeight: 600 },
      { src: `${base}Geist-Bold.ttf`, fontWeight: 700 },
    ],
  });
  // Fallbacks for glyphs the primary fonts lack (₹ ₩ ₦…, Bengali, Devanagari, Arabic).
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
  const primary = invoice.style.layout === "minimal" ? "Geist" : "JetBrains Mono";
  return [primary, ...FALLBACKS.filter((f) => f.test.test(text)).map((f) => f.family)];
}

/** Stored logos are same-origin paths; the PDF renderer fetches with an absolute URL. */
const absoluteUrl = (src: string) => (src.startsWith("/") && typeof location !== "undefined" ? location.origin + src : src);

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
  s50: "#fafaf9",
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
  grandValue: { fontSize: 12.75, fontWeight: 700, lineHeight: 1.2 },
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

type BodyProps = {
  invoice: InvoiceData;
  t: ReturnType<typeof computeTotals>;
  money: (minor: number) => string;
  items: InvoiceData["items"];
  sections: (readonly [string, string])[];
  accent: string;
};

function MonoBody({ invoice, t, money, items, sections, accent }: BodyProps) {
  return (
    <View style={s.body}>
      <View style={s.header}>
        <View>
          {invoice.style.logo ? <Image src={absoluteUrl(invoice.style.logo)} style={s.logo} /> : null}
          <Text style={s.title}>
            INVOICE<Text style={{ color: accent }}>_</Text>
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
            <Text style={[s.metaValue, { color: accent, fontWeight: 600 }]}>{money(t.total)}</Text>
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
          <Text style={[s.grandValue, { color: accent }]}>{money(t.total)}</Text>
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
  );
}

// Minimal layout (HTML px × 0.75)
const m = StyleSheet.create({
  body: { fontSize: 9, lineHeight: 1.55 },
  label: { fontSize: 7.5, fontWeight: 600, letterSpacing: 0.9, color: c.s400, textTransform: "uppercase" },
  box: { flex: 1, backgroundColor: c.s50, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 12 },
  boxValue: { marginTop: 2, fontSize: 10.5, fontWeight: 600, color: c.s900 },
  partyName: { marginTop: 6, fontSize: 10.5, fontWeight: 600, color: c.s900 },
  thead: { flexDirection: "row", marginTop: 30, backgroundColor: c.s50, borderRadius: 4, paddingVertical: 7 },
  tr: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 0.75, borderBottomColor: c.s100 },
  cDesc: { flex: 1, paddingHorizontal: 9, color: c.s800 },
  cQty: { width: 48, textAlign: "right" },
  cRate: { width: 84, textAlign: "right" },
  cAmt: { width: 96, textAlign: "right", paddingRight: 9, fontWeight: 500, color: c.s900 },
});

function MinimalBody({ invoice, t, money, items, sections, accent }: BodyProps) {
  const sectionTitle = (k: string) => (k === "payment" ? "Payment details" : k[0].toUpperCase() + k.slice(1));
  return (
    <View style={m.body}>
      <View style={s.header}>
        <View>
          {invoice.style.logo ? (
            <Image src={absoluteUrl(invoice.style.logo)} style={s.logo} />
          ) : (
            <Text style={{ fontSize: 13.5, fontWeight: 600, color: c.s900 }}>{invoice.from.name}</Text>
          )}
        </View>
        <View>
          <Text style={{ fontSize: 22.5, fontWeight: 600, color: accent, textAlign: "right", lineHeight: 1 }}>Invoice</Text>
          <Text style={{ marginTop: 6, color: c.s500, textAlign: "right" }}>{invoice.number}</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 9, marginTop: 30 }}>
        {(
          [
            ["Issued", formatDate(invoice.issueDate), false],
            ["Due", formatDate(invoice.dueDate), false],
            ["Amount due", money(t.total), true],
          ] as const
        ).map(([k, v, hi]) => (
          <View key={k} style={m.box}>
            <Text style={m.label}>{k}</Text>
            <Text style={[m.boxValue, hi ? { color: accent } : {}]}>{v}</Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: "row", marginTop: 30 }}>
        {(
          [
            ["From", invoice.from],
            ["Bill to", invoice.to],
          ] as const
        ).map(([label, p]) => (
          <View key={label} style={s.party}>
            <Text style={m.label}>{label}</Text>
            <Text style={m.partyName}>{p.name || " "}</Text>
            <View style={{ marginTop: 2 }}>
              {p.address ? <Text style={s.muted}>{p.address}</Text> : null}
              {p.email ? <Text style={s.muted}>{p.email}</Text> : null}
              {p.phone ? <Text style={s.muted}>{p.phone}</Text> : null}
              {p.taxId ? <Text style={s.muted}>Tax ID: {p.taxId}</Text> : null}
            </View>
          </View>
        ))}
      </View>

      <View>
        <View style={m.thead} fixed>
          <Text style={[m.label, m.cDesc, { color: c.s400 }]}>Description</Text>
          <Text style={[m.label, m.cQty]}>Qty</Text>
          <Text style={[m.label, m.cRate]}>Rate</Text>
          <Text style={[m.label, m.cAmt, { color: c.s400, fontWeight: 600 }]}>Amount</Text>
        </View>
        {items.map((item) => (
          <View key={item.id} style={m.tr} wrap={false}>
            <Text style={m.cDesc}>{item.description}</Text>
            <Text style={m.cQty}>{item.quantity}</Text>
            <Text style={m.cRate}>{money(Math.round(item.rate * 10 ** t.digits))}</Text>
            <Text style={m.cAmt}>{money(lineAmountMinor(item, t.digits))}</Text>
          </View>
        ))}
      </View>

      <View style={[s.totals, { paddingHorizontal: 9 }]} wrap={false}>
        <TotalLine label="Subtotal" value={money(t.subtotal)} />
        {t.discount > 0 && (
          <TotalLine
            label={invoice.discount.type === "percent" ? `Discount (${invoice.discount.value}%)` : "Discount"}
            value={`−${money(t.discount)}`}
          />
        )}
        {invoice.taxRate > 0 && <TotalLine label={`Tax (${invoice.taxRate}%)`} value={money(t.tax)} />}
        {t.shipping > 0 && <TotalLine label="Shipping" value={money(t.shipping)} />}
        <View style={[s.grand, { borderTopWidth: 1.5, borderTopColor: accent }]}>
          <Text style={{ fontWeight: 600, color: c.s900 }}>Total {invoice.currency}</Text>
          <Text style={[s.grandValue, { color: accent, fontWeight: 600, fontSize: 13.5 }]}>{money(t.total)}</Text>
        </View>
      </View>

      {sections.length > 0 && (
        <View style={s.sections}>
          {sections.map(([key, text]) => (
            <View key={key} style={s.section} wrap={false}>
              <Text style={m.label}>{sectionTitle(key)}</Text>
              <Text style={{ marginTop: 4, color: c.s600 }}>{text}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export function InvoicePdf({ invoice }: { invoice: InvoiceData }) {
  const t = computeTotals(invoice);
  const props: BodyProps = {
    invoice,
    t,
    money: (minor: number) => formatMinor(minor, invoice.currency, t.digits),
    items: invoice.items.filter((i) => i.description || i.rate || i.quantity !== 1),
    sections: (
      [
        ["payment", invoice.paymentInfo],
        ["notes", invoice.notes],
        ["terms", invoice.terms],
      ] as const
    ).filter(([, text]) => text.trim()),
    accent: invoice.style.accent ?? DEFAULT_ACCENT,
  };
  const minimal = invoice.style.layout === "minimal";

  return (
    <Document
      title={`Invoice ${invoice.number}`}
      author={invoice.from.name || undefined}
      subject={invoice.to.name ? `Invoice for ${invoice.to.name}` : undefined}
      creator="Invoice Builder · tinytools.work"
      producer="Invoice Builder · tinytools.work"
    >
      <Page size="A4" style={[s.page, { fontFamily: fontStack(invoice) }, minimal ? { paddingTop: 0 } : {}]}>
        {minimal && <View style={{ height: 4.5, backgroundColor: props.accent, marginHorizontal: -42, marginBottom: 36 }} fixed />}
        {minimal ? <MinimalBody {...props} /> : <MonoBody {...props} />}

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
