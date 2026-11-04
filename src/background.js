// Builds a right-click menu on text fields so a saved link can be inserted
// straight into the field without opening the popup.

// Chrome loads this as a service worker; Firefox loads fill.js via the
// manifest's background.scripts list instead.
if (typeof importScripts === "function") importScripts("fill.js");

const PARENT_ID = "lynx";

async function getLinks() {
  const { links = [] } = await chrome.storage.sync.get("links");
  return links;
}

async function rebuildMenus() {
  await chrome.contextMenus.removeAll();
  const links = await getLinks();

  chrome.contextMenus.create({
    id: PARENT_ID,
    title: "Insert link from Lynx",
    contexts: ["editable"],
  });

  if (links.length === 0) {
    chrome.contextMenus.create({
      id: "lynx-empty",
      parentId: PARENT_ID,
      title: "No links yet — add some from the toolbar icon",
      contexts: ["editable"],
      enabled: false,
    });
    return;
  }

  for (const link of links) {
    chrome.contextMenus.create({
      id: `lynx-${link.id}`,
      parentId: PARENT_ID,
      title: link.label || link.value,
      contexts: ["editable"],
    });
  }
}

// Runs inside the page. Inserts text at the caret of the focused field.
function insertIntoFocusedField(text) {
  let el = document.activeElement;
  while (el && el.shadowRoot && el.shadowRoot.activeElement) {
    el = el.shadowRoot.activeElement;
  }
  if (!el) return;

  // execCommand keeps undo history and fires the input events that
  // frameworks like React listen for.
  if (document.execCommand && document.execCommand("insertText", false, text)) {
    return;
  }

  if ("value" in el && typeof el.value === "string") {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const proto = Object.getPrototypeOf(el);
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    const next = el.value.slice(0, start) + text + el.value.slice(end);
    if (setter) setter.call(el, next);
    else el.value = next;
    el.setSelectionRange?.(start + text.length, start + text.length);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } else if (el.isContentEditable) {
    // Insert at the caret rather than appending to the end.
    const sel = el.ownerDocument.getSelection();
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const node = document.createTextNode(text);
      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      el.append(text);
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id || !String(info.menuItemId).startsWith("lynx-")) return;
  const id = String(info.menuItemId).slice("lynx-".length);
  const link = (await getLinks()).find((l) => l.id === id);
  if (!link) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [info.frameId ?? 0] },
      func: insertIntoFocusedField,
      args: [link.value],
    });
  } catch (err) {
    // Some pages (chrome://, the Web Store) block scripts.
    console.warn("Lynx could not insert into this page:", err);
  }
});

chrome.runtime.onInstalled.addListener(rebuildMenus);
chrome.runtime.onStartup.addListener(rebuildMenus);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.links) rebuildMenus();
});

// Alt+Shift+F: fill every matching field on the page. The shortcut grants
// activeTab for this tab, so no site permissions are needed.
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== "fill-form") return;
  tab ??= (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (!tab?.id) return;
  const count = await runFill(tab.id, await getLinks());
  await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: count ? "#2563eb" : "#888" });
  await chrome.action.setBadgeText({ tabId: tab.id, text: String(count) });
  setTimeout(() => chrome.action.setBadgeText({ tabId: tab.id, text: "" }), 2500);
});

async function runFill(tabId, links) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: fillForm,
      args: [links],
    });
    return results.reduce((n, r) => n + (r.result?.filled.length ?? 0), 0);
  } catch (err) {
    console.warn("Lynx could not fill this page:", err);
    return 0;
  }
}
