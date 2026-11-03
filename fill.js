// Shared by the popup and the background script.

// Job-board sites that companies often embed their application forms from.
// Lynx asks for access to these only if you opt in (see popup.js), so it
// can fill forms inside those embeds. Keep in sync with
// optional_host_permissions in manifest.json.
/* exported JOB_BOARD_ORIGINS */
const JOB_BOARD_ORIGINS = [
  "https://*.greenhouse.io/*",
  "https://*.lever.co/*",
  "https://*.ashbyhq.com/*",
  "https://*.myworkdayjobs.com/*",
  "https://*.smartrecruiters.com/*",
  "https://*.workable.com/*",
  "https://*.jobvite.com/*",
  "https://*.icims.com/*",
];
//
// fillForm() is injected into the page with chrome.scripting.executeScript,
// so it must be self-contained: no references to anything outside it.
// It only runs when the user asks (popup button or keyboard shortcut), which
// is what lets Lynx work with the activeTab permission instead of access to
// every site.

/* exported fillForm */
function fillForm(links) {
  // Extra words that identify a field for common link types.
  const ALIASES = {
    linkedin: ["linkedin", "linked in"],
    github: ["github", "git hub"],
    gitlab: ["gitlab"],
    x: ["twitter", "x.com", "x profile", "x handle"],
    twitter: ["twitter", "x.com"],
    portfolio: ["portfolio", "website", "personal site", "personal url", "homepage", "home page", "web site", "blog"],
    website: ["website", "portfolio", "personal site", "homepage", "web site"],
    email: ["email", "e-mail"],
    phone: ["phone", "mobile", "telephone", "cell"],
    dribbble: ["dribbble"],
    behance: ["behance"],
    medium: ["medium"],
    stackoverflow: ["stack overflow", "stackoverflow"],
  };

  const norm = (s) => (s || "").toLowerCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();

  function keywordsFor(link) {
    const words = new Set();
    const label = norm(link.label);
    if (label) {
      words.add(label);
      for (const k of ALIASES[label.replace(/\s/g, "")] || []) words.add(k);
    }
    // Recognise well-known sites from the URL, so a link labelled
    // "My profile" pointing at linkedin.com still matches LinkedIn fields.
    // Only known sites count: a portfolio on jane.github.io must not
    // compete with the real GitHub link.
    try {
      const host = new URL(link.value).hostname.replace(/^www\./, "");
      const site = host.split(".").slice(-2, -1)[0];
      // linkedin.com or uk.linkedin.com count; jane.github.io doesn't.
      const parts = host.split(".");
      const isProfileHost = parts.length === 2 || (parts.length === 3 && parts[0].length === 2);
      if (ALIASES[site] && isProfileHost) {
        words.add(site);
        for (const k of ALIASES[site]) words.add(k);
      }
    } catch {
      if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(link.value)) ALIASES.email.forEach((k) => words.add(k));
    }
    return [...words].filter(Boolean);
  }

  function labelText(el) {
    const parts = [el.name, el.id, el.placeholder, el.getAttribute("aria-label"), el.getAttribute("autocomplete"), el.title];
    if (el.labels) for (const l of el.labels) parts.push(l.textContent);
    const by = el.getAttribute("aria-labelledby");
    if (by) for (const id of by.split(/\s+/)) parts.push(document.getElementById(id)?.textContent);
    return norm(parts.filter(Boolean).join(" "));
  }

  // Many forms put the label in a nearby element instead of a <label for>.
  // Only trust a wrapper that holds this one field, so a neighbour's label
  // can't leak in.
  function nearbyText(el) {
    let node = el.parentElement;
    for (let i = 0; node && i < 4; i++, node = node.parentElement) {
      if (node.querySelectorAll("input, textarea, select").length > 1) return "";
      const t = node.textContent;
      if (t && t.trim()) return t.length < 200 ? norm(t) : "";
    }
    return "";
  }

  // Whole-word match, so a link labelled "X" doesn't match "Explain".
  const hasWord = (text, w) =>
    new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`).test(text);

  function bestMatch(text) {
    // Prefer the longest keyword match so "personal website" beats "website".
    let best = null;
    let bestLen = 0;
    for (const { link, words } of linkKeywords) {
      for (const w of words) {
        if (w.length > bestLen && hasWord(text, w)) {
          best = link;
          bestLen = w.length;
        }
      }
    }
    return best;
  }

  // getClientRects is empty for display:none (and inside hidden parents),
  // but unlike offsetParent it still works for position:fixed dialogs.
  const isVisible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";

  const isFillable = (el) =>
    !el.disabled &&
    !el.readOnly &&
    isVisible(el) &&
    !el.value &&
    (el.tagName === "TEXTAREA" || ["text", "url", "email", "tel", "search", ""].includes(el.type));

  const linkKeywords = links.filter((l) => l.value).map((l) => ({ link: l, words: keywordsFor(l) }));
  // Each link fills at most one field per form. Fields outside any <form>
  // are grouped together under the document.
  const usedByForm = new Map();
  const filled = [];

  for (const el of document.querySelectorAll("input, textarea")) {
    if (!isFillable(el)) continue;
    let best = bestMatch(labelText(el)) || bestMatch(nearbyText(el));
    if (el.type === "email" && !best) best = linkKeywords.find(({ words }) => words.includes("email"))?.link;
    if (!best) continue;
    const scope = el.form ?? document;
    if (!usedByForm.has(scope)) usedByForm.set(scope, new Set());
    const used = usedByForm.get(scope);
    if (used.has(best.id)) continue;

    el.focus();
    const ok = document.execCommand && document.execCommand("insertText", false, best.value);
    if (!ok || el.value !== best.value) {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")?.set;
      setter ? setter.call(el, best.value) : (el.value = best.value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.blur();

    const prev = el.style.boxShadow;
    el.style.transition = "box-shadow 0.3s";
    el.style.boxShadow = "0 0 0 3px rgba(37, 99, 235, 0.55)";
    setTimeout(() => (el.style.boxShadow = prev), 1600);

    used.add(best.id);
    filled.push(best.label || best.value);
  }

  // Report embedded frames so the popup can offer job-board access when a
  // form lives inside one Lynx can't reach yet.
  const embeds = [...document.querySelectorAll("iframe[src]")]
    .map((f) => {
      try {
        return new URL(f.src, location.href).hostname;
      } catch {
        return "";
      }
    })
    .filter((h) => h && h !== location.hostname);

  return { filled, embeds };
}

// Formats every link as one block of text for free-form questions.
/* exported formatAll */
function formatAll(links) {
  return links
    .filter((l) => l.value)
    .map((l) => (l.label ? `${l.label}: ${l.value}` : l.value))
    .join("\n");
}
