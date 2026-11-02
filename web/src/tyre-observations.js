const rows = (value) => Array.isArray(value) ? value : [];
const finite = (value) => Number.isFinite(Number(value));
function median(values){const sorted=values.map(Number).filter(Number.isFinite).sort((a,b)=>a-b);if(!sorted.length)return null;const middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;}

export function buildTyreObservations(input) {
  const data=rows(input).filter((row)=>finite(row?.averageKpa)).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))),observations=[];
  if(data.length<3)return {observations,sampleDays:data.length};
  const latest=data.at(-1),recent=data.slice(-7),baseline=median(data.slice(0,-1).map((row)=>row.averageKpa)),latestAverage=Number(latest.averageKpa);
  if(baseline!=null&&latestAverage<=baseline-12)observations.push({kind:"pressureDrop",severity:latestAverage<=baseline-20?"attention":"watch",valueKpa:baseline-latestAverage,date:latest.date});
  const persistent=recent.filter((row)=>Math.max(Number(row.frontImbalanceKpa)||0,Number(row.rearImbalanceKpa)||0)>=12);
  if(persistent.length>=3)observations.push({kind:"persistentImbalance",severity:persistent.some((row)=>Math.max(Number(row.frontImbalanceKpa)||0,Number(row.rearImbalanceKpa)||0)>=20)?"attention":"watch",days:persistent.length,valueKpa:Math.max(...persistent.map((row)=>Math.max(Number(row.frontImbalanceKpa)||0,Number(row.rearImbalanceKpa)||0))),date:latest.date});
  const spanDays=Math.max(1,(Date.parse(`${latest.date}T12:00:00Z`)-Date.parse(`${data[0].date}T12:00:00Z`))/86_400_000),change=latestAverage-Number(data[0].averageKpa);
  if(spanDays>=14&&change<=-15)observations.push({kind:"gradualLoss",severity:"watch",valueKpa:Math.abs(change),spanDays:Math.round(spanDays),date:latest.date});
  return {observations,sampleDays:data.length,baselineKpa:baseline};
}
