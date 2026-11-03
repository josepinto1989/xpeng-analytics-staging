const safe = (value) => Array.isArray(value) ? value : [];

export function bandStart(label) {
  const match = String(label || "").match(/-?\d+(?:[.,]\d+)?/);
  return match ? Number(match[0].replace(",", ".")) : Number.POSITIVE_INFINITY;
}

export function aggregateBands(rows) {
  return [...safe(rows).reduce((map, row) => {
    const label = String(row?.band || "");
    return map.set(label, (map.get(label) || 0) + Number(row?.seconds || 0));
  }, new Map())]
    .map(([band, seconds]) => ({ band, minutes: seconds / 60 }))
    .sort((left, right) => bandStart(left.band) - bandStart(right.band) || left.band.localeCompare(right.band, undefined, { numeric: true }));
}
