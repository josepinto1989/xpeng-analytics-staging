import { detectLikelyImportGaps, telemetryCoverage } from "./drive-backup-metadata.js";

const rows = (value) => Array.isArray(value) ? value : [];

export function assessDataProtection(data, { drive = {}, persistence = {}, now = Date.now() } = {}) {
  const coverage = telemetryCoverage(data);
  const endTime = Date.parse(coverage.endUtc || "");
  const ageDays = Number.isFinite(endTime) ? Math.max(0, (now - endTime) / 86_400_000) : null;
  const recoverableDays = ageDays == null ? null : Math.max(0, 30 - ageDays);
  const importGaps = detectLikelyImportGaps(data?.imports);
  const odometerGaps = rows(data?.quality?.events).filter((event) => event?.rule === "odometer_coverage_gap");
  const backupEnd = Date.parse(drive?.coverageEndUtc || "");
  const backupCurrent = Boolean(drive?.hasBackup && Number.isFinite(endTime) && Number.isFinite(backupEnd) && backupEnd >= endTime - 60_000);
  let level = "good";
  if (!persistence?.enabled && !drive?.hasBackup) level = "risk";
  else if ((recoverableDays != null && recoverableDays <= 7) || importGaps.length || odometerGaps.length || (drive?.hasBackup && !backupCurrent)) level = "attention";
  return { level, coverage, ageDays, recoverableDays, importGaps, odometerGaps, backupCurrent, hasPortableProtection: Boolean(persistence?.hasSavedHistory || drive?.hasBackup), rawCount: rows(drive?.originals).length };
}
