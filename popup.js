
let chats=[], projects=[], tab="projects", filter="all";
const LABELS={active:"Current active",hold:"Current on hold",long_hold:"Long-term hold",research:"Research"};

async function msg(m){return await chrome.runtime.sendMessage(m)}
async function load(){const s=await msg({type:"GET_STATE"});chats=s.chats||[];projects=s.projects||[];sortAll();render()}
function sortAll(){chats.sort((a,b)=>(b.lastSeen||0)-(a.lastSeen||0));projects.sort((a,b)=>(b.lastActivity||0)-(a.lastActivity||0))}
function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function projectChats(id){return chats.filter(c=>c.projectId===id)}
function daysAgo(ts){if(!ts)return "never";const d=Math.floor((Date.now()-ts)/86400000);return d===0?"today":d===1?"1 day ago":`${d} days ago`}

function render(){
  const q=document.querySelector("#search").value.trim().toLowerCase(), box=document.querySelector("#list");box.innerHTML="";
  if(tab==="projects"){
    const items=projects.filter(p=>(filter==="all"||p.status===filter)&&(!q||[p.name,p.notes,p.nextAction,p.knownGood].join(" ").toLowerCase().includes(q)));
    document.querySelector("#summary").textContent=`${projects.length} projects • ${projects.filter(p=>p.status==="active").length} active • ${chats.length} tracked chats`;
    if(!items.length){box.innerHTML='<div class="empty">No projects yet. Create one, then assign related chats to it.</div>';return}
    for(const p of items){
      const pcs=projectChats(p.id), totalTokens=pcs.reduce((n,c)=>n+(c.estimatedTokens||0),0);
      const d=document.createElement("div");d.className="card";
      d.innerHTML=`<div class="project-name">${esc(p.name)}</div>
      <div class="meta"><span>${pcs.length} chats • ~${totalTokens.toLocaleString()} tokens seen</span><span>${daysAgo(p.lastActivity)}</span></div>
      <div class="detail"><span class="label">Known good:</span> ${esc(p.knownGood||"Not recorded")}</div>
      <div class="detail"><span class="label">Next:</span> ${esc(p.nextAction||"Not recorded")}</div>
      <div class="row"><select>${Object.entries(LABELS).map(([v,l])=>`<option value="${v}" ${p.status===v?"selected":""}>${l}</option>`).join("")}</select><button class="smallbtn edit">Edit</button></div>`;
      d.querySelector("select").onchange=async e=>{await msg({type:"UPDATE_PROJECT",project:{id:p.id,status:e.target.value}});p.status=e.target.value;render()};
      d.querySelector(".edit").onclick=()=>editProject(p);
      box.appendChild(d);
    }
  } else {
    const items=chats.filter(c=>(filter==="all"||c.status===filter)&&(!q||(c.title||"").toLowerCase().includes(q)));
    document.querySelector("#summary").textContent=`${chats.length} chats • ${chats.filter(c=>c.projectId).length} assigned • ${chats.filter(c=>!c.projectId).length} unassigned`;
    if(!items.length){box.innerHTML='<div class="empty">No tracked chats in this view.</div>';return}
    for(const c of items){
      const d=document.createElement("div"),t=c.estimatedTokens||0;d.className="card"+(t>=28000?" critical":t>=18000?" hot":"");
      d.innerHTML=`<div class="title">${esc(c.title)}</div><div class="meta"><span>${c.messages||0} messages</span><span>~${Number(t).toLocaleString()} tokens</span></div>
      <div class="row"><select class="projectSel"><option value="">Unassigned</option>${projects.map(p=>`<option value="${p.id}" ${c.projectId===p.id?"selected":""}>${esc(p.name)}</option>`).join("")}</select><a class="open" href="${c.url}" target="_blank">Open</a></div>`;
      d.querySelector(".projectSel").onchange=async e=>{await msg({type:"ASSIGN_CHAT",chatId:c.id,projectId:e.target.value||null});c.projectId=e.target.value||null;render()};
      box.appendChild(d);
    }
  }
}

async function newProject(){
  const name=prompt("Project name:"); if(!name?.trim())return;
  const r=await msg({type:"CREATE_PROJECT",project:{name:name.trim(),status:"active"}});
  if(r?.project){projects.push(r.project);sortAll();render()}
}
async function editProject(p){
  const knownGood=prompt("Latest known-good state:",p.knownGood||""); if(knownGood===null)return;
  const nextAction=prompt("Next action:",p.nextAction||""); if(nextAction===null)return;
  const deps=prompt("Dependencies (comma separated):",(p.dependencies||[]).join(", ")); if(deps===null)return;
  const notes=prompt("Project notes:",p.notes||""); if(notes===null)return;
  const patch={id:p.id,knownGood,nextAction,dependencies:deps.split(",").map(x=>x.trim()).filter(Boolean),notes};
  await msg({type:"UPDATE_PROJECT",project:patch});Object.assign(p,patch);render();
}
async function exportState(){
  const s=await msg({type:"EXPORT_STATE"}), blob=new Blob([JSON.stringify({...s,exportedAt:new Date().toISOString(),version:"0.2.0"},null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="project-session-manager-backup.json";a.click();URL.revokeObjectURL(a.href);
}
async function importState(file){
  const data=JSON.parse(await file.text());await msg({type:"IMPORT_STATE",data});await load();
}
document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tabs button").forEach(x=>x.classList.remove("active"));b.classList.add("active");tab=b.dataset.tab;render()});
document.querySelectorAll(".filters button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".filters button").forEach(x=>x.classList.remove("active"));b.classList.add("active");filter=b.dataset.filter;render()});
document.querySelector("#search").addEventListener("input",render);document.querySelector("#options").onclick=()=>chrome.runtime.openOptionsPage();
document.querySelector("#newProject").onclick=newProject;document.querySelector("#exportBtn").onclick=exportState;document.querySelector("#importBtn").onclick=()=>document.querySelector("#importFile").click();
document.querySelector("#importFile").onchange=e=>e.target.files[0]&&importState(e.target.files[0]);load();
