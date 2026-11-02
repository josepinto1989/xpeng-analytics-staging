const rows = (value) => Array.isArray(value) ? value : [];
const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));

function haversineKm(left, right) {
  const radians = (value) => value * Math.PI / 180, radius = 6371;
  const dLat = radians(Number(right.lat) - Number(left.lat)), dLon = radians(Number(right.lon) - Number(left.lon));
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(Number(left.lat))) * Math.cos(radians(Number(right.lat))) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestEntry(series, timestampUtc) {
  const target = Date.parse(timestampUtc || "");
  if (!Number.isFinite(target) || !series.length) return null;
  let low=0,high=series.length-1;
  while(low<=high){const middle=(low+high)>>1,time=series[middle].time;if(time<target)low=middle+1;else if(time>target)high=middle-1;else return series[middle];}
  const before=series[Math.max(0,high)],after=series[Math.min(series.length-1,low)];
  return target-before.time<=after.time-target?before:after;
}

function alignedTelemetry(lookup, timestampUtc, progress) {
  if (!lookup.length) return null;
  const target = Date.parse(timestampUtc || ""), direct = nearestEntry(lookup, timestampUtc);
  const duration = Math.max(1, lookup.at(-1).time - lookup[0].time);
  const tolerance = Math.max(120_000, Math.min(300_000, duration * .04));
  if (direct && Number.isFinite(target) && Math.abs(direct.time - target) <= tolerance) return direct.point;
  return lookup[Math.round(Math.max(0, Math.min(1, progress)) * (lookup.length - 1))]?.point || direct?.point || null;
}

export function buildRouteIntelligence(segments, telemetry) {
  const lookup=rows(telemetry).map((point)=>({point,time:Date.parse(point?.timestampUtc||"")})).filter((entry)=>Number.isFinite(entry.time)).sort((a,b)=>a.time-b.time);
  const totalPoints=rows(segments).reduce((total,segment)=>total+rows(segment).length,0);
  let distanceKm=0,flatIndex=0;
  const enriched=rows(segments).map((segment)=>rows(segment).map((point,index,source)=>{
    if(index)distanceKm+=haversineKm(source[index-1],point);
    const progress=totalPoints>1?flatIndex/(totalPoints-1):0,sample=alignedTelemetry(lookup,point.timestampUtc,progress)||{};
    flatIndex+=1;
    const speedKmh=finite(point.gpsSpeedKmh)?Number(point.gpsSpeedKmh):finite(sample.speedKmh)?Number(sample.speedKmh):null,powerKw=finite(sample.powerKw)?Number(sample.powerKw):null;
    const consumptionKwh100=speedKmh>3&&powerKw>0?powerKw/speedKmh*100:null;
    return {...point,distanceKm,speedKmh,powerKw,regenerationKw:powerKw<0?Math.abs(powerKw):powerKw==null?null:0,consumptionKwh100,alignedTimestampUtc:sample.timestampUtc||point.timestampUtc};
  }));
  const flat=enriched.flat(),available={speed:flat.some((point)=>finite(point.speedKmh)),power:flat.some((point)=>finite(point.powerKw)),regeneration:flat.some((point)=>finite(point.regenerationKw)&&point.regenerationKw>0),consumption:flat.some((point)=>finite(point.consumptionKwh100)),elevation:flat.some((point)=>finite(point.elevationM))};
  const elevation=flat.filter((point)=>finite(point.elevationM)).map((point)=>({distanceKm:point.distanceKm,elevationM:Number(point.elevationM),timestampUtc:point.timestampUtc}));
  return {segments:enriched,points:flat,available,elevation};
}

const palettes={speed:[[0,"#4c78a8"],[30,"#3ab5ae"],[70,"#e3a62f"],[120,"#e27b66"]],power:[[-40,"#20a983"],[0,"#8a9a9a"],[80,"#e3a62f"],[180,"#e27b66"]],regeneration:[[0,"#d6dfdc"],[20,"#63b7d4"],[60,"#20a983"],[120,"#0d785c"]],consumption:[[0,"#20a983"],[15,"#63b7d4"],[25,"#e3a62f"],[45,"#e27b66"]]};
function hexRgb(hex){return [1,3,5].map((index)=>parseInt(hex.slice(index,index+2),16));}
function rgbHex(rgb){return `#${rgb.map((value)=>Math.round(value).toString(16).padStart(2,"0")).join("")}`;}
export function routeMetricColor(mode, value) {
  if(mode==="route"||!finite(value))return "#159a75";
  const stops=palettes[mode]||palettes.speed,number=Number(value);
  if(number<=stops[0][0])return stops[0][1];if(number>=stops.at(-1)[0])return stops.at(-1)[1];
  for(let index=1;index<stops.length;index++){if(number>stops[index][0])continue;const [low,high]=[stops[index-1],stops[index]],ratio=(number-low[0])/(high[0]-low[0]),a=hexRgb(low[1]),b=hexRgb(high[1]);return rgbHex(a.map((value,channel)=>value+(b[channel]-value)*ratio));}
  return stops.at(-1)[1];
}

export function routeMetricValue(point, mode){return mode==="speed"?point.speedKmh:mode==="power"?point.powerKw:mode==="regeneration"?point.regenerationKw:mode==="consumption"?point.consumptionKwh100:null;}

export function routePointForTelemetry(points, telemetryPoint) {
  const source=rows(points),timestampUtc=telemetryPoint?.timestampUtc;
  if(!source.length||!timestampUtc)return null;
  const aligned=source.map((point)=>({point,time:Date.parse(point.alignedTimestampUtc||point.timestampUtc||"")})).filter((entry)=>Number.isFinite(entry.time)).sort((left,right)=>left.time-right.time);
  return nearestEntry(aligned,timestampUtc)?.point||null;
}
