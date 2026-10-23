## October 23 latest-document timestamps

Latest cards now show the visible update date and time with a timezone (Europe/Warsaw, matching the existing application date convention). Native latest discovery continues to use Confluence `lastmodified DESC`, with no publication-year cutoff. An article first published in 2025 can appear when updated today; Confluence indexing may take time to reflect the write. Local discovery also uses the published Insight revision timestamp and does not promote private draft edits.

Replace the matching page JS/HTMLPage attachment pairs from this build on attachment page **3962195316** and hard-refresh. The landing pair is `wcspedia-landing.js` and `wcspedia-landingHTMLPage.js`. No page macro, navBar, CSS or live JSON change is required for this timestamp update.

## October 23 layout, loader and ownership update

Upload the updated runtime attachments from the configured ZIP to page 3962195316, replacing matching filenames. Keep live JSON attachments unchanged. Use matching page JS/HTMLPage pairs from this build.

Update the WCSpedia helper HTML block in the existing **navBar** using `html/wcspedia-navbar.html`; preserve the actual branded navigation. This adds one small `wcspedia-loading-overlay.js` script immediately after the shared CSS. Do not add a second header or move an application macro into navBar. All seven page HTML macros retain the working morning inline-settings → logic → renderer order; already-restored macros need no change for this update.

The helper starts the opaque overlay as soon as Confluence executes it and passes it to the page. FAQ also uses it. It cannot prevent a native header paint that happens before custom HTML runs. No separate loading CSS or JSON update is needed.

Reader sidebars use the original native collapse control once on activation. Users can expand again. The existing collection icons are centered in the native collapsed rail. Landing and collection pages do not activate the sidebar.

Open a managed document from My Workspace, choose **Reassign owner**, select an active author/manager and enter a reason. Managers/admins and the current owner can use this action with the existing JSON edit grant and native edit permission. It records old/new owner in the audit trail, retains the original author and approved content, and stays on the current view. Reassignment does not create native permissions or change JSON grants. Updating an already-published document also requires native edit access to its published page.

> **Current update:** follow the layout, loader and ownership instructions above. The morning settings/logic/renderer order remains intact; earlier loader instructions below are historical.

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

The seven page pairs are Landing, My workspace, Reviewer workspace, Saved items, Entitlements, Insights and FAQs. Each page fragment loads its matching logic `.js` and `HTMLPage.js`. The navbar owns the single Add document widget; live page code does not mount another. It opens the existing My workspace editor. On denied access/setup errors it stays visible but disabled, with the reason in its tooltip and the console message beginning `[WCSpedia Add document]`. The style marker is a manual marker for native document pages only. The comments scripts in the navbar are background helpers: they add no Load comments control. Comments load automatically near the bottom of eligible child articles, with an in-article retry if loading fails. All seven application macros now open the same overlay immediately, before downloading either page script. The application adopts that overlay and releases it when the visible content or a retryable error is ready; there is no startup skeleton or 200 ms delay. Background refreshes stay interactive.

The policy filename is exactly **`entitlements.json`**, on **3962195316**. Keep its `schemaVersion`, `revision`, `records` and `audit` fields; these are data/history controls, not filename suffixes. If fields were removed, restore them from the last valid policy attachment without resetting grants or audit history. `wcspedia.entitlements.v1` is an internal native content-property key, not a filename or a second JSON to upload. Do not remove native Confluence versions or pointer records. An administrator's JSON creation grant still requires native permissions and the restricted Working page.

JSON reads now use the **latest attachment by filename**. Keep your live `entitlements.json`; a normal manual replacement no longer needs **Review JSON recovery**. Do not add version suffixes or remove JSON schema/revision/audit fields. Missing/invalid files still produce an error, and unfinished saves still need their original request reconciled. Shared scripts, CSS, logos and MDX templates also use stable filename URLs. Saved remains independent of entitlement JSON. See `templates/NATIVE-SPACE-SETUP.md` for write conflict and recovery boundaries.

The reusable MDX template is in both `templates/` and `attachments/`. Native comments remain on articles, favourites are personal Confluence labels, suggestions become document comments, and analytics JSON is downloaded explicitly for manual reporting. Helpfulness votes and recorded views use compact JSON content properties on each published article; health rules/history use `wcspedia-health.json` on each managed document’s Working page. These records are created on successful writes; **no starter JSON is needed**. Insights downloads one combined analytics JSON on demand.

