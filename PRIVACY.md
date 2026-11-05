# Lynx privacy policy

_Last updated: November 5, 2026_

Lynx is a browser extension that saves your links (LinkedIn, GitHub, portfolio, email, and so on) so you can copy them or fill them into forms. This policy explains what Lynx does with that information. The short version: **your links stay in your browser, and the developer never receives any of your data.**

In the terms used by the Chrome Web Store, Lynx handles two kinds of user data, both only on your device: **personally identifiable information** (the email address, phone number, and profile links you choose to save) and **website content** (the form fields it reads when you ask it to fill a page).

## What Lynx stores

Lynx stores only the links you add yourself: a label (such as "LinkedIn") and a value (such as a URL, email address, or phone number) for each one.

They're saved with your browser's extension storage (`chrome.storage.sync`). If you've turned on sync in your browser, your browser syncs them to your other devices through your browser account (your Google account in Chrome, or your Firefox account in Firefox). That syncing is handled by your browser, under your browser provider's privacy policy. Lynx doesn't run its own servers.

## What Lynx doesn't do

- It doesn't send your data anywhere. Lynx makes no network requests.
- It doesn't use analytics, tracking, advertising, or cookies.
- It doesn't sell, share, or transfer your data to anyone.
- It doesn't read your browsing history or run on pages in the background.
- It doesn't read your clipboard. It only writes to it when you click a link to copy it.

## When Lynx accesses a web page

Lynx only touches a page when you ask it to, by pressing the fill shortcut, clicking **Fill this form**, or choosing a link from the right-click menu. It then:

- looks at the form fields on that page (their labels, names, placeholders, and nearby text, and whether they're already filled) to decide which of your links goes where, and notes which sites the page embeds forms from, so it can offer job-board access if needed, and
- types your links into the matching empty fields, or into the field you right-clicked.

This happens entirely inside your browser. Lynx doesn't keep or send anything it sees on the page.

If you choose **Allow job boards**, Lynx can also do this inside application forms embedded from a short list of job-board sites (Greenhouse, Lever, Ashby, Workday, SmartRecruiters, Workable, Jobvite, and iCIMS), still only when you ask. You can remove that access at any time from the extension's settings in your browser.

## Permissions

| Permission | Why Lynx needs it |
| --- | --- |
| `storage` | To save your links |
| `contextMenus` | To add the "Insert link" option when you right-click a text field |
| `activeTab` and `scripting` | To fill or insert your links into the current page, only right after you ask |
| Job-board sites (optional) | To fill forms embedded from those sites, only if you allow it |

## Deleting your data

You can delete any link from the Lynx popup: click **Edit**, then the **✕** next to it. Uninstalling Lynx also removes its stored links from your browser.

## Limited use

Lynx uses your data only to provide its single purpose: saving your links and putting them into forms when you ask. It isn't used for any other purpose, including advertising or determining creditworthiness, and no person reads it.

## Changes

If this policy changes, the new version will be posted here with a new date.

## Contact

Questions or concerns: [open an issue on GitHub](https://github.com/spencer-barrett/lynx/issues).