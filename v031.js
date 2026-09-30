(() => {
  const DEFAULTS = {
    autoFollowLive: true,
    autoFollowThresholdPx: 220,
    projectInference: true
  };

  const S = {
    settings: {...DEFAULTS},
    pausedByUser: false,
    programmatic: false,
    lastScrollTop: 0,
    lastHeight: 0,
    lastUrl: location.href,
    inferredUrl: null,
    boundScroller: null,
    streaming: false,
    streamStartedAt: 0,
    streamEndedAt: 0,
    streamWasFollowable: false,
    pollTimer: null,
    lastFollowAt: 0
  };

  const esc = (s='') => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

  async function loadSettings() {
    const x = await chrome.storage.local.get(DEFAULTS);
    S.settings = {...DEFAULTS, ...x};
  }

  function candidates() {
    const arr = [];
    const main = document.querySelector('main');
    if (main) {
      arr.push(main);
      let p = main.parentElement;
      for (let i=0; p && i<6; i++, p=p.parentElement) arr.push(p);
    }
    arr.push(document.scrollingElement);
    document.querySelectorAll('div,section').forEach(el => {
      const st = getComputedStyle(el);
      if (/(auto|scroll)/.test(st.overflowY) && el.scrollHeight > el.clientHeight + 120) arr.push(el);
    });
    return [...new Set(arr.filter(Boolean))];
  }

  function getScroller() {
    let best = document.scrollingElement;
    let bestScore = -1;
    for (const el of candidates()) {
      try {
        if (el.scrollHeight <= el.clientHeight + 80) continue;
        const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : {width:innerWidth,height:innerHeight};
        const score = Math.min(el.scrollHeight, 200000) + Math.max(0, rect.width) * 2 + Math.max(0, rect.height) * 4;
        if (score > bestScore) { bestScore = score; best = el; }
      } catch {}
    }
    return best || document.scrollingElement;
  }

  function distBottom(el) {
    return Math.max(0, el.scrollHeight - el.clientHeight - el.scrollTop);
  }

  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect?.();
    const st = getComputedStyle(el);
    return !!r && r.width > 0 && r.height > 0 && st.display !== 'none' && st.visibility !== 'hidden';
  }

  function isStreamingNow() {
    const strong = [
      'button[data-testid="stop-button"]',
      '[data-testid="stop-button"]',
      'button[aria-label="Stop generating"]',
      'button[aria-label*="Stop generating" i]',
      'button[title*="Stop generating" i]'
    ];
    for (const sel of strong) {
      const el = document.querySelector(sel);
      if (el && isVisible(el)) return true;
    }

    for (const b of document.querySelectorAll('button')) {
      if (!isVisible(b)) continue;
      const label = `${b.getAttribute('aria-label') || ''} ${b.getAttribute('title') || ''} ${b.innerText || ''}`.trim().toLowerCase();
      if (label === 'stop' || label.includes('stop generating') || label.includes('stop response')) return true;
    }

    const marker = document.querySelector(
      '[data-is-streaming="true"], [data-streaming="true"], .result-streaming, [class~="result-streaming"]'
    );
    return !!marker && isVisible(marker);
  }

  function ensureFollowButton() {
    let btn = document.getElementById('psm-v031-resume-follow');
    if (btn) return btn;
    btn = document.createElement('button');
    btn.id = 'psm-v031-resume-follow';
    btn.type = 'button';
    btn.textContent = '↓ Resume live follow';
    btn.style.cssText = 'display:none;position:fixed;right:18px;bottom:175px;z-index:2147483647;border:1px solid #555;border-radius:999px;padding:8px 12px;background:#202124;color:#fff;box-shadow:0 5px 18px rgba(0,0,0,.3);font:12px system-ui;cursor:pointer';
    btn.onclick = () => {
      refreshStreamingState();
      if (!S.streaming) return;
      S.pausedByUser = false;
      S.streamWasFollowable = true;
      follow(true);
      renderFollowState();
    };
    document.body.appendChild(btn);
    return btn;
  }

  function ensureStreamBadge() {
    let badge = document.getElementById('psm-v031-stream-state');
    if (badge) return badge;
    badge = document.createElement('div');
    badge.id = 'psm-v031-stream-state';
    badge.style.cssText = 'display:none;position:fixed;right:18px;bottom:142px;z-index:2147483646;padding:4px 8px;border-radius:999px;background:rgba(32,33,36,.92);color:#b7f7c5;border:1px solid #3f5f47;font:11px system-ui;pointer-events:none';
    badge.textContent = '● Live reply';
    document.body.appendChild(badge);
    return badge;
  }

  function renderFollowState() {
    const btn = ensureFollowButton();
    const badge = ensureStreamBadge();
    const canResume = S.settings.autoFollowLive && S.streaming && S.pausedByUser;
    btn.style.display = canResume ? 'block' : 'none';
    badge.style.display = (S.settings.autoFollowLive && S.streaming) ? 'block' : 'none';
  }

  function bindScroller(el) {
    if (!el || S.boundScroller === el) return;
    S.boundScroller = el;
    S.lastScrollTop = el.scrollTop;
    el.addEventListener('scroll', () => {
      const now = el.scrollTop;
      const delta = now - S.lastScrollTop;
      S.lastScrollTop = now;
      if (S.programmatic || !S.streaming) return;

      const near = distBottom(el) <= Number(S.settings.autoFollowThresholdPx || 220);
      if (delta < -6 && !near) {
        S.pausedByUser = true;
        S.streamWasFollowable = false;
      } else if (near) {
        S.pausedByUser = false;
        S.streamWasFollowable = true;
      }
      renderFollowState();
    }, {passive:true});
  }

  function follow(smooth=false) {
    if (!S.settings.autoFollowLive || !S.streaming || S.pausedByUser || !S.streamWasFollowable) return;
    const el = getScroller();
    bindScroller(el);
    if (!el) return;

    const now = performance.now();
    if (!smooth && now - S.lastFollowAt < 45) return;
    S.lastFollowAt = now;

    S.programmatic = true;
    try { el.scrollTo({top:el.scrollHeight, behavior:smooth?'smooth':'auto'}); }
    catch { el.scrollTop = el.scrollHeight; }
    setTimeout(() => { S.programmatic = false; }, 100);
  }

  function onStreamStart() {
    const el = getScroller();
    bindScroller(el);
    const threshold = Number(S.settings.autoFollowThresholdPx || 220);
    const near = el ? distBottom(el) <= threshold : true;

    S.streaming = true;
    S.streamStartedAt = Date.now();
    S.pausedByUser = !near;
    S.streamWasFollowable = near;
    S.lastHeight = el?.scrollHeight || 0;

    if (near) follow(false);
    renderFollowState();
  }

  function onStreamEnd() {
    S.streaming = false;
    S.streamEndedAt = Date.now();
    S.streamWasFollowable = false;
    S.lastHeight = getScroller()?.scrollHeight || 0;
    renderFollowState();
  }

  function refreshStreamingState() {
    const now = isStreamingNow();
    if (now && !S.streaming) onStreamStart();
    else if (!now && S.streaming) onStreamEnd();
    return S.streaming;
  }

  function streamingGrowthTick() {
    if (!S.settings.autoFollowLive) return;
    if (!refreshStreamingState()) return;

    const el = getScroller();
    bindScroller(el);
    if (!el) return;

    const h = el.scrollHeight;
    const grew = h > S.lastHeight + 2;
    S.lastHeight = h;
    if (grew) follow(false);
  }

  function currentChatId() {
    return btoa(unescape(encodeURIComponent(location.href.split('#')[0]))).replace(/[/+=]/g,'').slice(-40);
  }

  function getTitle() {
    const t = document.title?.replace(/\s*[-|]\s*ChatGPT.*$/i,'').trim();
    return (t && t.toLowerCase() !== 'chatgpt') ? t : (document.querySelector('h1')?.innerText.trim() || 'Untitled Chat');
  }

  function norm(s='') { return s.toLowerCase().replace(/[^a-z0-9\s_-]+/g,' ').replace(/\s+/g,' ').trim(); }
  function words(s='') { return new Set(norm(s).split(' ').filter(x => x.length >= 3)); }

  async function inferProject() {
    if (!S.settings.projectInference || S.inferredUrl === location.href) return;
    S.inferredUrl = location.href;
    const {psmProjects={}, psmChats={}} = await chrome.storage.local.get(['psmProjects','psmChats']);
    const id = currentChatId();
    if (psmChats[id]?.projectId) return;
    const projects = Object.values(psmProjects);
    if (!projects.length) return;

    const visible = Array.from(document.querySelectorAll('[data-message-author-role], main article')).slice(0,20).map(x=>x.innerText||'').join(' ').slice(0,7000);
    const hay = norm(getTitle() + ' ' + visible);
    const hw = words(hay);
    let best = null;
    for (const p of projects) {
      let score = 0;
      for (const n of [p.name, ...(p.aliases||[])].filter(Boolean)) {
        const nn = norm(n);
        if (nn && hay.includes(nn)) score += 12;
        for (const w of words(nn)) if (hw.has(w)) score += 2;
      }
      const ctx = [p.knownGood,p.nextAction,p.notes,...(p.dependencies||[])].filter(Boolean).join(' ');
      for (const w of words(ctx)) if (hw.has(w)) score += 0.4;
      if (!best || score > best.score) best = {p,score};
    }
    if (!best || best.score < 4) return;
    showInference(best.p, best.score >= 12 ? 'high' : best.score >= 7 ? 'medium' : 'low', id);
  }

  function showInference(project, confidence, chatId) {
    document.getElementById('psm-v031-inference')?.remove();
    const box = document.createElement('div');
    box.id = 'psm-v031-inference';
    box.style.cssText = 'position:fixed;right:18px;bottom:220px;z-index:2147483647;width:290px;padding:10px;border:1px solid #45484f;border-radius:10px;background:#18191d;color:#eee;box-shadow:0 6px 20px rgba(0,0,0,.35);font:12px system-ui';
    box.innerHTML = `<div>Suggested project: <strong>${esc(project.name)}</strong></div><div style="color:#999;margin:3px 0 8px">Confidence: ${confidence}</div><div style="display:flex;gap:6px"><button data-a="assign">Assign</button><button data-a="dismiss">Dismiss</button></div>`;
    box.querySelectorAll('button').forEach(b => b.style.cssText='flex:1;border:1px solid #444;border-radius:7px;padding:6px;background:#27292e;color:#eee;cursor:pointer');
    box.querySelector('[data-a="dismiss"]').onclick = () => box.remove();
    box.querySelector('[data-a="assign"]').onclick = async () => {
      const {psmChats={}} = await chrome.storage.local.get(['psmChats']);
      if (psmChats[chatId]) {
        psmChats[chatId].projectId = project.id;
        psmChats[chatId].updatedAt = Date.now();
        await chrome.storage.local.set({psmChats});
      }
      box.remove();
    };
    document.body.appendChild(box);
  }

  const observer = new MutationObserver(() => {
    streamingGrowthTick();
  });

  async function init() {
    await loadSettings();
    ensureFollowButton();
    ensureStreamBadge();
    bindScroller(getScroller());
    S.lastHeight = getScroller()?.scrollHeight || 0;
    refreshStreamingState();

    observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','data-testid','data-is-streaming','data-streaming']});

    S.pollTimer = setInterval(() => {
      refreshStreamingState();
      if (S.streaming) streamingGrowthTick();
    }, 180);

    setTimeout(inferProject,1800);
    setInterval(() => {
      if (location.href !== S.lastUrl) {
        S.lastUrl = location.href;
        S.pausedByUser = false;
        S.inferredUrl = null;
        S.lastHeight = 0;
        S.streaming = false;
        S.streamWasFollowable = false;
        setTimeout(() => {
          bindScroller(getScroller());
          S.lastHeight = getScroller()?.scrollHeight || 0;
          refreshStreamingState();
          inferProject();
        },1000);
      }
      renderFollowState();
    },1000);
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const k of Object.keys(DEFAULTS)) if (changes[k]) S.settings[k] = changes[k].newValue;
    renderFollowState();
  });

  init();
})();
