
(() => {
  const STATE = { lastUrl:location.href, lastWarningLevel:0, settings:null, projects:[] };
  const qsa = s => Array.from(document.querySelectorAll(s));

  function slugId(url) {
    return btoa(unescape(encodeURIComponent(url))).replace(/[/+=]/g,"").slice(-40);
  }
  function title() {
    const t=document.title?.replace(/\s*[-|]\s*ChatGPT.*$/i,"").trim();
    if (t && t.toLowerCase()!=="chatgpt") return t;
    return document.querySelector("h1")?.innerText.trim() || "Untitled Chat";
  }
  function nodes() {
    let n=qsa('[data-message-author-role]');
    if (!n.length) n=qsa('main article');
    return n.filter(x=>x.innerText?.trim());
  }
  function stats() {
    const n=nodes(), text=n.map(x=>x.innerText.trim()).join("\n");
    const chars=text.length, words=(text.match(/\S+/g)||[]).length;
    return {messages:n.length, chars, words, estimatedTokens:Math.max(Math.ceil(chars/4), Math.ceil(words*1.33))};
  }
  function autoStatus(t) {
    t=t.toLowerCase();
    if (/\b(research|investigat|compare|study|explore)\b/.test(t)) return "research";
    if (/\b(long.?term|backlog|someday|future)\b/.test(t)) return "long_hold";
    if (/\b(hold|paused|pause|defer|later)\b/.test(t)) return "hold";
    return "active";
  }
  const pretty = s => ({active:"Current active",hold:"Current on hold",long_hold:"Long-term hold",research:"Research"})[s]||s;

  async function send(m){ return await chrome.runtime.sendMessage(m); }

  async function currentProject(chatId) {
    const state=await send({type:"GET_STATE"});
    STATE.projects=state.projects||[];
    const chat=(state.chats||[]).find(c=>c.id===chatId);
    return STATE.projects.find(p=>p.id===chat?.projectId) || null;
  }

  function handover(meta, project) {
    const dep = project?.dependencies?.length ? project.dependencies.join(", ") : "None recorded";
    return `Continue this project in a new ChatGPT session.

PROJECT: ${project?.name || meta.title}
PROJECT STATUS: ${pretty(project?.status || meta.status)}
SOURCE CHAT: ${meta.url}

LATEST KNOWN-GOOD STATE:
${project?.knownGood || "[Not yet recorded]"}

NEXT ACTION:
${project?.nextAction || "[Not yet recorded]"}

DEPENDENCIES:
${dep}

PROJECT NOTES:
${project?.notes || "[No project notes recorded]"}

SESSION SIZE AT HANDOVER:
- Messages: ${meta.messages}
- Estimated tokens: ${meta.estimatedTokens.toLocaleString()}
- Characters: ${meta.chars.toLocaleString()}

CONTINUATION RULES:
- Preserve established architecture, naming, safety constraints, exclusions, versions and known-good states.
- Treat this as a continuation, not a redesign.
- Keep live systems stable and changes reversible.
- State assumptions when handover evidence is incomplete.
- Continue from NEXT ACTION unless a blocking dependency is identified.`;
  }

  function ensureBox() {
    let b=document.getElementById("psm-project-meter");
    if (!b) {
      b=document.createElement("div"); b.id="psm-project-meter";
      b.innerHTML=`
        <div class="psm-meter-top"><strong>Session</strong><button id="psm-meter-close">×</button></div>
        <div id="psm-project-name" class="psm-project-name"></div>
        <div id="psm-meter-status"></div>
        <div class="psm-meter-bar"><div id="psm-meter-fill"></div></div>
        <div id="psm-meter-counts"></div>
        <div class="psm-meter-actions"><button id="psm-copy-handover">Copy continuation prompt</button></div>`;
      document.body.appendChild(b);
      b.querySelector("#psm-meter-close").onclick=()=>b.style.display="none";
    }
    return b;
  }
  function toast(s) {
    document.getElementById("psm-project-toast")?.remove();
    const t=document.createElement("div"); t.id="psm-project-toast"; t.textContent=s; document.body.appendChild(t);
    setTimeout(()=>t.remove(),7000);
  }

  async function update() {
    STATE.settings ||= await send({type:"GET_SETTINGS"});
    const s=stats(), t=title(), id=slugId(location.href.split("#")[0]);
    const meta={id,title:t,url:location.href,status:autoStatus(t),messages:s.messages,words:s.words,chars:s.chars,estimatedTokens:s.estimatedTokens,lastActivity:Date.now()};
    await send({type:"SAVE_CHAT", chat:meta});
    const project=await currentProject(id);

    if (!STATE.settings.showFloatingStatus) return;
    const b=ensureBox(); b.style.display="";
    b.querySelector("#psm-project-name").textContent=project ? `Project: ${project.name}` : "Unassigned project chat";

    const warn=Number(STATE.settings.warnTokens||18000), crit=Number(STATE.settings.criticalTokens||28000), msgWarn=Number(STATE.settings.warnMessages||120);
    let level=0; if (s.estimatedTokens>=warn || s.messages>=msgWarn) level=1; if (s.estimatedTokens>=crit) level=2;
    b.classList.toggle("warn",level===1); b.classList.toggle("critical",level===2);
    b.querySelector("#psm-meter-fill").style.width=Math.min(100,Math.round((s.estimatedTokens/crit)*100))+"%";
    b.querySelector("#psm-meter-status").textContent=level===2?"Continuation strongly recommended":level===1?"Approaching long-session threshold":"Session size healthy";
    b.querySelector("#psm-meter-counts").textContent=`${s.messages} messages • ~${s.estimatedTokens.toLocaleString()} tokens`;

    const btn=b.querySelector("#psm-copy-handover");
    btn.onclick=async()=>{ await navigator.clipboard.writeText(handover(meta,project)); btn.textContent="Copied"; setTimeout(()=>btn.textContent="Copy continuation prompt",1400); };

    if (level>STATE.lastWarningLevel && level>0) {
      toast(level===2 ? "This chat is very large. A new continuation session is strongly recommended." : "This chat is getting long. Prepare a continuation handover soon.");
      STATE.lastWarningLevel=level;
    }
  }
  setInterval(()=>{ if(STATE.lastUrl!==location.href){STATE.lastUrl=location.href;STATE.lastWarningLevel=0;setTimeout(update,1200)}},1000);
  setInterval(update,20000);
  setTimeout(update,1500);
})();
