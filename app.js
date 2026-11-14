import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const $=id=>document.getElementById(id);
const DAY=86400000;
let startAt,goalDays=7,breathInterval=null;
const today=()=>new Date().toISOString().slice(0,10);
const fmtDate=d=>new Date(d).toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"});
function toast(msg){const el=$("toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2400)}
function safeText(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function init(){
 await FightDB.open();
 startAt=await FightDB.stateGet("startAt"); if(!startAt){startAt=Date.now();await FightDB.stateSet("startAt",startAt);}
 goalDays=await FightDB.stateGet("goalDays")||7;
 const theme=await FightDB.stateGet("theme")||"system";$("themeSelect").value=theme;applyTheme(theme);
 const notify=await FightDB.stateGet("notify")||{enabled:false,time:"20:00"};$("notifyEnabled").checked=notify.enabled;$("notifyTime").value=notify.time;
 if(notify.enabled && Capacitor.isNativePlatform()){try{await scheduleDailyReminder(notify.time,false);}catch(err){console.warn("Reminder restore failed:",err);}}
 $("promiseText").value=await FightDB.stateGet("promise")||"";
 const pin=await FightDB.stateGet("pin");$("pinStatus").textContent=pin?"PIN aktif":"Belum diatur";
 if(pin){$("lockScreen").classList.remove("hidden");}
 bind();render();tick();setInterval(tick,1000);
}
function bind(){
 document.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.page)));
 $("quickSettings").onclick=()=>showPage("settings");
 document.querySelectorAll("#targetChoices button").forEach(b=>b.onclick=()=>setGoal(+b.dataset.days));
 $("setCustomGoal").onclick=()=>{const n=+$("customDays").value;if(n<1||n>3650)return toast("Masukkan target 1–3650 hari.");setGoal(n);};
 $("resetBtn").onclick=resetTimer;
 $("saveJournal").onclick=saveJournal;
 $("themeSelect").onchange=async e=>{await FightDB.stateSet("theme",e.target.value);applyTheme(e.target.value);};
 $("setPin").onclick=setPin;$("removePin").onclick=removePin;$("unlockBtn").onclick=unlock;
 $("saveNotifications").onclick=saveNotifications;$("exportData").onclick=exportData;$("importData").onchange=importData;$("clearData").onclick=clearData;
 $("savePromise").onclick=async()=>{await FightDB.stateSet("promise",$("promiseText").value);toast("Pengingat pribadi disimpan.");};
 $("breathBtn").onclick=breathing;$("unlockPin").addEventListener("keydown",e=>{if(e.key==="Enter")unlock();});
}
function showPage(name){document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id==="page-"+name));document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===name));if(name==="history")renderHistory();if(name==="statistics")renderStats();if(name==="target")renderTargets();window.scrollTo(0,0);}
function applyTheme(theme){const resolved=theme==="system"?(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):theme;document.documentElement.dataset.theme=resolved;}
function tick(){
 const now=Date.now(),elapsed=Math.max(0,now-startAt),days=Math.floor(elapsed/DAY),hours=Math.floor(elapsed%DAY/3600000),mins=Math.floor(elapsed%3600000/60000),secs=Math.floor(elapsed%60000/1000);
 $("liveClock").textContent=new Date().toLocaleTimeString("id-ID",{hour12:false});
 $("todayDate").textContent=new Date().toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).toUpperCase();
 $("streakDays").innerHTML=`${days} <small>hari</small>`;$("timerHours").textContent=String(hours).padStart(2,"0");$("timerMinutes").textContent=String(mins).padStart(2,"0");$("timerSeconds").textContent=String(secs).padStart(2,"0");
 const p=Math.min(100,days/goalDays*100);$("goalProgress").style.width=p+"%";$("goalPercent").textContent=Math.floor(p)+"%";$("goalLabel").textContent=`Target ${goalDays} hari`;
}
async function setGoal(n){goalDays=n;await FightDB.stateSet("goalDays",n);render();toast(`Target diatur menjadi ${n} hari.`);}
async function resetTimer(){
 if(!confirm("Catat kemunduran dan mulai ulang timer? Riwayat sebelumnya tetap disimpan."))return;
 await FightDB.add("events",{type:"reset",date:new Date().toISOString(),previousStart:startAt,streakDays:Math.floor((Date.now()-startAt)/DAY)});
 startAt=Date.now();await FightDB.stateSet("startAt",startAt);render();toast("Timer dimulai kembali. Lanjutkan langkah berikutnya.");
}
async function saveJournal(){const text=$("journalText").value.trim();if(!text)return toast("Tulis catatan terlebih dahulu.");await FightDB.add("journals",{date:new Date().toISOString(),text});$("journalText").value="";renderHistory();toast("Jurnal tersimpan di perangkat.");}
async function render(){
 const events=await FightDB.all("events"),journals=await FightDB.all("journals"),days=Math.floor((Date.now()-startAt)/DAY);
 const best=Math.max(days,...events.map(e=>e.streakDays||0));$("bestRecord").textContent=best+" hari";$("activeGoal").textContent=goalDays+" hari";$("targetCurrent").textContent=goalDays+" hari";$("targetDescription").textContent=days>=goalDays?"Target tercapai. Kamu bisa memilih target berikutnya.":`${Math.max(0,goalDays-days)} hari lagi menuju target.`;
 $("statCurrent").textContent=days;$("statBest").textContent=best;$("completedGoals").textContent=events.filter(e=>e.type==="goal").length;$("journalCount").textContent=journals.length;$("resetCount").textContent=events.filter(e=>e.type==="reset").length;
 renderTargets();renderHistory();renderStats();
}
async function renderTargets(){
 document.querySelectorAll("#targetChoices button").forEach(b=>b.classList.toggle("selected",+b.dataset.days===goalDays));
 const days=Math.floor((Date.now()-startAt)/DAY);const a=[7,14,30,60,90].map(n=>`<div class="achievement">${days>=n?"🏆":"🔒"} <b>${n} hari</b> — ${days>=n?"Tercapai":"Belum tercapai"}</div>`);$("achievements").innerHTML=a.join("");
}
async function renderHistory(){
 const events=await FightDB.all("events"),journals=await FightDB.all("journals);").catch(()=>[]);
 const js=await FightDB.all("journals");const marked=new Set([...events.map(e=>e.date.slice(0,10)),...js.map(j=>j.date.slice(0,10))]);
 const now=new Date(),first=new Date(now.getFullYear(),now.getMonth(),1),last=new Date(now.getFullYear(),now.getMonth()+1,0),names=["Min","Sen","Sel","Rab","Kam","Jum","Sab"];
 let html=names.map(n=>`<div class="day-name">${n}</div>`).join("");for(let i=0;i<first.getDay();i++)html+="<div></div>";for(let d=1;d<=last.getDate();d++){const key=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;html+=`<div class="${marked.has(key)?"marked":""}">${d}</div>`;}$("calendar").innerHTML=html;
 const items=[...events.map(e=>({date:e.date,title:e.type==="reset"?"Timer dimulai ulang":"Target tercapai",detail:`Rekor sebelumnya: ${e.streakDays||0} hari`})),...js.map(j=>({date:j.date,title:"Jurnal pribadi",detail:j.text}))].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,15);
 $("historyList").innerHTML=items.length?items.map(i=>`<div class="history-item"><b>${safeText(i.title)} • ${fmtDate(i.date)}</b><span>${safeText(i.detail)}</span></div>`).join(""):'<p class="muted small">Belum ada riwayat. Catatanmu akan muncul di sini.</p>';
}
async function renderStats(){
 const events=await FightDB.all("events"),journals=await FightDB.all("journals"),days=Math.floor((Date.now()-startAt)/DAY);$("statCurrent").textContent=days;$("statBest").textContent=Math.max(days,...events.map(e=>e.streakDays||0));$("completedGoals").textContent=events.filter(e=>e.type==="goal").length;$("journalCount").textContent=journals.length;$("resetCount").textContent=events.filter(e=>e.type==="reset").length;
 const labels=["Min","Sen","Sel","Rab","Kam","Jum","Sab"],now=new Date(),vals=labels.map((_,i)=>{const d=new Date(now);d.setDate(now.getDate()-((now.getDay()-i+7)%7));const k=d.toISOString().slice(0,10);return journals.some(j=>j.date.slice(0,10)===k)||events.some(e=>e.date.slice(0,10)===k)?1:0;});
 $("weekBars").innerHTML=vals.map((v,i)=>`<div><i style="height:${v?65:9}px"></i>${labels[i]}</div>`).join("");
}
async function setPin(){const pin=$("newPin").value;if(!/^\d{4,6}$/.test(pin))return toast("PIN harus terdiri dari 4–6 angka.");const salt=crypto.getRandomValues(new Uint8Array(16));const hash=await hashPin(pin,salt);await FightDB.stateSet("pin",{salt:Array.from(salt),hash});$("newPin").value="";$("pinStatus").textContent="PIN aktif";toast("PIN berhasil diatur.");}
async function hashPin(pin,salt){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(pin),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:150000,hash:"SHA-256"},key,256);return Array.from(new Uint8Array(bits)).map(x=>x.toString(16).padStart(2,"0")).join("");}
async function unlock(){const pin=$("unlockPin").value,record=await FightDB.stateGet("pin");if(!record)return $("lockScreen").classList.add("hidden");const hash=await hashPin(pin,new Uint8Array(record.salt));if(hash===record.hash){$("lockScreen").classList.add("hidden");$("unlockPin").value="";$("lockMessage").textContent="";}else{$("lockMessage").textContent="PIN tidak sesuai.";}}
async function removePin(){if(!confirm("Nonaktifkan kunci PIN?"))return;await FightDB.stateSet("pin",null);$("pinStatus").textContent="Belum diatur";toast("PIN dinonaktifkan.");}
const REMINDER_NOTIFICATION_ID=24001;
const REMINDER_CHANNEL_ID="fighton-reminders";
async function scheduleDailyReminder(time,askPermission=true){
 if(!Capacitor.isNativePlatform()){
  toast("Notifikasi saat aplikasi ditutup memerlukan Fight On versi APK Android, bukan file HTML langsung.");
  return false;
 }
 let permission=await LocalNotifications.checkPermissions();
 if(permission.display!=="granted" && askPermission) permission=await LocalNotifications.requestPermissions();
 if(permission.display!=="granted"){
  toast("Izin notifikasi belum diberikan. Aktifkan izin Fight On di pengaturan Android.");
  return false;
 }
 const [hour,minute]=String(time||"20:00").split(":").map(Number);
 if(!Number.isInteger(hour)||!Number.isInteger(minute)||hour<0||hour>23||minute<0||minute>59){
  toast("Waktu pengingat tidak valid.");
  return false;
 }
 await LocalNotifications.createChannel({id:REMINDER_CHANNEL_ID,name:"Pengingat Fight On",description:"Pengingat harian Fight On",importance:3});
 await LocalNotifications.cancel({notifications:[{id:REMINDER_NOTIFICATION_ID}]});
 await LocalNotifications.schedule({notifications:[{
  id:REMINDER_NOTIFICATION_ID,
  title:"Fight On — Waktunya konsisten!",
  body:"Luangkan waktu sebentar untuk mengecek target harianmu. Satu langkah kecil tetap berarti.",
  channelId:REMINDER_CHANNEL_ID,
  schedule:{on:{hour,minute},repeats:true,allowWhileIdle:true}
 }]});
 return true;
}
async function saveNotifications(){
 const value={enabled:$("notifyEnabled").checked,time:$("notifyTime").value||"20:00"};
 if(value.enabled){
  const scheduled=await scheduleDailyReminder(value.time,true);
  if(!scheduled)return;
 }else if(Capacitor.isNativePlatform()){
  await LocalNotifications.cancel({notifications:[{id:REMINDER_NOTIFICATION_ID}]});
 }
 await FightDB.stateSet("notify",value);
 toast(value.enabled?`Pengingat harian aktif pukul ${value.time}.`:("Pengingat harian dinonaktifkan."));
}
async function exportData(){const data=await FightDB.dump(),blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="fight-on-backup.json";a.click();URL.revokeObjectURL(url);toast("Backup dibuat.");}
async function importData(e){const f=e.target.files[0];if(!f)return;try{const data=JSON.parse(await f.text());if(!data.state||!Array.isArray(data.events)||!Array.isArray(data.journals))throw Error();if(!confirm("Impor akan mengganti data aplikasi saat ini. Lanjutkan?"))return;await FightDB.restore(data);location.reload();}catch{toast("File backup tidak valid.");}e.target.value="";}
async function clearData(){if(!confirm("Hapus seluruh data Fight On dari perangkat ini? Tindakan ini tidak bisa dibatalkan."))return;await FightDB.clear();location.reload();}
function breathing(){const panel=document.querySelector(".breathing");if(breathInterval){clearInterval(breathInterval);breathInterval=null;panel.classList.remove("running");$("breathBtn").textContent="Mulai jeda";$("breathStatus").textContent="Jeda selesai. Pilih satu aktivitas positif.";return;}let n=60;panel.classList.add("running");$("breathBtn").textContent="Akhiri jeda";$("breathStatus").textContent="60 detik";breathInterval=setInterval(()=>{n--;$("breathStatus").textContent=n+" detik tersisa";if(n<=0){clearInterval(breathInterval);breathInterval=null;panel.classList.remove("running");$("breathBtn").textContent="Mulai jeda";$("breathStatus").textContent="Selesai. Bagus, kamu sudah mengambil jeda."; }},1000);}
init().catch(err=>{console.error(err);toast("Gagal membuka database lokal.");});