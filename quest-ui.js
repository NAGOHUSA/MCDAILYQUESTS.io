/* quest-ui.js
   Frontend logic for index.html
   - Loads today's quest from GitHub /quests
   - Local progress (checkboxes)
   - Optional voting/leaderboard via Supabase if configured
*/

const RAW_BASE = "https://raw.githubusercontent.com/NAGOHUSA/MCQUESTS/main/quests";
const CONTENTS_API = "https://api.github.com/repos/NAGOHUSA/MCQUESTS/contents/quests";

const $ = (sel)=>document.querySelector(sel);
const todayStr = (d=new Date())=>{
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
};
const fmt = (n)=>Number(n||0).toLocaleString();
function toast(el,msg,cls=""){ el.textContent = msg; el.className = `hint ${cls}`; }

/** ===== State ===== */
let currentQuest = null;
let selectedStars = 0;
let userId = localStorage.getItem("mcq_userid");
if(!userId){
  userId = "u_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  localStorage.setItem("mcq_userid", userId);
}

/** ===== Fetch a quest JSON by date ===== */
async function getQuest(date){
  const url = `${RAW_BASE}/${date}.json`;
  const res = await fetch(url, {cache:"no-store"});
  if(!res.ok) throw new Error(`Quest ${date} not found (${res.status})`);
  return res.json();
}

/** ===== Load today's quest, fallback to latest in archive ===== */
async function loadToday(){
  const date = todayStr();
  $("#questDate").textContent = date;
  try{
    currentQuest = await getQuest(date);
    renderQuest(currentQuest, date);
  }catch(e){
    const items = await (await fetch(CONTENTS_API, {cache:"no-store"})).json();
    const files = (Array.isArray(items)?items:[]).filter(x=>x.type==="file" && x.name.endsWith(".json"));
    if(!files.length) throw e;
    files.sort((a,b)=> b.name.localeCompare(a.name));
    const latest = files[0].name.replace(".json","");
    $("#questDate").textContent = `${date} (showing latest available: ${latest})`;
    currentQuest = await getQuest(latest);
    renderQuest(currentQuest, latest);
  }
}

/** ===== Render quest + completion checkboxes ===== */
function renderQuest(q, dateKey){
  $("#questLoading").style.display="none";
  $("#questBox").style.display="block";

  const title = q.title || q.name || q.questTitle || "Untitled Quest";
  const lore  = q.lore || q.description || q.flavor || "";
  const steps = q.steps || q.objectives || q.tasks || [];
  const biome = q.biome || q.biome_hint || "Any";
  const reward = q.reward || q.points || "Bragging rights";
  const id = q.id || dateKey;
  const theme = q.theme || "Weekly Theme";
  const color = q.color || "#5c7cfa";

  document.documentElement.style.setProperty("--accent", color);

  $("#questTitle").textContent = title;
  $("#questLore").textContent = lore;
  $("#questBiome").textContent = "Biome: " + biome;
  $("#questReward").textContent = "Reward: " + reward;
  $("#questTheme").textContent = "Theme: " + theme;
  $("#questId").textContent = id;

  const list = $("#questSteps");
  list.innerHTML = "";
  const key = (i)=>`mcq:${id}:step:${i}:done`;
  const checkRender = ()=>{
    const total = steps.length;
    const done = steps.filter((_,i)=> localStorage.getItem(key(i))==="1").length;
    $("#questProgress").textContent = `Progress: ${done}/${total} steps complete`;
  };
  (steps || []).slice(0,3).forEach((s,i)=>{
    const wrap = document.createElement("div");
    wrap.className = "step";
    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.className = "chk";
    chk.checked = localStorage.getItem(key(i))==="1";
    const label = document.createElement("span");
    label.textContent = s;
    wrap.appendChild(chk); wrap.appendChild(label);
    if(chk.checked) wrap.classList.add("done");
    chk.addEventListener("change", ()=>{
      localStorage.setItem(key(i), chk.checked ? "1" : "0");
      wrap.classList.toggle("done", chk.checked);
      checkRender();
    });
    list.appendChild(wrap);
  });
  checkRender();

  // load stats + voting guard
  loadStats(id, theme);
  const votedKey = `voted-${id}`;
  if(localStorage.getItem(votedKey)){
    $("#voteBtn").disabled = true;
    toast($("#voteMsg"), "You already voted for this quest on this device.", "success");
  }else{
    toast($("#voteMsg"), "Tap a star, then Submit Vote.");
  }
}

/** ===== Stars UI ===== */
function wireStars(){
  const stars = [...document.querySelectorAll(".star")];
  stars.forEach(st=>{
    st.addEventListener("click", ()=>{
      selectedStars = Number(st.dataset.star);
      stars.forEach((el,i)=> el.classList.toggle("off", (i+1)>selectedStars));
    });
  });
}

/** =========================
 *  SUPABASE helpers (optional)
 *  ========================= */