Recording votes/views requires native Edit permission on that article. Health changes require appropriate JSON grants and native Working-page Edit/Add attachments access. JSON does not elevate native permissions. Recorded views cover successful eligible recordings, deduplicated per account for 30 minutes, with an explicit limit of 180 active accounts per document; they do not represent all Confluence traffic. Existing unmanaged pages need enrollment in the WCSpedia approval workflow for health persistence. Article comments remain independent and use native comment permissions.

The latest interface update fixes Entitlements footer controls/code formatting, Insights search/Topics, and action spinners. Insights no longer offers analytics export. Workspace reads now tolerate missing draft-privacy setup while draft writes remain disabled; configure **Working 3961735834**, not the workspace interface pages. See `templates/NATIVE-SPACE-SETUP.md`.

## Simplified content choices

Insights has four groups: Guides, Blogs, Training and Reports. The floating creation menu and editor offer those four plus Job aids. Only Job aids require a business area, reviewer and manager. Topics remain optional; Processes and Regions are under More organisation options. My Workspace uses the shared floating button instead of a second creation button.

Stored types and history are preserved. Procedures, playbooks and checklists appear under Guides; knowledge sharing under Training; reference articles, templates and existing FAQ articles under Reports. Ten general help FAQs appear on the dedicated FAQ page (3973992401), available from the existing header. New MDX uses Job aid, Guide, Blog, Training, or Report.

## Returning after idle

The landing page and Saved items refresh their visible list when the tab becomes visible/focused again after 30 seconds, or Saved items returns from the browser back-forward cache. Events share one in-flight refresh; there is no polling, automatic write, full-page reload or background splash. Saved rows are displayed independently of content-health completion, and Saved-only refreshes do not reload health.

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


## Insights publication and article flags — 22 October correction

Replace the runtime attachments from this package, the matching page HTML fragments, and the combined navBar HTML. Keep your live entitlements and document JSON. No re-publication or new reader group is required for the presentation fix.

- Insights parent remains **3961735728**, in **wcspedia**. Published author records remain in My Workspace; the reader page is a separate child of Insights.
- The unfiltered Insights listing now reads native child pages, nine native rows per request, without waiting for CQL indexing or downloading article bodies/Working JSON. Load more advances past untyped rows. Cards sort the loaded batch by modification date; this is not a global newest-first ordering of unread native pages. If a server rejects the child endpoint with 404/405/5xx, one space-and-Insights-scoped CQL read is used. Text/type/topic searches still depend on the Confluence search index. Empty lists are not retained in the application search cache.
- Direct Insights publications no longer receive missing-classification, missing-approval or missing-review-date alerts. Explicit review dates, owner checks, resources and recorded maintenance issues remain meaningful. Job aid checks are unchanged.
- Optional health-operation lookup uses the native property collection, where an absent journal is an empty result. The helpfulness reader deliberately fetches only your own vote and the view counter: a native `No content property found with key` 404 means no vote/counter yet and is handled as an empty initial state. It is not a missing attachment or a failed save; no starter JSON should be uploaded to that property URL. Keeping targeted reads avoids scanning every reader’s votes on article load. Permission/server failures still remain errors.
- The shared article helper reads native styling labels and legacy markers, then sets a scoped CSS attribute. It does not call host-theme functions or change host-theme classes. Keep the helper loaded once via navBar; never put an article marker in navBar itself.

Verification on the internal site: publish one Blog, open All Insights, then its native reader page. Confirm the page is beneath Insights, the intended chrome flags apply, and it has no Job aid approval badges. Submit a first helpfulness vote, then reload and confirm it remains selected. Local tests do not verify your internal server or host theme implementation.

## Native Insights article template and discovery — 22 October update

New publication templates use native styling labels and a compatibility anchor, with no executable styling macro. The shared navBar helper applies the packaged CSS only to opted-in native article views, excluding editors, previews and application pages.

Published Insights use a reader layout with one content title, byline, summary, cover and article body. The administrative Page Properties table remains stored with `hidden=true`; it no longer dominates the reader page. Native code, images and attachment macros remain native content. The article's Insights link returns to the configured parent, **3961735728**. This is a presentation change, not a permission change.

