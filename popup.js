const SUGGESTED = [
  { label: "LinkedIn", value: "https://www.linkedin.com/in/" },
  { label: "GitHub", value: "https://github.com/" },
  { label: "Portfolio", value: "https://" },
  { label: "X", value: "https://x.com/" },
  { label: "Email", value: "" },
];

const $ = (sel) => document.querySelector(sel);
const listEl = $("#links");
const emptyEl = $("#empty");
const toastEl = $("#toast");
const suggestionsEl = $("#suggestions");
const addForm = $("#add-form");
const addLabel = $("#add-label");
const addValue = $("#add-value");

let links = [];
let editing = false;

const newId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function load() {
  const data = await chrome.storage.sync.get("links");
  links = data.links ?? [];
  render();
}

function save() {
  clearTimeout(saveSoon.t);
  return chrome.storage.sync.set({ links });
}

// Typing in edit mode saves shortly after each pause, so closing the popup
// mid-edit doesn't lose anything. (storage.sync limits writes per minute,
// so it can't save on every keystroke.)
function saveSoon() {
  clearTimeout(saveSoon.t);
  saveSoon.t = setTimeout(save, 300);
}
// Flush a pending save if the popup closes before the timer fires.
window.addEventListener("pagehide", () => {
  if (saveSoon.t) save();
});

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => toastEl.classList.remove("show"), 1200);
}

async function copy(link, row) {
  try {
    await navigator.clipboard.writeText(link.value);
    row?.classList.add("flash");
    setTimeout(() => row?.classList.remove("flash"), 900);
    toast(`Copied ${link.label || "link"}`);
  } catch {
    toast("Couldn't copy — try again");
  }
}

function render() {
  document.body.classList.toggle("editing", editing);
  $("#toggle-edit").textContent = editing ? "Done" : "Edit";
  $("#toggle-edit").hidden = links.length === 0;
  emptyEl.hidden = links.length > 0;
  $("#bulk").hidden = editing || links.length === 0;
  listEl.replaceChildren(...links.map(editing ? editRow : viewRow));
  renderSuggestions();
}

function viewRow(link, i) {
  const li = document.createElement("li");
  li.className = "link";
  li.tabIndex = 0;
  li.title = `Copy ${link.value}`;
  li.innerHTML = `
    <span class="key">${i < 9 ? i + 1 : ""}</span>
    <span class="text">
      <div class="label"></div>
      <div class="value"></div>
    </span>
    <span class="copied">Copied</span>`;
  li.querySelector(".label").textContent = link.label || link.value;
  li.querySelector(".value").textContent = link.label ? link.value : "";
  li.addEventListener("click", () => copy(link, li));
  li.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      copy(link, li);
    }
  });
  return li;
}

function editRow(link, i) {
  const li = document.createElement("li");
  li.className = "link";
  li.innerHTML = `
    <div class="fields">
      <input class="e-label" placeholder="Label" maxlength="40" />
      <input class="e-value" placeholder="Link or text" />
    </div>
    <div class="actions">
      <button class="ghost up" title="Move up" type="button">↑</button>
      <button class="ghost down" title="Move down" type="button">↓</button>
      <button class="ghost delete" title="Delete" type="button">✕</button>
    </div>`;
  const label = li.querySelector(".e-label");
  const value = li.querySelector(".e-value");
  label.value = link.label;
  value.value = link.value;
  label.addEventListener("input", () => {
    link.label = label.value.trim();
    saveSoon();
  });
  value.addEventListener("input", () => {
    link.value = value.value.trim();
    saveSoon();
  });
  li.querySelector(".up").disabled = i === 0;
  li.querySelector(".down").disabled = i === links.length - 1;
  li.querySelector(".up").addEventListener("click", () => move(i, -1));
  li.querySelector(".down").addEventListener("click", () => move(i, 1));
  li.querySelector(".delete").addEventListener("click", () => {
    links.splice(i, 1);
    if (links.length === 0) editing = false;
    save();
    render();
  });
  return li;
}

function move(i, dir) {
  const j = i + dir;
  [links[i], links[j]] = [links[j], links[i]];
  save();
  render();
}

function renderSuggestions() {
  const have = new Set(links.map((l) => l.label.toLowerCase()));
  const options = SUGGESTED.filter((s) => !have.has(s.label.toLowerCase()));
  suggestionsEl.hidden = editing || options.length === 0;
  suggestionsEl.replaceChildren(
    ...options.map((s) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = `+ ${s.label}`;
      b.addEventListener("click", () => {
        addLabel.value = s.label;
        addValue.value = s.value;
        addValue.focus();
        addValue.setSelectionRange(s.value.length, s.value.length);
      });
      return b;
    }),
  );
}

addForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const value = addValue.value.trim();
  if (!value) return;
  links.push({ id: newId(), label: addLabel.value.trim(), value });
  addForm.reset();
  save();
  render();
  toast("Saved");
});

$("#copy-all").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(formatAll(links));
    toast(`Copied ${links.length} links`);
  } catch {
    toast("Couldn't copy — try again");
  }
});

$("#fill").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let results;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: fillForm,
      args: [links],
    });
  } catch {
    toast("Can't fill on this page");
    return;
  }
  const filled = results.flatMap((r) => r.result?.filled ?? []);
  if (filled.length) {
    toast(`Filled ${filled.join(", ")}`);
    setTimeout(() => window.close(), 900);
    return;
  }

  // Nothing filled. If the form is embedded from a job board Lynx can't
  // reach yet, offer to allow it.
  const embeds = results.flatMap((r) => r.result?.embeds ?? []);
  const board = embeds.find(isJobBoard);
  if (board && !(await hasJobBoardAccess())) {
    showJobBoardPrompt(`This form is embedded from ${board}.`);
  } else {
    toast("No empty link fields found");
  }
});

// ----- Optional access to job-board embeds -----

const boardDomains = JOB_BOARD_ORIGINS.map((o) => o.replace("https://*.", "").replace("/*", ""));
const isJobBoard = (host) => boardDomains.some((d) => host === d || host.endsWith("." + d));
const hasJobBoardAccess = () => chrome.permissions.contains({ origins: JOB_BOARD_ORIGINS });

function showJobBoardPrompt(reason) {
  $("#board-reason").textContent = reason;
  $("#board-prompt").hidden = false;
}

$("#board-allow").addEventListener("click", async () => {
  // Must run straight from the click: browsers only show permission
  // prompts in response to a user action.
  const granted = await chrome.permissions.request({ origins: JOB_BOARD_ORIGINS });
  $("#board-prompt").hidden = true;
  toast(granted ? "Allowed — try Fill this form again" : "Not allowed");
  updateBoardLink();
});

$("#board-link").addEventListener("click", () =>
  showJobBoardPrompt("Some career pages embed their form from a job board."),
);

async function updateBoardLink() {
  $("#board-link").hidden = await hasJobBoardAccess();
}

$("#toggle-edit").addEventListener("click", () => {
  editing = !editing;
  render();
});

// Number keys copy the matching link, unless you're typing in a field.
document.addEventListener("keydown", (e) => {
  if (editing || e.target.matches("input")) return;
  const n = Number(e.key);
  if (n >= 1 && n <= 9 && links[n - 1]) {
    copy(links[n - 1], listEl.children[n - 1]);
  }
});

load();
updateBoardLink();