function supaCfgOk(){
  return !!(window.SUPABASE_REST_URL && window.SUPABASE_ANON_KEY);
}
async function supaInsertRating({date,theme,stars}){
  const url = `${window.SUPABASE_REST_URL}/${window.SUPABASE_TABLE_RATINGS}`;
  const user_hash = await sha16(navigator.userAgent + new Date().toDateString());
  const payload = { date, theme, stars, ua: navigator.userAgent, user_hash };
  const res = await fetch(url, {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "apikey": window.SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${window.SUPABASE_ANON_KEY}`,
      "Prefer":"return=minimal"
    },
    body: JSON.stringify(payload)
  });
  return res.ok;
}
async function supaInsertVoteCompat({date,theme,stars}){
  const option = stars>=4 ? "fun" : (stars===3 ? "okay" : "hard");
  const url = `${window.SUPABASE_REST_URL}/${window.SUPABASE_TABLE_VOTES}`;
  const user_hash = await sha16(navigator.userAgent + new Date().toDateString());
  const payload = { date, theme, option, ua: navigator.userAgent, user_hash };
  const res = await fetch(url, {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "apikey": window.SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${window.SUPABASE_ANON_KEY}`,
      "Prefer":"return=minimal"
    },
    body: JSON.stringify(payload)
  });
  return res.ok;
}
async function supaGetAggregate(date){
  const urlRatings = `${window.SUPABASE_REST_URL}/${window.SUPABASE_VIEW_RATINGS_AGG}?date=eq.${encodeURIComponent(date)}`;
  const urlVotes = `${window.SUPABASE_REST_URL}/${window.SUPABASE_VIEW_VOTES_AGG}?date=eq.${encodeURIComponent(date)}`;
  const headers = { "apikey": window.SUPABASE_ANON_KEY, "Authorization": `Bearer ${window.SUPABASE_ANON_KEY}` };
  try{
    const r = await fetch(urlRatings, { headers, cache:"no-store" });
    if(r.ok){
      const arr = await r.json();
      if(Array.isArray(arr) && arr.length){
        const row = arr[0];
        return { count: Number(row.count||0), avg: Number(row.avg||0) };
      }
    }
  }catch(_) {}
  try{
    const r = await fetch(urlVotes, { headers, cache:"no-store" });
    if(r.ok){
      const rows = await r.json();
      const by = rows.reduce((m,row)=>{
        const d = row.date;
        const c = Number(row.count||0);
        const val = row.option==="fun"?5: row.option==="okay"?3:2;
        m[d] = m[d] || {count:0,sum:0};
        m[d].count += c; m[d].sum += c*val;
        return m;
      },{});
      const stat = by[date] || {count:0,sum:0};
      return { count: stat.count, avg: stat.count ? stat.sum/stat.count : 0 };
    }
  }catch(_) {}
  return { count: 0, avg: 0 };
}
async function supaGetLeaderboard(limit=10){
  const urlRatings = `${window.SUPABASE_REST_URL}/${window.SUPABASE_VIEW_RATINGS_AGG}?select=date,theme,count,avg&order=avg.desc,count.desc&limit=${limit}`;
  const urlVotes = `${window.SUPABASE_REST_URL}/${window.SUPABASE_VIEW_VOTES_AGG}?select=date,option,count&limit=10000`;
  const headers = { "apikey": window.SUPABASE_ANON_KEY, "Authorization": `Bearer ${window.SUPABASE_ANON_KEY}` };
  try{
    const r = await fetch(urlRatings, { headers, cache:"no-store" });
    if(r.ok){
      const arr = await r.json();
      if(Array.isArray(arr) && arr.length) return arr.map(x=>({date:x.date, theme:x.theme, count:Number(x.count), avg:Number(x.avg)}));
    }
  }catch(_){}
  try{
    const r = await fetch(urlVotes, { headers, cache:"no-store" });
    if(r.ok){
      const rows = await r.json();
      const byDate = {};
      rows.forEach(row=>{
        const d = row.date;
        byDate[d] = byDate[d] || {date:d, count:0, sum:0};
        const c = Number(row.count||0);
        const val = row.option==="fun"?5: row.option==="okay"?3:2;
        byDate[d].count += c;
        byDate[d].sum += c*val;
      });
      const arr = Object.values(byDate).map(x=>({date:x.date, theme:"—", count:x.count, avg: x.count? x.sum/x.count : 0}));
      arr.sort((a,b)=> b.avg - a.avg || b.count - a.count);
      return arr.slice(0, limit);
    }
  }catch(_){}
  return [];
}
async function sha16(s){
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("").slice(0,16);
}