**Installation:** replace the attachments from this package on **3962195316**, update the matching page HTML fragments, the navBar fragment and your single global stylesheet. Preserve your live JSON. Existing article bodies are stored in Confluence: uploading JavaScript alone cannot replace their old metadata-table template. Open an existing Blog in My Workspace, edit it and publish the updated revision to Insights to regenerate its reader body. Do not delete/recreate the article. For a flags-only correction on an existing article, paste `html/wcspedia-page-style-flags-marker.html` into an HTML macro in that article (not navBar); this alone does not redesign its old body.

The landing page now has an **Insights (Blogs)** card below the business areas. Main search covers documents and Insights under WCSpedia; the card opens the existing dedicated Insights search. Do not put Insights under Working: that private subtree is intentionally excluded from discovery. Native text search still depends on Confluence indexing; All Insights can show a newly published native child before its text is indexed. No article-body scanning or extra per-result requests are added.

Delete confirmation now shows the document key above the blank confirmation field, with a Copy button and a selectable-text fallback. Copying never submits deletion or automatically fills the confirmation field.

## Horizon Chrome loading indicators — 22 October

This installation keeps functional loading indicators animated even when Horizon reports `prefers-reduced-motion: reduce`: action buttons, the Add document loading ring, search, export and the landing indeterminate progress bar. Decorative animation and smooth scrolling still respect reduced motion. The change uses CSS only, with no animation timers, new widget or new stylesheet. No loading overlay is added to non-landing pages.

For this fix alone, replace **attachments/wcspedia-style.css** on attachment page **3962195316**, retaining its filename, then hard-refresh Chrome. The existing navBar already links this file once. If you pasted WCSpedia CSS into Look and Feel instead, replace that existing WCSpedia CSS block with the updated file; do not append another copy. The full ZIP also includes the preceding Insights/article-template updates; use its matching HTML and scripts when installing those together.

### Native styling labels and the shared article reader (2026-10-22)

Publication now adds the native labels `hide-title`, `hide-comments`, `hide-actions`,
`hide-footer`, and `wcs-reader`, alongside the existing discovery labels. Keep
`wcspedia-page-style-flags.js` loaded once from navBar and use the packaged shared
CSS. The helper recognizes the four exact labels in the native page labels area;
labels are not CSS by themselves. Application pages and native editors are excluded.
No new global style block or additional header widget is needed.

Published articles store a public reader snapshot inside their native HTML macro,
in the same page-body revision as the rendered article. It contains only that
published version and public author details, not Working page mappings, drafts,
review evidence or audit history. Published media URLs point at the published
page's copies. Search and Insights link directly to the landing application's
`#/published/<native-page-id>` reader, which uses the same article component as
My Workspace. Native article URLs remain available and gain a **Read article in
WCSpedia** link. This link does not reload or modify private workflow state.

Upload all replacement attachments from this package to **3962195316**, update
page macros with their matching packaged HTML, and refresh the shared navBar
include with `html/wcspedia-navbar.html` as instructed above. Preserve your live
JSON. Existing articles retain their previously saved native bodies: open them
through My Workspace and explicitly edit/republish once to receive the labels,
reader snapshot and reader links. Job aids continue to require approval. Updating
JavaScript attachments alone does not rewrite existing Confluence pages.

The reader checks native page access, space, ancestors, destination and snapshot
identity. It never loads a Working document to display a public article, and does
not fetch individual article bodies while listing search results. These changes
are locally tested; internal Confluence behavior still needs a signed-in smoke test.

### Fluid article alignment and removal of host styling calls

The Article body now fills the same responsive main column as Content health,
Version history and Audit trail. The cover and existing responsive sidebar stay
in their current layout. Upload the replacement shared CSS to fix existing reader
views; no article republish is needed for this alignment change.

Replace the shared page-style-flags attachment and page bundles with this package.
New templates and the optional marker snippet contain no executable styling code.
For an older native article containing the previous inline styling macro, remove
that old styling HTML macro in the native editor, or republish through WCSpedia
(normal approval still applies to Job aids). Uploading scripts cannot remove code
already saved inside a Confluence page. Keep the four native styling labels and
preserve article content, its inert reader-data macro, and live JSON.

### Insights discovery and native article template

- Insights now appears as a card inside the business-area grid, using the same
  card styling. Explore includes Insights in its Collection filter.
