# WCSpedia — space-only upload package

This release keeps the current editor, approval screens, header and fonts and uses built-in Confluence APIs for Add document, drafts, approval/publication, entitlement editing, Saved items, suggestion delivery, helpfulness voting, recorded views and content-health persistence. No custom service endpoints or server installation are required. Keep the existing WCSpedia editor, design and custom approval workflow.

Use only `WCSpedia-configured-upload.zip`, which expands to one `confluence-ready/` folder. It includes all page and navbar files together, with one stylesheet: `attachments/wcspedia-style.css`. No separate header ZIP is needed.

1. Upload all files from `attachments/` to **3962195316**, replacing files with the same names.
2. In your existing **navBar** page, remove the old WCSpedia Add document macros, WCSpedia stylesheet links, notifications and article-helper script fragments. Keep your navigation, native Create control and site font/theme CSS.
3. Paste **`html/wcspedia-navbar.html` once** into an HTML macro in the header. The Add document control sits at the bottom right, directly above the progress-ring Back to top control. Both load on every page containing the shared header, including native child articles. This includes the single stylesheet, Add document/scroll-control pair, notifications and scoped child-article helpers. Keep `{include:wcspedia:navBar}`.
4. Replace each interface page's macro with its matching `html/wcspedia-*.html` fragment, using the page-ID table below. Do not paste the navbar fragment into those pages.
5. Publish and hard-refresh. The attachment URLs have no `&v=` cache suffix. No config attachment or standalone widget stylesheet is needed.

**Publishing rule:** Job aids alone need a business area, reviewer and manager approval. All other supported types publish directly to Insights (3961735728). Their editor hides workflow fields, and Insights lists every supported non-Job-aid type. Existing non-Job-aid history is retained; an explicit authorized save adopts Insights routing. Updated MDX templates use Guide / Insights. No live JSON or page-ID changes are required.

This update removes repeated Add document access reads when opening the menu and choosing a type. Returning after idle refreshes the navigation hint in the background. Editor/save permission checks remain fresh. It also bounds stalled JSON requests and clears detached editor dialogs without discarding drafts or unlocking uncertain saves. After replacing the attachments, close and reopen old WCSpedia tabs so they stop running the previous scripts. No JSON or page-ID changes are needed.

All IDs are prefilled. Page fragments contain no document/header/font wrappers. Duplicate current header mounts are collapsed to one; remove older manually written buttons or inline widget styles during step 2.

**Keep your live `entitlements.json`.** `initial-json/` is for first installation only. Keep older projections/history as backups; do not overwrite existing data with starters. The native workflow uses separate document pages and their own metadata attachments, not one growing full-library JSON.

Each file is below **10 MB (10,000,000 bytes) per attachment**. Extract the ZIP and upload individual files. There are no development `.cjs` files in this package.

Before use, restrict viewing of Working page **3961735834** to the authoring/review team and verify native Add/Edit/Restrict permissions. Add a second eligible manager in Entitlements: an author cannot approve their own document. Keep native edit access to the entitlement attachment host restricted to administrators.

Read **[the native setup and recovery guide](templates/NATIVE-SPACE-SETUP.md)** before rollout. It explains storage, the two-account acceptance check, migration limits and cooperative approval. Native Confluence permissions remain authoritative. Local tests do not verify your internal server.

The six page pairs are Landing, My workspace, Reviewer workspace, Saved items, Entitlements and Insights. Each page fragment loads its matching logic `.js` and `HTMLPage.js`. The navbar owns the single Add document widget; live page code does not mount another. It opens the existing My workspace editor. On denied access/setup errors it stays visible but disabled, with the reason in its tooltip and the console message beginning `[WCSpedia Add document]`. The style marker is a manual marker for native document pages only. The comments scripts in the navbar are background helpers: they add no Load comments control. Comments load automatically near the bottom of eligible child articles, with an in-article retry if loading fails. Only Landing uses the splash.

