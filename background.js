
const DEFAULTS = {
  warnTokens: 18000,
  criticalTokens: 28000,
  warnMessages: 120,
  scanIntervalSec: 20,
  autoClassify: true,
  showFloatingStatus: true,
  staleHoldDays: 10,
  staleLongHoldDays: 30
};

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(Object.keys(DEFAULTS));
  const updates = {};
  for (const [k,v] of Object.entries(DEFAULTS)) {
    if (current[k] === undefined) updates[k] = v;
  }
  if (Object.keys(updates).length) await chrome.storage.local.set(updates);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg?.type) {
      case "GET_SETTINGS":
        sendResponse(await chrome.storage.local.get(DEFAULTS));
        break;
      case "SAVE_CHAT":
        await saveChat(msg.chat);
        sendResponse({ok:true});
        break;
      case "GET_CHATS": {
        const {psmChats={}} = await chrome.storage.local.get(["psmChats"]);
        sendResponse(Object.values(psmChats));
        break;
      }
      case "GET_PROJECTS": {
        const {psmProjects={}} = await chrome.storage.local.get(["psmProjects"]);
        sendResponse(Object.values(psmProjects));
        break;
      }
      case "GET_STATE": {
        const {psmChats={}, psmProjects={}} = await chrome.storage.local.get(["psmChats","psmProjects"]);
        sendResponse({chats:Object.values(psmChats), projects:Object.values(psmProjects)});
        break;
      }
      case "SET_STATUS":
        await setStatus(msg.id, msg.status);
        sendResponse({ok:true});
        break;
      case "CREATE_PROJECT":
        sendResponse(await createProject(msg.project || {}));
        break;
      case "UPDATE_PROJECT":
        sendResponse(await updateProject(msg.project || {}));
        break;
      case "ASSIGN_CHAT":
        sendResponse(await assignChat(msg.chatId, msg.projectId));
        break;
      case "UNASSIGN_CHAT":
        sendResponse(await assignChat(msg.chatId, null));
        break;
      case "EXPORT_STATE":
        sendResponse(await chrome.storage.local.get(["psmChats","psmProjects"]));
        break;
      case "IMPORT_STATE":
        await importState(msg.data || {});
        sendResponse({ok:true});
        break;
      default:
        sendResponse({ok:false, error:"Unknown message"});
    }
  })();
  return true;
});

function idFromName(name) {
  const slug = (name || "project").toLowerCase()
    .replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,48) || "project";
  return `${slug}-${Date.now().toString(36)}`;
}

async function saveChat(chat) {
  const {psmChats={}} = await chrome.storage.local.get(["psmChats"]);
  const old = psmChats[chat.id] || {};
  psmChats[chat.id] = {
    ...old,
    ...chat,
    firstSeen: old.firstSeen || Date.now(),
    lastSeen: Date.now(),
    projectId: old.projectId ?? chat.projectId ?? null,
    status: old.manualStatus ? old.status : (chat.status || old.status || "active"),
    manualStatus: old.manualStatus || false
  };
  await chrome.storage.local.set({psmChats});
  if (psmChats[chat.id].projectId) await touchProjectFromChat(psmChats[chat.id].projectId, psmChats[chat.id]);
}

async function setStatus(id, status) {
  const {psmChats={}} = await chrome.storage.local.get(["psmChats"]);
  if (psmChats[id]) {
    psmChats[id].status = status;
    psmChats[id].manualStatus = true;
    psmChats[id].updatedAt = Date.now();
    await chrome.storage.local.set({psmChats});
  }
}

async function createProject(p) {
  const {psmProjects={}} = await chrome.storage.local.get(["psmProjects"]);
  const id = p.id || idFromName(p.name);
  const now = Date.now();
  psmProjects[id] = {
    id,
    name: p.name || "Untitled Project",
    status: p.status || "active",
    aliases: Array.isArray(p.aliases) ? p.aliases : [],
    knownGood: p.knownGood || "",
    nextAction: p.nextAction || "",
    dependencies: Array.isArray(p.dependencies) ? p.dependencies : [],
    notes: p.notes || "",
    createdAt: now,
    updatedAt: now,
    lastActivity: now,
    continuationCount: 0
  };
  await chrome.storage.local.set({psmProjects});
  return {ok:true, project:psmProjects[id]};
}

async function updateProject(p) {
  const {psmProjects={}} = await chrome.storage.local.get(["psmProjects"]);
  if (!p.id || !psmProjects[p.id]) return {ok:false, error:"Project not found"};
  psmProjects[p.id] = {...psmProjects[p.id], ...p, updatedAt:Date.now()};
  await chrome.storage.local.set({psmProjects});
  return {ok:true, project:psmProjects[p.id]};
}

async function assignChat(chatId, projectId) {
  const store = await chrome.storage.local.get(["psmChats","psmProjects"]);
  const psmChats = store.psmChats || {};
  const psmProjects = store.psmProjects || {};
  if (!psmChats[chatId]) return {ok:false, error:"Chat not found"};
  if (projectId && !psmProjects[projectId]) return {ok:false, error:"Project not found"};
  psmChats[chatId].projectId = projectId || null;
  psmChats[chatId].updatedAt = Date.now();
  if (projectId) {
    psmProjects[projectId].lastActivity = Date.now();
    psmProjects[projectId].updatedAt = Date.now();
  }
  await chrome.storage.local.set({psmChats, psmProjects});
  return {ok:true};
}

async function touchProjectFromChat(projectId, chat) {
  const {psmProjects={}} = await chrome.storage.local.get(["psmProjects"]);
  const p = psmProjects[projectId];
  if (!p) return;
  p.lastActivity = Math.max(p.lastActivity || 0, chat.lastSeen || Date.now());
  p.updatedAt = Date.now();
  await chrome.storage.local.set({psmProjects});
}

async function importState(data) {
  const out = {};
  if (data.psmChats && typeof data.psmChats === "object") out.psmChats = data.psmChats;
  if (data.psmProjects && typeof data.psmProjects === "object") out.psmProjects = data.psmProjects;
  if (Object.keys(out).length) await chrome.storage.local.set(out);
}