- Main search searches the WCSpedia descendant tree, including nested Insights
  pages, without requiring publication/type labels. The Insights collection filter
  scopes to descendants of the configured Insights parent (3961735728), not a
  synthetic business-area label. Working/admin trees remain excluded. Native CQL
  indexing can delay newly published search results; this update does not rebuild
  or bypass the server index.
- Native publications use a dedicated responsive article template: centred title,
  cover, fluid body and details panel. No parent body, interface macro, header or
  sidebar flag is copied. Reports and approved Job aids use this template too.
- The native title retains its unique ` · WCS <page ID>` suffix to avoid collisions.
  Search cards and the visible native page tree omit only that generated suffix
  when it matches the linked page ID; stored titles and links are unchanged.

Replace all installed page JS pairs, the shared CSS and the page-style-flags
attachment with the matching HTML/cache URLs in this package. Keep the existing
navBar include and live JSON. New native template structure applies on the next
explicit publication; existing published pages require republishing (normal
approval for Job aids). The CSS and navigation display fixes apply immediately
when the new assets are loaded. Do not copy the Insights page HTML into articles.
Full interactive history/health/actions remain in the WCSpedia reader; the native
page is a readable, styled publication using the same visual layout.


### Sidebar: document/article readers only

The sidebar is not installed in navBar. Its shared flag helper no longer bundles
sidebar code. The page bundles enable navigation only while displaying a document
reader; native articles include `wcspedia-reader-sidebar.js` in their published
HTML macro automatically. Landing, business-area and Insights listings, My
Workspace, Reviewer Workspace, Saved, Entitlements and editors do not enable it.
The existing Confluence sidebar on other pages is left unchanged.

Upload the new `attachments/wcspedia-reader-sidebar.js` along with the updated
attachments. For an already published native article, add
`html/wcspedia-reader-sidebar.html` once in an HTML macro inside that article, or
let its next normal WCSpedia publication add it. Do not paste this snippet in
navBar. Keep the existing shared CSS. Hard-refresh open tabs after updating the
attachments. Existing live JSON and native article bodies are not bulk-replaced.


### October 23: native sidebar and 15 Insights covers

The reader sidebar now styles Confluence's existing sidebar only. The previous
Knowledge library header, second collapse button, custom icon rail, fixed width
and content-offset overrides have been removed. Native arrows, scroll layout,
Space tools and collapse/expand behaviour remain with Confluence. There is no
replacement sidebar if the host does not render one. Scope remains document/
article readers only; the loader stays out of navBar.

Upload all 15 `wcs-insight-cover-01.jpg` through `wcs-insight-cover-15.jpg` from
`attachments/` to the existing attachment host along with the updated scripts
and stylesheet. Each is an 800×500 JPEG, under 160 KB; all 15 total about 1.3 MB.
Cards keep their own valid cover first. Otherwise a stable hash of the article ID
chooses one fallback, so filter changes and reloads do not shuffle covers. Images
load lazily from Confluence attachments; no external image calls are needed. If
both an authored cover and the fallback fail, the inline SVG remains the final
fallback. Covers are decorative and do not change article metadata or saved JSON.

`licenses/insights-cover-sources.json` records the original Citi article and image
URLs. These are downloaded Citi images, not newly created artwork or a grant of
reuse rights. Original source: https://www.citigroup.com/global/insights/all .

Replace attachments, then hard-refresh existing tabs so older sidebar scripts
are unloaded. Do not add a second navBar, stylesheet, or page tree macro.


### 50-image library update

The current package contains `wcs-insight-cover-01.jpg` through
`wcs-insight-cover-50.jpg`. Upload all 50 JPEGs to attachment host **3962195316**.
Each new Insight's identifier selects a pseudo-random fallback from this pool;
the same article keeps the same choice across readers, sorting, filtering and
reloads. Choices may repeat across different articles. This is a card fallback,
not a rewrite of the author's saved cover or document JSON. Explicit covers
continue to take priority. Existing no-cover cards also use the expanded pool.
The first 15 image filenames are preserved; replacing the page logic enables the
50-image selection. All source URLs are recorded in the included source manifest.

### Earlier loading and performance update — superseded by the current loader instructions

Upload the current `attachments/`, including `wcspedia-style.css`, to the
existing attachment host. Use the matching page HTML snippets from this package,
then hard-refresh open tabs so they load the replaced scripts and stylesheet. Keep the existing navBar; do not add a second overlay widget or CSS
file. Preserve live JSON and permissions.

