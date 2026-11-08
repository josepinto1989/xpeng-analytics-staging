import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { assessBatteryHealth } from "./battery-health.js";
import { resolvedVehicleProfile, vehicleProfileLabel } from "./vehicle-catalog.js";

const PAGE = [595.28, 841.89];
const MARGIN = 44;
const WIDTH = PAGE[0] - MARGIN * 2;
const COLORS = {
  ink: rgb(.07, .18, .17), muted: rgb(.36, .45, .44), mint: rgb(.08, .55, .42),
  mintSoft: rgb(.91, .97, .95), amber: rgb(.82, .55, .1), amberSoft: rgb(1, .96, .87),
  line: rgb(.82, .87, .86), panel: rgb(.97, .98, .98),
};

const safe = (value) => Array.isArray(value) ? value : [];
const clean = (value) => String(value ?? "").replace(/[\u2010-\u2015]/g, "-").replace(/\u00a0/g, " ");
const numberText = (value, locale, digits = 1) => value == null || !Number.isFinite(Number(value)) ? "-" : new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(Number(value));
const dateText = (value, locale) => value ? new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${String(value).slice(0, 10)}T12:00:00Z`)) : "-";

function wrap(text, font, size, width) {
  const words = clean(text).split(/\s+/).filter(Boolean), lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) line = candidate;
    else { if (line) lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

export async function createBatteryReportPdf({ data, locale = "en", t }) {
  const history = safe(data?.battery?.history).filter((row) => Number.isFinite(Number(row?.capacityKwh))).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const assessment = assessBatteryHealth(history);
  const profile = resolvedVehicleProfile(data?.ownership?.vehicleProfile);
  if (!profile || !history.length) throw new Error("battery_report_missing_data");
  const healthPct = assessment.capacityMedianKwh / profile.usableCapacityKwh * 100;
  const pdf = await PDFDocument.create();
  pdf.setTitle(clean(t("batteryReportTitle")));
  pdf.setAuthor("Miguel Pinto");
  pdf.setSubject(clean(t("batteryReportSubject")));
  pdf.setCreator("XPENG Analytics");
  const regular = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage(PAGE);
  let y = PAGE[1] - MARGIN;
  const drawLines = (value, options = {}) => {
    const { x = MARGIN, width = WIDTH, size = 9, lineHeight = 13, font = regular, color = COLORS.muted } = options;
    for (const line of wrap(value, font, size, width)) { page.drawText(line, { x, y, size, font, color }); y -= lineHeight; }
  };
  const metric = (x, top, width, label, value, note = "") => {
    page.drawRectangle({ x, y: top - 76, width, height: 76, color: COLORS.panel, borderColor: COLORS.line, borderWidth: .6 });
    page.drawText(clean(label), { x: x + 12, y: top - 20, size: 7.5, font: regular, color: COLORS.muted });
    page.drawText(clean(value), { x: x + 12, y: top - 46, size: 17, font: bold, color: COLORS.ink });
    if (note) page.drawText(clean(note).slice(0, 54), { x: x + 12, y: top - 64, size: 6.7, font: regular, color: COLORS.muted });
  };

  page.drawText("XPENG", { x: MARGIN, y, size: 13, font: bold, color: COLORS.ink });
  page.drawText("ANALYTICS", { x: MARGIN + 47, y: y + 1, size: 8, font: regular, color: COLORS.mint });
  y -= 34;
  page.drawText(clean(t("batteryReportTitle")), { x: MARGIN, y, size: 24, font: bold, color: COLORS.ink });
  y -= 24;
  page.drawText(clean(vehicleProfileLabel(data.ownership.vehicleProfile)), { x: MARGIN, y, size: 10, font: bold, color: COLORS.mint });
  y -= 18;
  drawLines(`${dateText(history[0]?.date, locale)} - ${dateText(history.at(-1)?.date, locale)}`, { size: 8 });
  y -= 7;
  page.drawRectangle({ x: MARGIN, y: y - 58, width: WIDTH, height: 58, color: COLORS.amberSoft, borderColor: COLORS.amber, borderWidth: .7 });
  const noticeY = y - 16;
  wrap(t("batteryReportDisclaimer"), regular, 8.2, WIDTH - 24).slice(0, 3).forEach((line, index) => page.drawText(clean(line), { x: MARGIN + 12, y: noticeY - index * 12, size: 8.2, font: regular, color: COLORS.ink }));
  y -= 80;

  const gap = 10, cardWidth = (WIDTH - gap * 2) / 3;
  metric(MARGIN, y, cardWidth, t("estimatedCapacity"), `${numberText(assessment.capacityMedianKwh, locale)} kWh`, `${assessment.sampleCount} ${t("qualifiedChargesLower")}`);
  metric(MARGIN + cardWidth + gap, y, cardWidth, t("batteryReferenceCapacity"), `${numberText(profile.usableCapacityKwh, locale)} kWh`, t(profile.sourceKind === "official" ? "batteryOfficialReference" : "batteryOwnerReference"));
  metric(MARGIN + (cardWidth + gap) * 2, y, cardWidth, t("batteryEstimatedHealth"), `${numberText(healthPct, locale)}%`, t("batteryEstimateNotBms"));
  y -= 98;

  page.drawText(clean(t("batteryEvidenceTitle")), { x: MARGIN, y, size: 13, font: bold, color: COLORS.ink });
  y -= 22;
  const evidence = [
    [t("confidence"), t(`batteryConfidence_${assessment.level}`)],
    [t("observationPeriod"), `${numberText(assessment.spanDays, locale, 0)} ${t("daysLower")}`],
    [t("capacityConfidenceRange"), assessment.lowerCapacityKwh == null ? "-" : `${numberText(assessment.lowerCapacityKwh, locale)}-${numberText(assessment.upperCapacityKwh, locale)} kWh`],
    [t("estimateVariability"), assessment.variabilityPct == null ? "-" : `${numberText(assessment.variabilityPct, locale)}%`],
  ];
  evidence.forEach(([label, value], index) => {
    const rowY = y - index * 26;
    page.drawText(clean(label), { x: MARGIN, y: rowY, size: 8, font: regular, color: COLORS.muted });
    page.drawText(clean(value), { x: MARGIN + 195, y: rowY, size: 9, font: bold, color: COLORS.ink });
  });
  y -= 124;

  page.drawText(clean(t("batteryCapacityHistory")), { x: MARGIN, y, size: 13, font: bold, color: COLORS.ink });
  y -= 18;
  const chart = { x: MARGIN, y: y - 170, width: WIDTH, height: 170 };
  page.drawRectangle({ ...chart, color: COLORS.panel, borderColor: COLORS.line, borderWidth: .6 });
  const values = history.map((row) => Number(row.rollingCapacityKwh ?? row.capacityKwh)).filter(Number.isFinite);
  const lower = Math.min(profile.usableCapacityKwh, ...values) * .94, upper = Math.max(profile.usableCapacityKwh, ...values) * 1.04, span = Math.max(1, upper - lower);
  const point = (value, index) => ({ x: chart.x + 12 + index / Math.max(1, values.length - 1) * (chart.width - 24), y: chart.y + 18 + (value - lower) / span * (chart.height - 36) });
  const referenceY = point(profile.usableCapacityKwh, 0).y;
  page.drawLine({ start: { x: chart.x + 12, y: referenceY }, end: { x: chart.x + chart.width - 12, y: referenceY }, thickness: .8, color: COLORS.amber, dashArray: [4, 3] });
  values.forEach((value, index) => { if (index) page.drawLine({ start: point(values[index - 1], index - 1), end: point(value, index), thickness: 1.7, color: COLORS.mint }); });
  page.drawText(`${numberText(profile.usableCapacityKwh, locale)} kWh`, { x: chart.x + chart.width - 54, y: referenceY + 4, size: 6.5, font: regular, color: COLORS.amber });
  y = chart.y - 24;

  drawLines(t("batteryReportMethod"), { size: 7.5, lineHeight: 10.5 });
  if (profile.sourceUrl) {
    y -= 5;
    page.drawText(clean(t("batteryReferenceSource")), { x: MARGIN, y, size: 7, font: bold, color: COLORS.muted });
    y -= 10;
    drawLines(profile.sourceUrl, { size: 6.5, lineHeight: 9 });
  }
  page.drawLine({ start: { x: MARGIN, y: 49 }, end: { x: PAGE[0] - MARGIN, y: 49 }, thickness: .5, color: COLORS.line });
  page.drawText(clean(t("batteryReportFooter")), { x: MARGIN, y: 33, size: 6.8, font: regular, color: COLORS.muted });
  page.drawText("XPENG Analytics - https://josepinto1989.github.io/xpeng-analytics/", { x: MARGIN, y: 21, size: 6.5, font: regular, color: COLORS.mint });
  return pdf.save();
}

export async function downloadBatteryReportPdf(options) {
  const bytes = await createBatteryReportPdf(options);
  if (typeof document === "undefined") return bytes;
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `xpeng-battery-report-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return bytes;
}
