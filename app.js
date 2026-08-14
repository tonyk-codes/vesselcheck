"use strict";
const CONFIG={
  arrivalUrl:"https://www.mardep.gov.hk/e_files/en/opendata/RP05005i.XML",
  departureUrl:"https://www.mardep.gov.hk/e_files/en/opendata/RP05505i.XML",
  arrivalReportUrl:"https://www.mardep.gov.hk/e_files/en/pub_services/RP05005.XML",
  departureReportUrl:"https://www.mardep.gov.hk/e_files/en/pub_services/RP05505.XML",
  futureArrivalUrl:"https://www.mardep.gov.hk/e_files/en/pub_services/RP04005.XML",
  futureDepartureUrl:"https://www.mardep.gov.hk/e_files/en/pub_services/RP04505.XML",
  historicalApiBase:"https://app.data.gov.hk/v1/historical-archive/get-file",
  historicalVersionListBase:"https://app.data.gov.hk/v1/historical-archive/list-file-versions",
  corsProxies:["https://api.allorigins.win/raw?url=","https://corsproxy.io/?"],
  maxDays:20,
  maxFetchAttempts:4,
  retryBaseDelayMs:75,
  historicalTimeoutMs:5000,
  historicalVersionAttempts:2,
  historicalFileAttempts:2,
  historicalDayDelayMs:150,
  cachePrefix:"vesselcheck-v7:"
};
let currentData=[];
const $=id=>document.getElementById(id);
document.addEventListener("DOMContentLoaded",()=>{setDefaultDates();$("useLast36h").addEventListener("change",()=>syncMode("recent"));$("useFuture").addEventListener("change",()=>syncMode("future"));$("startDate").addEventListener("change",()=>{if(!$("useLast36h").checked&&!$("useFuture").checked){$("endDate").focus();if(typeof $("endDate").showPicker==="function")$("endDate").showPicker()}});$("searchBtn").addEventListener("click",performSearch);$("clearBtn").addEventListener("click",clearSearch);$("vesselName").addEventListener("keydown",e=>{if(e.key==="Enter")performSearch()});syncMode("recent",true)});
function setDefaultDates(){const yesterday=localYMD(new Date(Date.now()-86400000));$("startDate").max=yesterday;$("endDate").max=yesterday;$("startDate").value=yesterday;$("endDate").value=yesterday}
function localYMD(d){const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Hong_Kong",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d),v=Object.fromEntries(p.map(x=>[x.type,x.value]));return`${v.year}-${v.month}-${v.day}`}
function syncMode(changed,initial=false){const recent=$("useLast36h"),future=$("useFuture");if(changed==="recent"&&recent.checked)future.checked=false;if(changed==="future"&&future.checked)recent.checked=false;const special=recent.checked||future.checked;$("startDate").disabled=special;$("endDate").disabled=special;$("modeHint").textContent=future.checked?"未來船期直接讀取海事處最新 XML，日期範圍不適用。":recent.checked?"可查詢最近 36 小時，或取消勾選查詢最多 20 天的歷史資料。":"可選擇最多 20 天的歷史日期範圍。";if(!initial)clearResults()}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function escapeHTML(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function log(message,type="info"){const time=new Date().toLocaleTimeString("zh-HK",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}),e=document.createElement("div");e.innerHTML=`<span class="log-time">[${escapeHTML(time)}]</span> <span class="log-${type}">${escapeHTML(message)}</span>`;$("logPanel").appendChild(e);$("logWrap").classList.add("show");$("logPanel").scrollTop=$("logPanel").scrollHeight}
function clearMessages(){document.querySelectorAll(".message").forEach(el=>el.classList.remove("show"))}
function showMessage(id,text){$(id).textContent=text;$(id).classList.add("show")}
function showLoading(text){$("loading").classList.add("show");$("loadingText").textContent=text||"正在獲取資料...";$("progressBar").style.width="8%";$("tableWrapper").classList.remove("show");$("stats").classList.remove("show");$("noResults").classList.remove("show");$("searchBtn").disabled=true;$("resultMeta").textContent="擷取中"}
function hideLoading(){$("loading").classList.remove("show");$("searchBtn").disabled=false}
function clearResults(){currentData=[];clearMessages();$("tableWrapper").classList.remove("show");$("stats").classList.remove("show");$("noResults").classList.remove("show");$("logWrap").classList.remove("show");$("logPanel").replaceChildren();$("resultMeta").textContent="尚未搜尋"}
function validateDateRange(start,end){if(!start||!end)return{valid:false,error:"請選擇開始和結束日期"};if(new Date(start)>new Date(end))return{valid:false,error:"開始日期必須早於結束日期"};const days=Math.ceil((new Date(end)-new Date(start))/86400000)+1;if(days>CONFIG.maxDays)return{valid:false,error:`日期範圍不可超過 ${CONFIG.maxDays} 天`};return{valid:true,days}}
function parseVesselDateTime(value){if(!value)return null;const s=String(value).trim(),m=s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/),months={JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11};if(m){const d=new Date(+m[3],months[m[2].toUpperCase()],+m[1],+(m[4]||0),+(m[5]||0),+(m[6]||0));return Number.isNaN(d.getTime())?null:d}const d=new Date(s);return Number.isNaN(d.getTime())?null:d}
function filterBySelectedDateRange(data,startStr,endStr){const start=new Date(startStr),end=new Date(endStr);start.setHours(0,0,0,0);end.setHours(23,59,59,999);return data.filter(x=>{const d=parseVesselDateTime(x.time);return d&&d>=start&&d<=end})}
function sortByTimeAscending(data){return data.slice().sort((a,b)=>(parseVesselDateTime(a.time)?.getTime()??Infinity)-(parseVesselDateTime(b.time)?.getTime()??Infinity)||(a.vesselName||"").localeCompare(b.vesselName||""))}
function floorToHalfHourHHMM(date){const d=new Date(date);d.setMinutes(d.getMinutes()<30?0:30,0,0);return`${String(d.getHours()).padStart(2,"0")}${String(d.getMinutes()).padStart(2,"0")}`}
function ymd(d){return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function recordKey(r){return`${(r.vesselName||"").toUpperCase()}|${r.type||""}|${r.time||""}|${r.location||""}|${r.callSign||""}`}
function dedupeRecords(records){const seen=new Map;for(const r of records){const k=recordKey(r);if(!seen.has(k))seen.set(k,r);else if(!seen.get(k).adjacentPort&&r.adjacentPort)seen.get(k).adjacentPort=r.adjacentPort}return[...seen.values()]}
function callKey(v){return String(v||"").trim().toUpperCase().replace(/\s+/g,"")}
function portMap(rows){const map=new Map;for(const r of rows)if(callKey(r.callSign)&&r.adjacentPort)map.set(callKey(r.callSign),r.adjacentPort);return map}
async function performSearch(){clearResults();const vesselName=$("vesselName").value.trim().toUpperCase(),type=$("dataType").value;try{let data;if($("useFuture").checked){showLoading("正在獲取未來船期...");data=await searchCurrentMode("future",vesselName,type)}else if($("useLast36h").checked){showLoading("正在獲取最近 36 小時船隻資料...");data=await searchCurrentMode("recent",vesselName,type)}else{const start=$("startDate").value,end=$("endDate").value,v=validateDateRange(start,end);if(!v.valid){showMessage("errorMessage",v.error);return}showLoading("正在獲取歷史資料...");log(`日期範圍：${start} 至 ${end}（${v.days} 天）`);const all=await fetchHistoricalDataRangeOptimized(start,end,type);data=filterBySelectedDateRange(all,start,end);if(vesselName)data=data.filter(x=>x.vesselName?.toUpperCase().includes(vesselName))}displayResults(data,vesselName)}catch(e){log(`錯誤：${e.message}`,"error");showMessage("errorMessage",`搜尋時發生錯誤：${e.message}`);$("resultMeta").textContent="擷取失敗";hideLoading()}}
async function searchCurrentMode(mode,name,type){let all=[],arrivalCount=0,departureCount=0;const isFuture=mode==="future",aUrl=isFuture?CONFIG.futureArrivalUrl:CONFIG.arrivalUrl,dUrl=isFuture?CONFIG.futureDepartureUrl:CONFIG.departureUrl;if(type==="both"||type==="arrival"){log("獲取抵港資料...");const rows=await fetchXMLDataEnsured(aUrl,"arrival",false,4);arrivalCount=rows.length;all.push(...rows);log(`抵港：${rows.length} 筆`,"success")}if(type==="both"||type==="departure"){if(type==="both"){log("等待後再獲取離港資料...");await sleep(300)}log("獲取離港資料...");const rows=await fetchXMLDataEnsured(dUrl,"departure",false,4);departureCount=rows.length;all.push(...rows);log(`離港：${rows.length} 筆`,"success")}if(!isFuture){$("loadingText").textContent="正在補充上一靠港／下一靠港...";await attachCurrentPorts(all,type)}if(name)all=all.filter(x=>x.vesselName?.toUpperCase().includes(name));log(`完成：共 ${all.length} 筆記錄（抵港 ${arrivalCount}，離港 ${departureCount}）`,"success");return dedupeRecords(all)}
async function attachCurrentPorts(rows,type){const jobs=[];if(type==="both"||type==="arrival")jobs.push(fetchXMLDataEnsured(CONFIG.arrivalReportUrl,"arrival",false,5).catch(e=>{log(`抵港靠港資料未能取得：${e.message}`,"warn");return[]}));if(type==="both"||type==="departure")jobs.push(fetchXMLDataEnsured(CONFIG.departureReportUrl,"departure",false,5).catch(e=>{log(`離港靠港資料未能取得：${e.message}`,"warn");return[]}));const maps=(await Promise.all(jobs)).map(portMap),combined=new Map;maps.forEach(m=>m.forEach((v,k)=>combined.set(k,v)));rows.forEach(r=>r.adjacentPort=combined.get(callKey(r.callSign))||r.adjacentPort||"")}
async function fetchHistoricalDataRangeOptimized(startDate,endDate,dataType="both"){
  const start=new Date(`${startDate}T00:00:00`),end=new Date(`${endDate}T00:00:00`);
  const all=[],seen=new Map();
  const total=Math.round((end-start)/86400000)+1;
  let index=0,completeDays=0,partialDays=0,failedDays=0;

  for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){
    index++;
    const targetDate=ymd(d);
    const archiveDate=addDateDays(targetDate,1);
    const needArrival=dataType==="both"||dataType==="arrival";
    const needDeparture=dataType==="both"||dataType==="departure";
    const yesterday=isYesterday(targetDate);

    showLoading(`正在獲取 ${targetDate} 的歷史資料（${index}/${total}）...`);
    $("progressBar").style.width=`${Math.max(8,Math.round((index-1)/total*100))}%`;
    if(yesterday)log(`▶ [${index}/${total}] 目標日期 ${targetDate}（昨天）；直接嘗試 ${archiveDate} 凌晨版本。`,"info");
    else log(`▶ [${index}/${total}] 目標日期 ${targetDate}；查詢 ${archiveDate} 的可用歷史版本。`,"info");

    // Yesterday uses direct timestamp probing; other days use list-file-versions.
    const [arrivalMovement,departureMovement]=await Promise.all([
      needArrival?(yesterday?fetchYesterdayMovementDay(targetDate,"arrival"):fetchHistoricalMovementDay(targetDate,archiveDate,"arrival")):Promise.resolve(notRequestedResult()),
      needDeparture?(yesterday?fetchYesterdayMovementDay(targetDate,"departure"):fetchHistoricalMovementDay(targetDate,archiveDate,"departure")):Promise.resolve(notRequestedResult())
    ]);

    logHistoricalMovementResult(targetDate,"arrival",arrivalMovement,needArrival);
    logHistoricalMovementResult(targetDate,"departure",departureMovement,needDeparture);

    const dayArrivals=arrivalMovement.ok?arrivalMovement.records:[];
    const dayDepartures=departureMovement.ok?departureMovement.records:[];
    log(`${targetDate} 移動記錄完成：抵港 ${dayArrivals.length} 筆，離港 ${dayDepartures.length} 筆。`,dayArrivals.length||dayDepartures.length?"success":"warn");

    // Skip port reports for yesterday — no 上一靠港／下一靠港 needed.
    if(!yesterday){
      const reportJobs=[];
      if(dayArrivals.length){
        reportJobs.push(fetchHistoricalPortDay(targetDate,archiveDate,"arrival")
          .then(result=>({type:"arrival",result})));
      }
      if(dayDepartures.length){
        reportJobs.push(fetchHistoricalPortDay(targetDate,archiveDate,"departure")
          .then(result=>({type:"departure",result})));
      }
      const reportResults=await Promise.all(reportJobs);
      for(const {type,result} of reportResults){
        const label=type==="arrival"?"抵港上一靠港":"離港下一靠港";
        if(result.ok){
          const rows=type==="arrival"?dayArrivals:dayDepartures;
          const matched=applyHistoricalPorts(rows,result.records);
          log(`${targetDate} ${label}：版本 ${result.timestamp}，報告 ${result.records.length} 筆，CALL_SIGN 配對 ${matched} 筆。`,"success");
        }else{
          log(`${targetDate} ${label}：未能取得報告，保留移動記錄並顯示「-」。`,"warn");
        }
      }
    }else{
      log(`${targetDate}：昨天資料，略過上一靠港／下一靠港查詢。`,"info");
    }

    for(const record of [...dayArrivals,...dayDepartures]){
      const key=recordKey(record);
      if(!seen.has(key)){seen.set(key,record);all.push(record)}
      else if(!seen.get(key).adjacentPort&&record.adjacentPort)seen.get(key).adjacentPort=record.adjacentPort;
    }

    const requested=[needArrival?arrivalMovement:null,needDeparture?departureMovement:null].filter(Boolean);
    if(requested.every(result=>!result.ok))failedDays++;
    else if(requested.some(result=>!result.ok))partialDays++;
    else completeDays++;

    log(`✓ ${targetDate} 完成：顯示抵港 ${dayArrivals.length} 筆、離港 ${dayDepartures.length} 筆。`,"success");
    $("progressBar").style.width=`${Math.round(index/total*100)}%`;
    if(index<total)await sleep(CONFIG.historicalDayDelayMs);
  }

  log(`歷史查詢摘要：完整 ${completeDays} 天，部分 ${partialDays} 天，失敗 ${failedDays} 天。`,failedDays?"warn":"success");
  return all;
}
function addDateDays(dateString,amount){
  const [year,month,day]=dateString.split("-").map(Number);
  return new Date(Date.UTC(year,month-1,day+amount)).toISOString().slice(0,10);
}
function compactDate(dateString){return dateString.replaceAll("-","")}
function eventDay(value){const d=parseVesselDateTime(value);return d?ymd(d):""}
function notRequestedResult(){return{ok:true,status:"not-requested",records:[],timestamp:null,source:"not-requested"}}
function historicalSource(type,category){
  if(category==="movement")return type==="arrival"?CONFIG.arrivalUrl:CONFIG.departureUrl;
  return type==="arrival"?CONFIG.arrivalReportUrl:CONFIG.departureReportUrl;
}
function isYesterday(dateString){return dateString===localYMD(new Date(Date.now()-86400000))}
function historicalTypeName(type){return type==="arrival"?"抵港":"離港"}
function versionListHasDate(data,archiveDate){
  const prefix=compactDate(archiveDate)+"-";
  const timestamps=Array.isArray(data?.timestamps)?data.timestamps:[];
  return timestamps.some(v=>typeof v==="string"&&v.startsWith(prefix));
}
function versionListUrl(sourceUrl,dateString){
  const date=compactDate(dateString);
  return`${CONFIG.historicalVersionListBase}?url=${encodeURIComponent(sourceUrl)}&start=${date}&end=${date}`;
}
function historicalFileUrl(sourceUrl,timestamp){
  return`${CONFIG.historicalApiBase}?url=${encodeURIComponent(sourceUrl)}&time=${encodeURIComponent(timestamp)}`;
}
function chooseMovementTimestamp(versionData,archiveDate){
  const prefix=`${compactDate(archiveDate)}-`;
  const timestamps=Array.isArray(versionData?.timestamps)?versionData.timestamps:[];
  const valid=timestamps.filter(value=>typeof value==="string"&&/^\d{8}-\d{4}$/.test(value)&&value.startsWith(prefix)).sort();
  if(!valid.length)return null;
  const early=valid.filter(value=>{const hhmm=value.slice(-4);return hhmm>="0000"&&hhmm<="1200"});
  // Prefer the seventh actual early version; otherwise sixth, fifth, fourth, third, second, first, then earliest actual version.
  return early[6]||early[5]||early[4]||early[3]||early[2]||early[1]||early[0]||valid[0];
}
function chooseReportTimestamp(versionData,archiveDate){
  const expectedPrefix=`${compactDate(archiveDate)}-`;
  const preferred=versionData?.["latest-doc-date-before-start-date"];
  if(typeof preferred==="string"&&/^\d{8}-\d{4}$/.test(preferred)&&preferred.startsWith(expectedPrefix))return preferred;
  const latestFile=versionData?.["latest-file-before-start-date"]?.timestamp;
  if(typeof latestFile==="string"&&/^\d{8}-\d{4}$/.test(latestFile)&&latestFile.startsWith(expectedPrefix))return latestFile;
  const timestamps=Array.isArray(versionData?.timestamps)?versionData.timestamps.filter(value=>typeof value==="string"&&value.startsWith(expectedPrefix)).sort():[];
  return timestamps.at(-1)||null;
}
async function fetchYesterdayMovementDay(targetDate,type){
  const sourceUrl=historicalSource(type,"movement");
  const label=`${targetDate} ${historicalTypeName(type)}移動資料`;
  const today=addDateDays(targetDate,1);
  const todayCompact=compactDate(today);
  log(`${label}：昨天資料，直接嘗試 ${today} 的版本（0130 至 1300，每 15 分鐘遞增）。`,"info");
  for(let mins=90;mins<=780;mins+=15){
    const hh=String(Math.floor(mins/60)).padStart(2,"0");
    const mm=String(mins%60).padStart(2,"0");
    const timestamp=`${todayCompact}-${hh}${mm}`;
    const file=await fetchHistoricalXml(sourceUrl,timestamp,type,label);
    if(file.ok){
      const filtered=file.records.filter(record=>eventDay(record.time)===targetDate);
      log(`${label}：版本 ${timestamp}，下載 ${file.records.length} 筆原始記錄；日期篩選後 ${filtered.length} 筆。`,"success");
      return{ok:true,status:file.status,records:filtered,timestamp,source:file.source};
    }
  }
  log(`${label}：所有凌晨版本皆無法取得資料。`,"error");
  return failedHistoricalResult();
}
async function fetchHistoricalMovementDay(targetDate,archiveDate,type){
  const sourceUrl=historicalSource(type,"movement");
  const label=`${targetDate} ${historicalTypeName(type)}移動資料`;
  const versions=await fetchVersionList(sourceUrl,archiveDate,label);
  if(!versions.ok)return failedHistoricalResult();
  const timestamp=chooseMovementTimestamp(versions.data,archiveDate);
  if(!timestamp){log(`${label}：版本清單沒有 ${archiveDate} 的可用時間。`,"error");return failedHistoricalResult()}
  log(`${label}：版本清單共有 ${Array.isArray(versions.data.timestamps)?versions.data.timestamps.length:0} 個版本，選用第 3 個可用凌晨版本 ${timestamp}。`,"info");
  const file=await fetchHistoricalXml(sourceUrl,timestamp,type,label);
  if(!file.ok)return failedHistoricalResult(timestamp);
  const filtered=file.records.filter(record=>eventDay(record.time)===targetDate);
  log(`${label}：下載 ${file.records.length} 筆原始記錄；日期篩選後 ${filtered.length} 筆。`,"success");
  return{ok:true,status:file.status,records:filtered,timestamp,source:file.source};
}
async function fetchHistoricalPortDay(targetDate,archiveDate,type){
  const sourceUrl=historicalSource(type,"report");
  const label=`${targetDate} ${historicalTypeName(type)}靠港報告`;
  const versions=await fetchVersionList(sourceUrl,archiveDate,label);
  if(!versions.ok)return failedHistoricalResult();
  const timestamp=chooseReportTimestamp(versions.data,archiveDate);
  if(!timestamp){log(`${label}：找不到 latest-doc-date-before-start-date。`,"warn");return failedHistoricalResult()}
  log(`${label}：版本 API 返回精確時間 ${timestamp}。`,"info");
  const file=await fetchHistoricalXml(sourceUrl,timestamp,type,label);
  if(!file.ok)return failedHistoricalResult(timestamp);
  const filtered=file.records.filter(record=>eventDay(record.time)===targetDate);
  log(`${label}：下載 ${file.records.length} 筆原始記錄；日期篩選後 ${filtered.length} 筆。`,"success");
  return{ok:true,status:file.status,records:filtered,timestamp,source:file.source};
}
function failedHistoricalResult(timestamp=null){return{ok:false,status:"failed",records:[],timestamp,source:"none"}}
function logHistoricalMovementResult(targetDate,type,result,requested){
  if(!requested)return;
  const label=`${targetDate} ${historicalTypeName(type)}移動資料`;
  if(result.ok)log(`${label}：成功，版本 ${result.timestamp}，顯示 ${result.records.length} 筆。`,"success");
  else log(`${label}：取得失敗。`,"error");
}
async function fetchVersionList(sourceUrl,archiveDate,label){
  const url=versionListUrl(sourceUrl,archiveDate);
  const key=versionCacheKey(sourceUrl,archiveDate);
  const cached=readJsonCache(key,3600000);
  if(cached&&versionListHasDate(cached,archiveDate)){log(`${label}：使用已儲存的版本清單。`,"info");return{ok:true,data:cached,source:"cache"}}
  if(cached){log(`${label}：快取版本清單不包含 ${archiveDate} 的資料，重新查詢。`,"warn");localStorage.removeItem(key)}
  for(let attempt=1;attempt<=CONFIG.historicalVersionAttempts;attempt++){
    log(`${label}：查詢 ${archiveDate} 版本清單（第 ${attempt}/${CONFIG.historicalVersionAttempts} 次）。`,"info");
    const result=await fetchJsonRoutes(url,CONFIG.historicalTimeoutMs,label);
    if(result.ok&&result.data){const hasTimestamps=Array.isArray(result.data.timestamps)&&result.data.timestamps.length>0;if(hasTimestamps)writeJsonCache(key,result.data);else log(`${label}：版本清單無可用時間，不儲存快取。`,"warn");return{ok:true,data:result.data,source:result.source}}
    if(attempt<CONFIG.historicalVersionAttempts)await sleep(200*attempt);
  }
  log(`${label}：版本清單取得失敗。`,"error");
  return{ok:false,data:null,source:"none"};
}
async function fetchJsonRoutes(url,timeoutMs,label){
  const routes=[{name:"版本 API",url},{name:"AllOrigins",url:CONFIG.corsProxies[0]+encodeURIComponent(url)},{name:"CorsProxy",url:CONFIG.corsProxies[1]+encodeURIComponent(url)}];
  for(const route of routes){
    log(`${label}：嘗試 ${route.name}。`,"info");
    const result=await tryFetchJson(route.url,timeoutMs);
    if(result.ok){log(`${label}：${route.name} 成功。`,"success");return{ok:true,data:result.data,source:route.name}}
    log(`${label}：${route.name} ${result.reason}。`,"warn");
  }
  return{ok:false,data:null,source:"none"};
}
async function tryFetchJson(url,timeoutMs){
  const controller=new AbortController();let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;controller.abort()},timeoutMs);
  try{
    const response=await fetch(url,{cache:"no-store",redirect:"follow",signal:controller.signal,headers:{Accept:"application/json"}});
    if(!response.ok)return{ok:false,reason:`HTTP ${response.status}`};
    const text=await response.text();
    if(!text||/<html[\s>]/i.test(text))return{ok:false,reason:"不是 JSON 回應"};
    return{ok:true,data:JSON.parse(text)};
  }catch(error){return{ok:false,reason:timedOut?`逾時（${timeoutMs/1000} 秒）`:"網絡或 JSON 格式錯誤"}}
  finally{clearTimeout(timer)}
}
async function fetchHistoricalXml(sourceUrl,timestamp,type,label){
  const url=historicalFileUrl(sourceUrl,timestamp);
  const cached=readCache(url,type);
  if(cached){const records=parseVesselXML(cached.xml,type);if(records.length){log(`${label}：使用已儲存 XML 版本 ${timestamp}。`,"info");return{ok:true,status:"cached",records,source:"cache"}}}
  for(let attempt=1;attempt<=CONFIG.historicalFileAttempts;attempt++){
    log(`${label}：下載版本 ${timestamp}（第 ${attempt}/${CONFIG.historicalFileAttempts} 次）。`,"info");
    const result=await fetchXmlRoutes(url,type,CONFIG.historicalTimeoutMs,label);
    if(result.ok){writeCache(url,type,result.xml);return{ok:true,status:"fresh",records:result.records,source:result.source}}
    if(attempt<CONFIG.historicalFileAttempts)await sleep(200*attempt);
  }
  log(`${label}：版本 ${timestamp} 下載失敗。`,"error");
  return{ok:false,status:"failed",records:[],source:"none"};
}
async function fetchXmlRoutes(url,type,timeoutMs,label){
  const routes=[{name:"歷史檔案 API",url},{name:"AllOrigins",url:CONFIG.corsProxies[0]+encodeURIComponent(url)},{name:"CorsProxy",url:CONFIG.corsProxies[1]+encodeURIComponent(url)}];
  for(const route of routes){
    log(`${label}：嘗試 ${route.name}。`,"info");
    const result=await tryFetchXmlDetailed(route.url,type,timeoutMs);
    if(result.ok){log(`${label}：${route.name} 成功。`,"success");return{...result,source:route.name}}
    log(`${label}：${route.name} ${result.reason}。`,"warn");
  }
  return{ok:false,records:[],xml:"",source:"none"};
}
async function tryFetchXmlDetailed(url,type,timeoutMs){
  const controller=new AbortController();let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;controller.abort()},timeoutMs);
  try{
    const response=await fetch(url,{cache:"no-store",redirect:"follow",signal:controller.signal,headers:{Accept:"application/xml,text/xml,*/*"}});
    if(!response.ok)return{ok:false,records:[],xml:"",reason:`HTTP ${response.status}`};
    const xml=await response.text();
    if(xml.length<80)return{ok:false,records:[],xml:"",reason:"回應內容過短"};
    if(/<!doctype\s+html|<html[\s>]|<body[\s>]/i.test(xml))return{ok:false,records:[],xml:"",reason:"傳回 HTML 錯誤頁"};
    if(!(xml.includes("<?xml")||xml.includes("<RP0")||xml.includes("<G_SQL")))return{ok:false,records:[],xml:"",reason:"不是預期 XML"};
    const records=parseVesselXML(xml,type);
    return records.length?{ok:true,records,xml,reason:"成功"}:{ok:false,records:[],xml,reason:"XML 內沒有可辨識記錄"};
  }catch(error){return{ok:false,records:[],xml:"",reason:timedOut?`逾時（${timeoutMs/1000} 秒）`:"網絡錯誤"}}
  finally{clearTimeout(timer)}
}
function applyHistoricalPorts(rows,reportRows){
  const map=portMap(reportRows);let matched=0;
  for(const row of rows){const port=map.get(callKey(row.callSign));if(port){row.adjacentPort=port;matched++}}
  return matched;
}
function versionCacheKey(sourceUrl,archiveDate){return`${CONFIG.cachePrefix}versions:${compactDate(archiveDate)}:${hashText(sourceUrl)}`}
function hashText(value){let h=2166136261;for(const c of value){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(36)}
function readJsonCache(key,maxAgeMs){try{const obj=JSON.parse(localStorage.getItem(key)||"null");if(!obj||!obj.data)return null;if(maxAgeMs&&typeof obj.savedAt==="number"&&(Date.now()-obj.savedAt>maxAgeMs)){localStorage.removeItem(key);return null}return obj.data}catch{return null}}
function writeJsonCache(key,data){try{localStorage.setItem(key,JSON.stringify({savedAt:Date.now(),data}))}catch{}}
function cacheKey(url,type){return`${CONFIG.cachePrefix}xml:${type}:${hashText(url)}`}
function readCache(url,type){try{const v=JSON.parse(localStorage.getItem(cacheKey(url,type)));return v&&v.xml?v:null}catch{return null}}
function writeCache(url,type,xml){try{localStorage.setItem(cacheKey(url,type),JSON.stringify({savedAt:Date.now(),xml}))}catch{}}
async function fetchXMLDataEnsured(url,type,isHistorical,maxAttempts=null){
  const attempts=maxAttempts||CONFIG.maxFetchAttempts;
  for(let attempt=1;attempt<=attempts;attempt++){
    log(`${isHistorical?"歷史 API":"即時 XML"} 連線中...（第 ${attempt}/${attempts} 次）`);
    const result=await fetchXMLDataOnce(url,type,attempt);
    if(result.data.length){writeCache(url,type,result.xml);return result.data}
    if(attempt<attempts){const delay=Math.max(150,CONFIG.retryBaseDelayMs*attempt*2);log(`未取到資料，${delay}ms 後重試...`,"warn");await sleep(delay)}
  }
  const cached=readCache(url,type);
  if(cached){const rows=parseVesselXML(cached.xml,type);if(rows.length){log(`連線失敗，改用最近成功快取（${new Date(cached.savedAt).toLocaleString("zh-HK")}）`,"warn");return rows}}
  throw new Error("無法從資料來源取得任何資料（已多次重試）");
}
async function fetchXMLDataOnce(url,type,attemptNumber){
  const isMardep=url.includes("mardep.gov.hk")&&!url.includes("historical-archive");
  if(!isMardep){const direct=await tryFetchAndParse(url,type);if(direct.data.length)return direct}
  const start=((attemptNumber||1)-1)%CONFIG.corsProxies.length;
  for(let j=0;j<CONFIG.corsProxies.length;j++){
    const i=(start+j)%CONFIG.corsProxies.length;
    const via=await tryFetchAndParse(CONFIG.corsProxies[i]+encodeURIComponent(url),type);
    if(via.data.length)return via;
    if(j<CONFIG.corsProxies.length-1)await sleep(120);
  }
  return{data:[],xml:""};
}
async function tryFetchAndParse(url,type){
  try{
    const response=await fetch(url,{cache:"no-store",redirect:"follow"});
    if(!response.ok)return{data:[],xml:""};
    const xml=await response.text();
    if(xml.length<80||/<html[\s>]/i.test(xml)||!(xml.includes("<?xml")||xml.includes("<RP0")||xml.includes("<G_SQL")))return{data:[],xml:""};
    return{data:parseVesselXML(xml,type),xml};
  }catch{return{data:[],xml:""}}
}

function parseVesselXML(xmlText,type){const doc=new DOMParser().parseFromString(xmlText,"text/xml");if(doc.querySelector("parsererror"))return[];let records=[];for(const selector of ["G_SQL1","Record","record","RECORD","row","Row","ROW"]){records=[...doc.getElementsByTagName(selector)];if(records.length)break}if(!records.length&&doc.documentElement?.children.length)records=[...doc.documentElement.children];return records.map(el=>parseVesselRecord(el,type)).filter(r=>r.vesselName)}
function parseVesselRecord(element,type){
  const getVal=names=>{
    for(const name of names){
      const target=element.querySelector(name)||element.getElementsByTagName(name)[0];
      if(target?.textContent)return target.textContent.trim();
    }
    return "";
  };
  const arrival=type==="arrival";
  return{
    vesselName:getVal(["VESSEL_NAME","Vessel_Name","vessel_name","VesselName"]),
    type:arrival?"抵港":"離港",
    time:getVal(arrival
      ?["ATA_TIME","ARRIVAL_TIME","Arrival_Time","ETA_TIME","ETA"]
      :["ATD_TIME","DEPARTURE_TIME","Departure_Time","ETD_TIME","ETD","DEP_TIME"]),
    location:getVal(arrival
      ?["CURRENT_LOCATION","Current_Location","ANCHORAGE","BERTH"]
      :["LAST_BERTH","Last_Berth","BERTH","DEPARTURE_BERTH"]),
    shipType:getVal(["SHIP_TYPE","Ship_Type","ShipType"]),
    callSign:getVal(["CALL_SIGN","Call_Sign","CallSign"]),
    agentName:getVal(["AGENT_NAME","Agent_Name","AgentName"]),
    adjacentPort:getVal(arrival?["LAST_PORT","Last_Port"]:["NEXT_PORT","Next_Port"]),
    remark:getVal(["REMARK","Remark"])
  };
}

function displayResults(data,term){hideLoading();const sorted=sortByTimeAscending(dedupeRecords(Array.isArray(data)?data:[]));currentData=sorted;if(!sorted.length){$("noResults").classList.add("show");$("resultMeta").textContent="0 筆記錄";return}showMessage("successMessage",`找到 ${sorted.length} 筆記錄`);$("resultMeta").textContent=`${sorted.length} 筆記錄`;const a=sorted.filter(r=>r.type==="抵港").length;$("stats").innerHTML=stat(sorted.length,"總記錄數")+stat(a,"抵港")+stat(sorted.length-a,"離港");$("stats").classList.add("show");createTable(sorted,term)}
function stat(value,label){return`<div class="stat-item"><div class="value">${value}</div><div class="label">${label}</div></div>`}
function createTable(data,term){const isFuture=$("useFuture").checked;let cols=[["type","類型"],["vesselName","船隻名稱"],["time","時間"],["location","位置"],["adjacentPort","上一靠港／下一靠港"],["shipType","船舶類型"],["agentName","代理"]];if(isFuture)cols=cols.filter(c=>c[0]!=="location");const head=document.createElement("tr");for(const[,label]of cols){const th=document.createElement("th");th.textContent=label;head.appendChild(th)}$("tableHead").replaceChildren(head);const frag=document.createDocumentFragment();for(const record of data){const row=document.createElement("tr");for(const[key]of cols){const td=document.createElement("td"),value=record[key]||"-";if(key==="type"){const badge=document.createElement("span");badge.className=`badge ${value==="抵港"?"badge-arrival":"badge-departure"}`;badge.textContent=value;td.appendChild(badge)}else{td.textContent=value;if(term&&String(value).toUpperCase().includes(term))td.classList.add("highlight")}row.appendChild(td)}frag.appendChild(row)}$("tableBody").replaceChildren(frag);$("tableWrapper").classList.add("show")}
function clearSearch(){$("vesselName").value="";$("dataType").value="both";$("useLast36h").checked=true;$("useFuture").checked=false;setDefaultDates();syncMode("recent",true);hideLoading();clearResults()}