All application pages now use the same delayed startup overlay. Fast loads do
not flash it. Pending lists have animated skeletons; a background refresh does
not make a usable page inert. Errors and navigation release the overlay. Saved
items no longer show an unavailable/empty-list error while their first read is
still pending. Horizon reduced-motion settings retain functional loading motion.

Landing recent articles load before optional area counts. Each read has its own
bounded deadline instead of one deadline shared by the entire landing load.
Idle refreshes reuse completed area counts and recheck the visible recent list.
Authorized workspace content does not wait for auxiliary saved-item/health reads.

Search responses are cached in memory for up to two minutes (24 entries per
adapter). Query, filter and pagination keys remain separate. Session validation,
identity/access refreshes and writes retain their existing cache invalidation;
no permissions, private drafts or document bodies are persisted in localStorage
or a service worker. A reader or write still makes its own native access checks.
Existing content is retained only on transient read failures, never on an
identity or authorization failure. Failed reads are not cached as empty lists.

Publishing transfers at most three independent attachments concurrently and
waits for started transfers to settle before exposing an upload failure. Byte
verification, native version checks, request IDs and recovery checkpoints are
preserved. Existing publication labels are not posted again if already present.
The 50-image pool remains a fallback only: an author's valid cover wins; a missing
or failed cover selects the article's stable image from the pool.

These are local implementation and fixture-test results. Confluence server
latency and the Horizon network still determine live response times.

## Reader sidebar links and icons — 23 October

Replace the attachments with this build, including `wcspedia-reader-sidebar.js`, `wcspedia-page-style-flags.js`, `wcspedia-style.css` and the page bundles. Hard-refresh existing tabs. Keep the existing native sidebar: its tree, indentation, expand/collapse controls and dimensions remain owned by Confluence.

On document readers, page-tree links receive small document/folder icons and list bullets are hidden. Published WCSpedia child pages with both `wcs-published` and `wcs-reader` labels, in the configured space/root and outside Working, open the same `#/published/<pageId>` reader as My Workspace. The helper changes real link destinations, including keyboard and new-tab navigation. It verifies metadata with at most three concurrent read-only requests and a six-second timeout per request; no second tree is fetched. Collections, unmanaged pages and failed/unverified lookups retain their native URLs. Leaving the reader restores the original links and removes the icons.

CSS alone cannot change link destinations. Keep the existing article-local sidebar HTML macro on native articles; do not add its loader to navBar. For an older article missing it, insert `html/wcspedia-reader-sidebar.html` once into that article's HTML macro. New publications already include it. The existing header configuration supplies the confirmed root and space IDs; do not add another navigation header or reset JSON. Local fixture tests do not verify the internal Confluence instance.

## Native light and dark themes — 23 October

WCSpedia now uses Confluence's native design tokens for text, surfaces, borders, focus, links and status colours. It follows the active host theme immediately, without another toggle, JavaScript listener, stylesheet request or library. `data-color-mode="dark"` has scoped colour fallbacks for hosts whose token stylesheet loads later. The original/light theme retains the existing Citi fallback colours. Host theme tokens take precedence. Images, Citi logos and deliberate branded artwork are not inverted.

The single `attachments/wcspedia-style.css` covers the landing page, Insights, reader, Workspace, Saved, Entitlements, editor, dialogs, notifications, loading/skeleton feedback, native published articles and reader sidebar. Existing published articles pick up the CSS without republication. Sidebar links have themed document/folder icons, hover/selected colours and focus outlines; native tree positioning and controls are unchanged. Its reader-only loader still belongs on articles, not navBar.

For this theme update, replace **wcspedia-style.css on attachment page 3962195316** and hard-refresh. Keep the existing Citi/CP.css Look and Feel import and the existing navbar stylesheet link. Do not paste the compiled CSS into an HTML macro, add a second stylesheet or replace live JSON. If updating from an earlier release, use the package's full attachments as documented above.

Test using Confluence's profile menu in Light and Dark, and switch with an article/editor open. Verify text, Article details, form fields, dropdowns, dialogs and sidebar selection. Local fixtures verify WCSpedia's theme integration and fallback contrast; they do not establish the internal instance's theme/plugin behaviour. Author-supplied images and embedded third-party content keep their own presentation.

## Startup overlay and deletion update — 23 October 2026