The policy filename is exactly **`entitlements.json`**, on **3962195316**. Keep its `schemaVersion`, `revision`, `records` and `audit` fields; these are data/history controls, not filename suffixes. If fields were removed, restore them from the last valid policy attachment without resetting grants or audit history. `wcspedia.entitlements.v1` is an internal native content-property key, not a filename or a second JSON to upload. Do not remove native Confluence versions or pointer records. An administrator's JSON creation grant still requires native permissions and the restricted Working page.

JSON reads now use the **latest attachment by filename**. Keep your live `entitlements.json`; a normal manual replacement no longer needs **Review JSON recovery**. Do not add version suffixes or remove JSON schema/revision/audit fields. Missing/invalid files still produce an error, and unfinished saves still need their original request reconciled. Shared scripts, CSS, logos and MDX templates also use stable filename URLs. Saved remains independent of entitlement JSON. See `templates/NATIVE-SPACE-SETUP.md` for write conflict and recovery boundaries.

The reusable MDX template is in both `templates/` and `attachments/`. Native comments remain on articles, favourites are personal Confluence labels, suggestions become document comments, and analytics JSON is downloaded explicitly for manual reporting. Helpfulness votes and recorded views use compact JSON content properties on each published article; health rules/history use `wcspedia-health.json` on each managed document’s Working page. These records are created on successful writes; **no starter JSON is needed**. Insights downloads one combined analytics JSON on demand.

Recording votes/views requires native Edit permission on that article. Health changes require appropriate JSON grants and native Working-page Edit/Add attachments access. JSON does not elevate native permissions. Recorded views cover successful eligible recordings, deduplicated per account for 30 minutes, with an explicit limit of 180 active accounts per document; they do not represent all Confluence traffic. Existing unmanaged pages need enrollment in the WCSpedia approval workflow for health persistence. Article comments remain independent and use native comment permissions.

The latest interface update fixes Entitlements footer controls/code formatting, Insights search/Topics, and action spinners. Insights no longer offers analytics export. Workspace reads now tolerate missing draft-privacy setup while draft writes remain disabled; configure **Working 3961735834**, not the workspace interface pages. See `templates/NATIVE-SPACE-SETUP.md`.

## Simplified content choices

Insights has four groups: Guides, Blogs, Training and Reports. The floating creation menu and editor offer those four plus Job aids. Only Job aids require a business area, reviewer and manager. Topics remain optional; Processes and Regions are under More organisation options. My Workspace uses the shared floating button instead of a second creation button.

Stored types and history are preserved. Procedures, playbooks and checklists appear under Guides; knowledge sharing under Training; reference articles, templates and existing FAQ articles under Reports. The five general help FAQs appear below the latest articles on the landing page. New MDX uses Job aid, Guide, Blog, Training, or Report.

## Returning after idle

The landing page and Saved items refresh their visible list when the tab becomes visible/focused again after 30 seconds, or Saved items returns from the browser back-forward cache. Events share one in-flight refresh; there is no polling, automatic write, full-page reload or non-landing splash. Saved rows are displayed independently of content-health completion, and Saved-only refreshes do not reload health.

Previously loaded results remain visible with a refresh warning after a network timeout or temporary server failure. Authentication, permission, changed-account and malformed-response failures clear the affected results. A successful empty response remains an empty result; failures are never treated as an empty success. Landing search rechecks a previously established session after 60 seconds, sharing the check across simultaneous searches. Signing in again as the same account permits retry; a changed account requires reloading the page. These checks cannot extend the internal Confluence/SSO session.

Saved items continue to use native personal favourites, scoped to this space and the configured WCSpedia descendants. No live JSON file needs changing for this update.

## Editor permission correction and file-drop protection

Keep the current editor. After creating a native page, WCSpedia fetches that page with its expanded edit permissions before continuing. A minimal create response no longer falsely denies editing; actual native permission failures still stop the save. Blogs, Guides, Training and Reports publish under Insights without reviewer/manager approval. Job aids retain approval. Upload the current page JS pairs and matching HTML from this package. Do not replace live JSON with starter files.