/** ===== Submit vote ===== */
async function submitVote(){
  if(!supaCfgOk()){
    toast($("#voteMsg"), "Voting disabled (no Supabase config).", "warn");
    return;
  }
  if(!currentQuest){ return; }
  if(!selectedStars){ toast($("#voteMsg"), "Choose a rating first (1–5 stars).", "warn"); return;}

  const dateKey = $("#questId").textContent || todayStr();
  const theme = $("#questTheme").textContent.replace(/^Theme:\s*/,'') || "Theme";
  const votedKey = `voted-${dateKey}`;
  if(localStorage.getItem(votedKey)){
    toast($("#voteMsg"), "You already voted for this quest on this device.", "success"); return;
  }

  $("#voteBtn").disabled = true;
  toast($("#voteMsg"), "Submitting your vote…");

  try{
    let ok = false;
    if(!window.SUPABASE_COMPAT_VOTES){
      ok = await supaInsertRating({date:dateKey, theme, stars:selectedStars});
      if(!ok){
        ok = await supaInsertVoteCompat({date:dateKey, theme, stars:selectedStars});
      }
    }else{
      ok = await supaInsertVoteCompat({date:dateKey, theme, stars:selectedStars});
    }
    if(!ok) throw new Error("insert failed");
    localStorage.setItem(votedKey, String(selectedStars));
    toast($("#voteMsg"), "Vote saved. Thank you!", "success");
    const stats = await supaGetAggregate(dateKey);
    $("#statsLine").textContent = `Ratings: ${fmt(stats.count)} • Avg ${Number(stats.avg||0).toFixed(2)} ★`;
  }catch(err){
    console.error(err);
    $("#voteBtn").disabled = false;
    toast($("#voteMsg"), "Could not submit vote. Try again later.", "warn");
  }
}

/** ===== Stats for a given date ===== */
async function loadStats(dateKey){
  if(!supaCfgOk()){
    $("#statsLine").textContent = `Ratings: —`;
    return;
  }
  const stats = await supaGetAggregate(dateKey);
  $("#statsLine").textContent = stats.count ? `Ratings: ${fmt(stats.count)} • Avg ${Number(stats.avg||0).toFixed(2)} ★` : `Ratings: —`;
}

/** ===== Leaderboard ===== */
async function loadLeaderboard(){
  const wrap = $("#lbWrap");
  if(!supaCfgOk()){
    wrap.innerHTML = `<div class="muted">Leaderboard disabled (no Supabase config).</div>`;
    return;
  }
  const rows = await supaGetLeaderboard(10);
  if(!rows.length){ wrap.innerHTML = `<div class="muted">No ratings yet.</div>`; return; }
  const table = document.createElement("table");
  table.innerHTML = `
    <thead><tr><th>#</th><th>Date</th><th>Avg ★</th><th>Votes</th><th></th></tr></thead>
    <tbody>${rows.map((r,i)=>`
      <tr>
        <td>${i+1}</td>
        <td><a href="#" data-date="${r.date}" class="open-date">${r.date}</a></td>
        <td>${(r.avg||0).toFixed(2)}</td>
        <td>${fmt(Number(r.count||0))}</td>
        <td><span class="lb-pill">${r.theme||"—"}</span></td>
      </tr>`).join("")}</tbody>
  `;
  wrap.innerHTML = "";
  wrap.appendChild(table);

  wrap.querySelectorAll("a.open-date").forEach(a=>{
    a.addEventListener("click", async e=>{
      e.preventDefault();
      const date = a.dataset.date;
      try{
        const q = await getQuest(date);
        $("#questDate").textContent = date;
        currentQuest = q;
        renderQuest(q, date);
        window.scrollTo({top:0,behavior:"smooth"});
      }catch(_){ alert("Quest JSON not found for that date."); }
    });
  });
}

/** ===== Archive ===== */
async function loadArchive(){
  const res = await fetch(CONTENTS_API, {cache:"no-store"});
  const items = await res.json();
  const files = (Array.isArray(items)?items:[]).filter(x=>x.type==="file" && x.name.endsWith(".json"));
  files.sort((a,b)=> b.name.localeCompare(a.name));
  const container = $("#archiveList");
  container.innerHTML = "";
  if(!files.length){ container.innerHTML = `<div class="muted">No quests found yet.</div>`; return; }

  files.forEach(f=>{
    const date = f.name.replace(".json","");
    const el = document.createElement("a");
    el.href="#";
    el.innerHTML = `<span>${date}</span><span class="muted">open</span>`;
    el.addEventListener("click", async (e)=>{
      e.preventDefault();
      try{
        const q = await getQuest(date);
        $("#questDate").textContent = `${date}`;
        currentQuest = q;
        renderQuest(q, date);
        window.scrollTo({top:0,behavior:"smooth"});
      }catch(err){ alert("Could not load that quest."); }
    });
    container.appendChild(el);
  });
}

/** ===== Init ===== */
document.addEventListener("DOMContentLoaded", async ()=>{
  wireStars();
  $("#voteBtn").addEventListener("click", submitVote);
  try{
    await loadToday();
  }catch(err){
    $("#questLoading").textContent = "No quest found yet for today.";
  }
  loadArchive();
  loadLeaderboard();
});