Upload all seven page JavaScript pairs (`wcspedia-landing`, `wcspedia-my-workspace`, `wcspedia-reviewer-workspace`, `wcspedia-saved-items`, `wcspedia-entitlements`, `wcspedia-insights`, `wcspedia-faq`, each `.js` and `HTMLPage.js`) to **3962195316**. Replace the existing HTML macro on each matching page with its configured file from `html/`. Updating JavaScript alone cannot start the overlay before its attachment downloads. Keep the existing navBar include and its one shared stylesheet; do not add another loader to navBar. Keep live JSON attachments unchanged.

The inline macro starts the loader before the large scripts, transfers the same instance to the app, and exposes Retry on attachment failure or a 60-second startup deadline. Landing reveals its content once the latest list settles; area counts, metrics and health can continue independently. Native Confluence can paint its header before it executes the page HTML macro; space-only page code cannot control that earlier server-rendered frame.

Successful deletion retains the originating list, search filters and pagination on the current native page. Reader links carry a validated return route through reader tabs. A directly opened reader falls back to its current host page's default view. Failed deletion stays in its confirmation dialog. Only browser navigation and read caches change; native permissions and deletion semantics are unchanged.

### Clean landing and dedicated FAQs — 23 October 2026

The landing page retains the original WCSpedia hero styling and heading “A world of knowledge. One place to find it.”, search and at most three compact latest-document cards. Explore, Insights and FAQs stay in the existing header without duplicate links below search. The promotional intro, department label in the landing body, business-area card grid and embedded FAQs were removed. The existing shared header branding is unchanged. Business areas remain available through Explore filters. Home requests only the three latest documents, without business-area count warmups.

The FAQ page uses the Saved page's heading/container layout, with ten initially closed answers and instant local question/answer search. It does not fetch document data, entitlements, analytics or saved items. It follows the shared header-to-page loading overlay and shared light/dark stylesheet. Its configured Confluence page ID is **3973992401**; it is accessible through the existing header.

Installation from `confluence-ready/`:

1. Upload the updated `attachments/` files to the existing attachment host **3962195316**, replacing matching attachments. Keep the shared stylesheet inclusion already in navBar. Preserve live JSON.
2. Replace the landing page's existing HTML macro on **3954553300** with `html/wcspedia-landing.html`.
3. On FAQ page **3973992401**, add one HTML macro containing `html/wcspedia-faq.html`. This loads `wcspedia-faq.js` and `wcspedia-faqHTMLPage.js`; do not paste their JavaScript as page text.
4. Refresh the existing page macros from the same package as you update their script pairs, so their page mappings include FAQs. Refresh the existing `html/wcspedia-navbar.html` helper block in navBar to exclude the FAQ page from article comments; preserve your native header and logo. Do not add a second navbar or place the FAQ page macro there.

The package is prepared and tested locally; deployment on the internal Confluence instance is a separate installation step.


### Morning startup restored — 23 October 2026

This package restores the page-loading implementation recovered from the 09:51 local command record on 23 October, before the inline overlay and subsequent recovery changes. The first six pages use that recorded startup code; FAQ uses the same sequence and retains its current content. This is a startup-only rollback: later design, editor, search and content changes remain.

**These rollback instructions supersede earlier inline-overlay and settings-recovery instructions above.** Each page macro contains its root, one small inline settings block, then the matching logic and HTMLPage attachments in order. There is no inline page-boot module, markup JSON fallback or page-local config recovery. The optional current navBar helper starts the overlay before page attachments and hands it to the application. Without that helper, the application starts it after loading. Both paths use one overlay without duplicate startup skeletons.

1. Upload all seven matching JavaScript pairs (14 files) to attachment page **3962195316**, replacing existing filenames.
2. On each interface page, replace the entire existing HTML macro with its matching configured file from `html/`, then publish. Use the destination table below. Keep one application macro per page.
3. For the current loader update, also replace the WCSpedia helper block inside navBar as described at the top. Hard-refresh the page. No JSON replacement is needed; preserve all live data and entitlements.

The pre-rollback code/package and recovered builder are preserved locally under `archive/startup-before-morning-rollback-2026-10-23/`. Tests check the generated macros with the matching scripts; live Confluence behavior has not been verified from this machine.

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
| FAQs | `3973992401` | `html/wcspedia-faq.html` |

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