Upload `attachments/wcspedia-file-drop-guard.js` to the same attachments page, **3962195316**, with the other runtime files. Replace the existing WCSpedia fragment inside your **navBar HTML macro** with `html/wcspedia-navbar.html`; keep your navigation and fonts. Continue using `{include:wcspedia:navBar}` in space Look and Feel. This adds one small helper at the start of the fragment, without new CSS, an overlay, requests or polling.

The helper cancels file drag/drop gestures on WCSpedia pages that load this header, including its custom editor. Use **Add files**, **Upload cover image**, or **Insert image** to select files deliberately. Text/link dragging, paste and file-picker uploads are unchanged. It checks native space metadata or the page URL and does not activate on another space or an unidentified page. To turn it off, set `enabled: false` in `WCS_FILE_DROP_CONFIG` in the navBar macro.

CSS in Look and Feel cannot reliably disable JavaScript upload handlers. This helper is a browser interaction guard, not a native permission rule. A native editor/attachment screen that does not load navBar, a separate iframe, or a handler that already ran earlier on window capture is outside its protection. With space-only access we cannot guarantee a site-wide ban. Verify a file drag over a native child article and the custom editor on the internal instance; there should be no upload request or new attachment. Explicit uploads should still work. The built-in Confluence editor must be checked separately for whether it includes the header.

## Job aid View/Edit restriction compatibility

The live server reported: `'update' restrictions requires 'read' restrictions for same user/group`. The native Job aid writer now sends both operations in one request to `/confluence/rest/api/content/{pageId}/restriction`.

- **Working draft:** preserve existing individual viewers and viewing groups, and explicitly include each assigned author/reviewer/manager in both View and Edit. No new group is configured. The Working parent must still have viewing restrictions; removing them disables creation because private staging cannot be verified.
- **First publication:** the verified, newly staged publication page requests an empty direct View restriction and an approving-manager Edit restriction in the same payload. This is the native editing-restricted mode: reading follows the destination/space permissions. It does not make the space anonymous or remove any parent restriction. Existing published articles keep their direct viewing restrictions when revised; the app does not silently remove those.
- **Verification:** both returned lists must match the requested state before the workflow continues. A server rejection leaves publication staged under Working; it never falls back to unrestricted editing, grants everyone access, or skips approval. The internal instance must still accept the editing-restricted publication mode. Local tests do not prove that server behavior.
- **Insights:** no restriction writes or reviewer assignments. The older `blog.html` also used ordinary native page creation, without provisioning restrictions. The current WCSpedia editor retains private Working history, so Working remains required for this implementation.

Keep `entitlements.json` unchanged. It remains the application policy; native page access is still enforced by Confluence. For the shared Working parent **3961735834**, restore native viewing restrictions for the intended authoring/review team, using individual people if no groups are desired. These parent settings are separate from the per-document access the app now applies automatically.

Install the updated runtime attachments and matching HTML. Copy unsaved MDX before a hard refresh. Exact-request **Check save** recovery works while the original editor retains its command; it is not guaranteed across closing/reloading that tab. Do not delete old Working pages or their journals to clear an error.

### Job aids: automatic reviewer access

Normal use does not require manual per-document restriction changes. The app resolves the assigned author, reviewer and approving manager to native Confluence usernames, applies their individual editing restrictions on creation, and verifies them again on **Submit for review** and **Start revision**. Existing author-only drafts are reconciled automatically while an authorized editor performs these actions. Matching restrictions are reused. Publication still applies the approving manager's editing restriction before publishing. A failed restriction step does not advance the saved workflow status; the original command remains available for recovery in the open editor. Insights does not use this workflow.

One-time native setup: the space owner must give authors/managers who perform restriction writes native page-edit access and **Restrict** (or space Admin) permission, plus the Add page/Add attachments permissions already required. Assigned reviewers need native space access and access through Working's viewing restrictions. Use existing departmental Confluence groups if available; this package does not create directory groups or grant itself permissions. JSON entitlements remain additional application policy. Native restriction reads succeeding does not establish write permission. If the instance rejects the documented PUT despite correct native permissions, its actual response still needs diagnosis; automatic code cannot override that rejection.

The manual procedure below is an exceptional recovery option, not the normal publishing process.

### Job aids: native restriction recovery

The app reads and verifies both permission lists before writing. If both match the requested policy, no PUT is needed. Extra editors, editing groups, incomplete lists and changed verification results are not accepted. Draft viewing entries now explicitly include assigned editors. Rejections identify the page ID, step and required native usernames; HTTP 400/403/404/405 restriction failures keep the editor's original fields/request available through **Check save**.

If a restriction PUT is rejected, keep the editor open. A space owner can open the page identified by the error in another tab and set the required View/Edit state using Confluence's native Restrictions dialog, only as an exceptional recovery step. A working Job aid needs its author, reviewer and approving manager; its publication page needs the assigned approving manager. Do not change viewing restrictions, move the prepared page or delete its recovery metadata. Then use **Check save** in the original editor. The complete permission, identity, version and approval checks still run. If the REST read endpoint is unavailable, the app cannot verify this correction and will stop.

For diagnosis, open `/confluence/rest/api/content/<pageId>/restriction/byOperation/update?expand=restrictions.user,restrictions.group` while signed in. This is a read-only restriction GET; opening `/restriction` directly in the address bar does not test its PUT operation. A successful `/content/<pageId>` GET proves only that the page can be read. An account unable to save restrictions through the native dialog needs help from its space owner; JSON entitlements cannot grant native permissions. Preserve unsaved MDX before installing updated scripts. Original-request recovery is supported while the editor retains the command, not guaranteed across a full browser reload.

### Article styling flags

Replace **wcspedia-page-style-flags.js**, the shared **wcspedia-style.css**, and the matching **html/wcspedia-navbar.html** include. The navbar loads the flag helper once. WCSpedia-created articles contain the native `wcs-page-style-v1` anchor automatically; existing native pages can use the supplied `wcspedia-page-style-flags-marker.html` in an HTML macro inside the article. Do not put that marker in navBar.

The helper now recognizes rendered native anchors without requiring a theme class, restores its flags if the theme replaces body classes, and restarts its bounded readiness observation at DOM/load readiness. The shared CSS supplies scoped `!important` rules for native title/actions/comments/footer on marked article views. It leaves the article's own heading, navBar and WCSpedia discussion alone, and does not activate on app pages, native editing or previews. No additional stylesheet or network lookup is added. If the internal theme uses different element selectors, live DOM inspection is still needed; do not hide every header or h1 globally.

## Configured page IDs

Space key: `wcspedia`. Context: `/confluence`. Attachment page: `3962195316`.

| Interface | Page ID | HTML macro |
| --- | --- | --- |
| Landing page | `3954553300` | `html/wcspedia-landing.html` |
| My workspace | `3961735744` | `html/wcspedia-my-workspace.html` |
| Reviewer workspace | `3961735749` | `html/wcspedia-reviewer-workspace.html` |
| Saved items | `3961735759` | `html/wcspedia-saved-items.html` |
| Entitlements | `3961735763` | `html/wcspedia-entitlements.html` |
| Insights | `3961735728` | `html/wcspedia-insights.html` |

Insights parent: `3961735728`. Restricted Working parent: `3961735834`.

| Business area | Parent page ID |
| --- | --- |
| credit-approval-control | `3961735771` |
| credit-information-management | `3961735776` |
| credit-management-reporting | `3961735781` |
| deal-closing | `3961735791` |
| documentation-pledging | `3961735795` |
| emea-credit-admin | `3961735800` |
| loan-management | `3961735803` |
| regional-operating-manuals | `3961735808` |

These IDs match the supplied configuration. Native access must be checked on your internal instance. `SHA256SUMS.txt` verifies every file in this package.
