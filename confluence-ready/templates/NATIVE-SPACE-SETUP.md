# WCSpedia native-session installation

This release implements Add document, draft saving, review/publishing, entitlement editing, Saved items, suggestions, helpfulness voting, recorded views and content-health persistence through built-in Confluence APIs. It requires no department server, backend, custom REST routes, plugin or service account. Keep the existing editor, design, header and fonts. All requests use the current user's same-origin Confluence session.

## Install the configured package

1. Extract `WCSpedia-configured-upload.zip`. Upload the individual files in `attachments/` to page **3962195316**, replacing matching filenames. Every supplied attachment is checked against **10 MB (10,000,000 bytes)**. Do not upload the ZIP itself.
2. Replace the seven interface page HTML macros using their matching files from `html/`. Each fragment loads its own logic JS and HTMLPage JS pair. IDs are already configured. `authoringMode: "confluence-session"` selects native storage; leave legacy service URLs empty.
3. In the existing shared **navBar** (`{include:wcspedia:navBar}`), replace the old WCSpedia widget/style/notification/article-helper fragments with **one** `html/wcspedia-navbar.html` macro in the right-hand action row. Preserve navigation and inherited fonts. This fragment includes the single global stylesheet and all shared helpers. Add document sits before native Create; denied or failed checks leave it visible but disabled with a diagnostic tooltip. Do not also install an older header ZIP.
4. Keep your live `entitlements.json` on the attachments page. **Do not replace it with `initial-json/entitlements.json`.** The starter is only for first installation. Keep older JSON/history as migration backups; the new workflow does not overwrite or automatically import an older service's private drafts.
5. Open **Entitlements (3961735763)** as a full WCSpedia entitlement administrator who also has native **Space Admin**. That administrator needs native Edit on the protected policy host **3962195316** and Working **3961735834**, plus Add attachments to save JSON. Click **Sync access** once for the existing roster. Later Add/Edit/Revoke saves synchronize automatically. Authors and reviewers need Working **View**, not Working **Edit**. The sync preserves the parent's edit list, creates no groups, and keeps draft viewing restricted. Keep My Workspace and Reviewer Workspace interface pages readable by their intended users.
6. Limit native editing of attachments page **3962195316** to trusted entitlement administrators. They need native Edit permission and the appropriate WCSpedia JSON grant. They also need the native Add attachments permission, because saving the policy writes an attachment version. Confluence supplies the actual security boundary; JSON cannot elevate native access.
7. Add colleagues through the existing Entitlements screen. With the current schema, a full entitlement administrator is a workflow Manager; active Add/Edit document holders are Authors and can be assigned as reviewers. An author cannot review or approve their own revision. BR47149 alone is therefore insufficient to complete an end-to-end approval: add another eligible manager and verify that person's native access. Reviewer and approving manager may be the same colleague, but both actions are explicit.
8. Helpfulness votes and recorded views require native **Edit/update permission on the published article**, because they write content properties. Reader-only users can still read the article and comments, but their votes/visits cannot be recorded by this implementation. Do not grant broad article editing merely to inflate analytics coverage. Content-health saves require the appropriate current WCSpedia grant plus native Edit and Add attachments access to that document’s Working page; rule management and verification additionally require the existing Manager role.
9. A person creating a working page, and the manager publishing it, need native Add page and Add attachments permissions. Draft source, workflow metadata and media all use document attachments. Suggestions and article comments require native Add comments permission; Saved items require access to the article. The Job aid workflow also requires the installed instance's Restrict/Edit permission to apply its per-page edit restrictions. Direct Insights publishing does not require restriction-write permission. A missing permission produces an explicit error; the app does not bypass it.

## Business-area pages and optional governance

Install each configured `html/areas/{slug}.html` on the matching existing area parent from the package page-ID table. It reuses the landing Explore implementation with `businessArea` fixed to that area; descendants are included in native search. Update the navBar helper fragment for area-page loading coverage. Do not place the area macro in navBar.

Current macros set `governanceEnabled: false`. The editor and approval dialogs omit governance metadata, the extra checklist and the review-date requirement. Existing stored metadata remains intact; reviewer/manager assignment, exact-revision approval, native authorization and audit are retained. Existing formal-reference records still require their authoritative process.

A 403 on `/rest/api/content/{id}/restriction` requires native Restrictions plus document Edit permission. Run **Sync access** as the native space administrator, then retry the original action with **Check save**. The workflow applies assigned author/reviewer/manager restrictions on Job aid drafts automatically. Successful Blog publishing does not test restriction permission. Preserve Working viewing restrictions; do not create duplicate drafts.


## Automatic Entitlements-to-Confluence synchronization

The configured macros enable `nativeAccessSync: true`. The helper is bundled in the page JavaScript; do not add another macro, script or JSON attachment. Replace the matching current page bundles and macros, including Entitlements, My Workspace, Reviewer Workspace and the existing navBar fragment. Preserve live `entitlements.json`.

1. A full entitlement administrator with native Space Admin opens **Entitlements → Sync access** to reconcile the existing roster.
2. Add, edit or revoke a person in Entitlements. The verified JSON save automatically runs native synchronization as that signed-in administrator.
3. Continue only when the panel confirms **Native access synchronized**. If it reports incomplete setup, the JSON remains saved. Correct the reported native issue and use **Sync access**; do not add the person again.

| JSON access | Native grants managed by synchronization |
| --- | --- |
| Active document creator/editor, or full entitlement administrator | Space View, Pages Add/Edit, Attachments Add, Restrictions; individual Working viewing access |
| Active document deletion entitlement | The above plus Pages Delete |
| Inactive or removed document access | Remove grants previously added by WCSpedia that are no longer needed; preserve existing native administrator/manual/group grants and report retained access |

No Space Admin grant is created. Native space grants apply across the space, even when a JSON edit/delete entitlement is limited to one document. Native document restrictions and JSON workflow checks still apply; this browser workflow cannot turn broad native permissions into server-enforced per-document JSON permissions. Native readers outside this roster are unaffected. Comments permissions are not changed.

The signed-in administrator must be allowed to use the installed Data Center user-space permission APIs: `GET /rest/api/space/{spaceKey}/permissions/user/{userKey}`, and `PUT` to its `/grant` and `/revoke` subpaths. The implementation uses the [documented Data Center API](https://developer.atlassian.com/server/confluence/rest/v9225/api-group-space-permissions/). If this Confluence version does not expose them, or the administrator receives 403, the package reports incomplete setup; browser JSON cannot bypass that server limitation. No privileged credentials, server installation, new group or service account is used.

The synchronizer updates **Working viewing** and preserves **Working editing**. An independently restricted ancestor can still deny viewing, so sync stops and identifies that ancestor instead of broadening unrelated access. Existing native groups and grants remain administrator-owned; a warning means their access has not been revoked by JSON. Keep the policy host restricted to trusted administrators. The native workspace interface pages must be readable independently of Working.

Creation now checks native space Add page permission, using the explicit per-user permissions API if `space.operations` is absent. Parent Edit is never used as a substitute. Reviewers need native View on Working and the assigned document's Edit permission; the Job aid workflow manages those individual document restrictions when the author saves/submits. The widget continues to check the JSON creation grant and verified draft privacy.

Synchronization state and its resumable grant ownership record use the protected host's native content property `wcspedia.access-sync.v1`. No upload or manual editing of that property is needed. It supports up to 120 managed accounts and complete restriction lists up to 200 subjects per type. Limit errors preserve the state and never report success. Space/page writes and the JSON save are separate operations; an interrupted run can leave partial grants until retried. Cooperating runs use a versioned lease, policy/identity rechecks and read-after-write verification. Native/manual concurrent permission edits are not atomic with those checks, so do not change the same permissions manually during synchronization.

Automatic means **after a save in WCSpedia's Entitlements screen**. A manual JSON upload requires **Sync access** afterward. No synchronization runs in a closed browser or background scheduler. If a JSON-only administrator saves without native Space Admin, JSON saves but native access remains incomplete until an authorized native administrator synchronizes.

Before rollout, use two real accounts: sync an author and reviewer, leave both out of Working's edit list, create a Job aid, submit, review and approve; verify an unrelated reader cannot view Working. Then revoke an app-managed test user and check access is removed. Local fixtures cannot verify the internal instance's endpoint availability, native permissions or custom restriction rules.

## Where data is saved

| Feature | Native storage |
| --- | --- |
| Drafts and editable source | A working Confluence page beneath Working, with its own `wcspedia-document.json` attachment. The page is `status: current` in Confluence, with Draft/Review status managed by WCSpedia. |
| Assignments, revision and workflow audit | Per-document JSON and small versioned content properties on that working page. No full-library JSON download is needed for landing/search. |
| Approved article | An ordinary native child page beneath its configured business area, or Insights for every supported non-Job-aid type. Revisions update the same published page ID. |
| Images and files | Versioned attachments on the relevant document pages. Publication stages and verifies media before exposing the new article. |
| Entitlements | Existing `entitlements.json` on the shared attachments page. Add/Edit/Revoke update it from the Entitlements screen with a conflict-checked pointer. |
| Saved items | The signed-in user's native Confluence favourites (`my:favourite`). No shared saved-items JSON. |
| Suggestions | Native comments on the selected WCSpedia document. No page reload; posting state is confirmed or shown as uncertain. There is no separate service inbox. |
| Helpfulness | One compact versioned JSON content property per account/document on the published article. A later vote replaces that account’s choice; the evaluated native page version is retained. |
| Recorded views | One compact versioned JSON counter/deduplication property on each published article. One successfully recorded visit per eligible account per rolling 30 minutes. |
| Content health | `wcspedia-health.json` on the managed document’s restricted Working page, plus versioned pointer/operation properties. Saves retain rules, assignments, review evidence and audit history. |
| Comments and analytics | Comments stay native. Article analytics exports read comments and engagement for manual analysis; Insights has no analytics download control. |

No starter JSON is required for helpfulness, recorded views or content health. Successful native writes create their records automatically. Content properties are native JSON storage, not attachments you need to upload. No shared analytics attachment is rewritten on article visits. Preserve all existing records; uploading an empty starter would not enable or repair these features.

Content health is available for WCSpedia-managed published documents with a verified approved source and Working page. Existing unmanaged native pages must first enter the authoring workflow before rules can be saved for them. Checks run in the existing screens; this does not install a background scheduler.

**Recorded views are eligible WCSpedia recordings, not total Confluence traffic.** Native readers without update permission, anonymous traffic and visits where recording fails are outside the count. The view ledger admits up to 180 active distinct accounts per document per rolling 30-minute window, conservatively below the native 32 KB property limit. Additional recordings fail explicitly until entries expire; no old count is dropped. Native editors can also edit properties outside WCSpedia, so these votes/counters support cooperative reporting, not tamper-proof ballots or immutable audit evidence. See [MANUAL-ANALYTICS.md](MANUAL-ANALYTICS.md) for exported coverage and version totals.

Business-area and topic discovery continues to use scoped native CQL. Working pages and interface/attachment pages remain excluded. Newly published labels may take time to enter Confluence's index; cached searches are invalidated after a successful mutation. First-load latency still depends on the internal server.

## Conflicts and recovery

Native page versions prevent stale page overwrites. Normal JSON reads resolve the **latest attachment by its full filename**, on the configured page. This applies to `entitlements.json`, working-document JSON and content-health JSON. A manual newer upload or deletion/re-upload no longer requires reconnecting an old attachment reference. A missing previously managed file is an error, not an empty policy or permission to reset it.

Reads validate the filename/container, native permissions, size and JSON, then recheck metadata to detect a change during download. Saves retain the file ID, revision and SHA-256 fingerprint observed when loading; a replacement after that observation is rejected before upload. Cooperating writers still reserve a small native content property before uploading and commit their receipt afterward. Existing attachment writes use `/child/attachment/{attachmentId}/data`. No version suffix needs to be added to filenames or macro URLs.

**An unfinished save is the exception to ordinary latest reads.** Until its original request is reconciled, readers retain the verified pre-save snapshot and its pending marker; uploaded but unconfirmed data does not silently become policy. For an interrupted write, keep the original editor/action open and retry the same action with the same request ID. The implementation checks native markers, hashes and the operation journal before continuing; it does not blindly repeat an uncertain upload or create another publication. If a different operation is pending, have the space administrator inspect that document's journal and native history. Never delete a pending property merely to dismiss the error.

Manual uploads are not part of the native content-property reservation. Attachment uploads and property updates are **not an atomic transaction**, so do not edit the same JSON manually while another user saves it through WCSpedia. Keep backups. Existing `schemaVersion`, policy `revision`, audit records and Confluence's native history remain; these are data/coordination fields, not separate filenames.

The older **Review JSON recovery** tools remain available for exceptional integrity/conflict investigations. Ordinary replaced files now load without that step. Recovery still requires native Edit permission on the JSON host and cannot discard a pending save. Protect the attachment host: its native editors can change the policy file directly; JSON grants never elevate native permissions.

**Saved items are independent of entitlement JSON.** They use the signed-in user's native Save for later labels and page read permissions. A JSON error cannot block Saved, and failed access checks keep Add document disabled.

Shared JS, CSS, logos and MDX templates use stable filenames and current-attachment URLs. The MDX template loader also removes old `v`/`version` suffixes from configured hosted template links and revalidates its HTTP cache. Internal exact-version reads remain for upload confirmation, unfinished-save recovery and approved document media; these verify the bytes an action approved and are not installation settings.

This follows LPTM's latest-by-filename reading and `/data` upload pattern while retaining WCSpedia's validation and cooperative write coordination. Native comments, saved items, votes and view counters that use Confluence content/labels/properties continue using those APIs; they are not converted into shared attachment files.

## Header visibility and attachment URLs

There is only one policy filename: **`entitlements.json`**, on attachments page **3962195316**. Do not upload a file named `wcspedia.entitlements.v1`: that is a native content-property key used to coordinate saves, not a filename. Initial JSON reads check the metadata collection, where an absent pointer is a normal empty result. A 404 from the collection or a POST is a real endpoint/access failure and must not be ignored.

The same attachment rules apply to JSON, Excel and other files:

- First upload: `POST /confluence/rest/api/content/3962195316/child/attachment`.
- Replace existing file bytes: `POST /confluence/rest/api/content/3962195316/child/attachment/{attachmentId}/data`, using the attachment's numeric ID, multipart `file`, and the original filename.
- Read JSON: `/confluence/download/attachments/3962195316/entitlements.json`. Managed reads select the committed native revision for consistency.
- Page and content-property POSTs use their own native endpoints. Do not append `/data` to those.

Confluence keeps native attachment revisions under the same filename. Keep these revisions and JSON revision checks: they prevent cooperating users from silently overwriting each other's saves and support recovery after uncertain responses. Script URLs now keep `?api=v2` without an added `v=` cache token. Hard-refresh after replacing attachments so old cached scripts are not reused. Always replace both JavaScript files and the supplied HTML fragment together.

For a missing Add document button, update the **header pair and header macro**, not only the workspace page. The widget needs an active `content.create` grant, verified native page creation access, and a Working page whose **viewing** is restricted to authors/reviewers/managers. The current widget preserves the actual failure in `[WCSpedia Add document]` console messages and `data-wcs-add-message` / `data-wcs-add-code` on its host. A transient timeout/network failure retries once; missing grants and invalid setup do not automatically retry. The first metadata lookup does not require a manual starter/pointer upload.

For diagnosis, this browser-console expression only reads the widget state:

```js
Object.assign({}, document.querySelector('[data-wcs-header-add-document]')?.dataset)
```

After correcting native permissions or Working-page restrictions, reload the page. Do not remove permission checks or force a disabled button enabled with CSS.

### One shared navbar fragment

Install `html/wcspedia-navbar.html` once. It includes the global stylesheet, notifications, the Add document JS pair, child-page flags and the article discussion/engagement helpers. Upload every file in `attachments/` from this same package. No separate header installation is needed.

Add document opens My workspace's existing editor. Article comments mount only below eligible articles, never in the navbar or on interface pages. Back/Forward restoration rechecks creation access. Duplicate current widget hosts collapse to one; remove any old manually written button HTML and widget CSS when replacing the old fragments.

Comments use the article's native Confluence comments and current user's permissions. Successful submissions update the list in place. A failed attachment load offers “Retry loading comments” without reloading the article; the native-comments link is a fallback. The helper does not enable comments that the article setting has disabled.

## Approval boundary and live verification

This is a cooperative workflow running in the browser. Confluence enforces native permissions and keeps native history. Browser code cannot impose a new server condition saying that native Add/Edit rights may be exercised only after approval; someone with those rights may also use Confluence's native UI/API. Application audit timestamps and JSON are metadata, not a tamper-proof audit service.

View restrictions inherit; edit restrictions do not. The workflow verifies the working parent; only Job aid approval applies individual edit restrictions. Blogs, Guides, Training and Reports retain ordinary native page access. Existing restrictions are never removed to get around a failed edit. It stages a first publication under Working before moving it to the reader destination. Existing native page content and legacy service records are not automatically enrolled into this new per-document workflow.

Before department rollout, test with two actual accounts: save a small draft, reload it, submit, review, approve, verify the child page and media, make a new revision, check Saved items and send a suggestion. Also verify a user without rights cannot perform these actions. On an article, check a helpfulness vote survives reload, changing the vote replaces it, and repeated visits within 30 minutes do not add to recorded views. Test an account without article Edit permission and confirm it receives an unavailable recording state rather than a successful vote. Save content-health rules on a managed published document, reload, and verify the retained rules/evidence and conflict recovery. Use the article analytics export for manual checks; Insights has no analytics export control. Disabling blog comments must leave helpfulness and view recording independent. Local automated tests cannot establish your internal instance's permissions, installed REST behavior or network performance.

Native API references: [page creation and versioned updates](https://developer.atlassian.com/server/confluence/confluence-rest-api-examples/), [content properties](https://developer.atlassian.com/server/confluence/content-properties-in-the-rest-api/), [page restrictions](https://confluence.atlassian.com/doc/page-restrictions-139414.html).

## Loading and action feedback

Page macros contain an empty mount div. Other pages use normal Confluence navigation with no WCSpedia startup message, skeleton, splash or loading overlay. The existing navbar stays usable while authorized content loads. Only the landing screen can show the Citi loading overlay; it waits 200 ms before appearing and is cancelled if startup finishes first. This does not delay requests. Native identity and scope reads start together. Fresh native permissions remain required on navigation and before mutations.

Pending form commands show an animated spinner on the button that submitted them and prevent duplicate submissions. The same feedback covers editor saves, saved items, clipboard actions, search, Insights/analytics, article comments/helpfulness and the header's access recheck. Local filtering and pagination stay immediate. Errors stop the spinner; an uncertain write can still require reconciliation before retrying. Reduced-motion settings disable spinning.

For this update, replace the page JS pairs and global CSS from the configured attachments folder, update each page's HTML macro, and update the header widget/discussion scripts and their supplied fragments. Preserve your existing header, fonts and live JSON attachments.

### Search as you type

Landing search shows matching pages from the first character. Business-area and results views update their list automatically without Enter, a page reload, or replacing the input. A spinner appears immediately, and a 150 ms debounce combines rapid typing. Superseded requests are aborted and stale responses ignored. Filters remain selected; changing the query resets pagination. The final plain word uses a trailing CQL wildcard (for example `cred*`) while special characters remain escaped. Scope and permissions remain restricted to the configured WCSpedia tree. See [Atlassian's CQL text-search reference](https://developer.atlassian.com/server/confluence/performing-text-searches-using-cql/). Live response time still depends on Confluence's index and server.

## Workspace access and draft privacy

Keep the **My Workspace (3961735744)** and **Reviewer Workspace (3961735749)** interface pages accessible to their intended users. Set **Viewing restrictions** on the separate **Working page (3961735834)** for authors, reviewers and managers. Native viewing restrictions inherit to draft children; edit-only restrictions do not protect draft visibility. The app now recognizes inherited viewing restrictions as well as restrictions directly on Working.

A missing/unverifiable draft privacy setting no longer stops workspace listing. Existing documents still load through native Confluence read permissions and the WCSpedia assignment filter. Draft mutation controls and Add document stay disabled, with a specific reason, until privacy can be verified. A native 403/404 on Working itself still requires correcting that account’s native access; JSON grants cannot override it. Per-document edit restrictions remain required when saving/publishing; this update does not silently relax them.

Keep drafts private. If the instance does not let your account set restrictions, ask the space owner to configure Working and grant the relevant native permissions. No server installation is required. Verify with a separate reader account that Working and draft attachments are inaccessible while approved business-area articles remain readable.

## Interface update

Replace the matching page JS pairs, shared header pair and global CSS from the configured package, then hard-refresh to reload stable attachment URLs. Keep your existing live JSON. Entitlement records and access-change history default to ten rows; their page-size controls sit below the table on the left and pagination on the right. SOEIDs, scope identifiers and audit JSON use code formatting. The active-record/signed-in/policy-revision banner is removed. Insights uses the shared search button and Topics popover, and no longer exposes analytics export or performs the associated management-policy request. Busy actions have their own spinner element, independent of tooltips and tab underlines.

## Working collection compatibility and floating creation control

Workspace discovery requests only space, ancestors, version and operations from the Working child collection. If that collection rejects the request with HTTP 400/405 or a server error, it restarts once with native CQL restricted to `type = page AND space = "wcspedia" AND parent = <Working ID>`. Every returned page is checked against that space and direct parent. HTTP 401/403/404 and cancellation do not trigger fallback; a failed fallback remains an error. Matching workflow summaries determine which full document bodies need loading. The CQL fallback depends on Confluence indexing, so newly created pages may take time to appear if the child endpoint remains broken.

Add document checks capabilities independently of workspace listing. A child-list HTTP 500 does not prove the grey FAB has the same cause. Its tooltip and `[WCSpedia Add document]` console message identify the failed entitlement, native permission, privacy or network check. No grant bypass is used. The floating button retains clearance below the navbar when a theme scrolls its include wrapper but keeps the visible navigation fixed.

## Blogs and save recovery (2026-10-21)

Every supported type except Job aid uses the existing WCSpedia editor with **Destination: Insights** and a **Publish to Insights** button. They have no business-area, reviewer or manager fields. Publishing and subsequent Insights edits do not enter the review queue or invent approval records. Job aids retain review and approval. Legacy non-Job-aid documents adopt direct Insights publishing on an explicit authorized save, preserving history. Insights remains page `3961735728` within WCSpedia.

The restricted Working parent still stages source/media and recovery metadata before publication. A blog's readable native page is placed under Insights; it is an ordinary child page, not a Confluence blogpost. Publishing still requires the current user's WCSpedia creation/edit entitlement and native permissions. The comments switch remains available.

Writes have a separate 60-second confirmation timeout; ordinary reads retain 12 seconds. A timeout is not proof of rejection. **Check save** keeps fields locked and resubmits the exact original command/request ID. It first reconciles the existing page/journal before continuing. Stay in the editor until this resolves; do not create a second copy or remove native restrictions. The error identifies the native method/path that did not confirm. Manual changes or a different pending operation are still surfaced as conflicts.

One save no longer repeats the same root, identity and policy preflight solely to assemble its returned workspace. A new action still rechecks authorization. Workspace listings remain heavier than CQL discovery because they load editable workflow state for assigned documents. Paginating those summaries and loading full source only when opening an editor is the next larger performance improvement; this release does not claim that work is complete.

For a blog MDX metadata block use `type: "Blog"` and `area: "insights"`. The other fields use the supplied document template. No approval assignments belong in MDX.

## Lighter loading and preview alignment (2026-10-21)

Update all matching attachment pairs and the single global stylesheet from this package. Preserve the live JSON. No extra service, index attachment or header is required.

- Add document loads the verified identity, entitlements, directory and creation permissions without listing Working children or downloading existing document histories.
- Edit/document/review detail routes resolve one stable working-page title inside WCSpedia, then verify its parent, identity marker and native permissions. A save confirms this same document instead of reloading every Working child.
- My Workspace filters owner/author summaries before reading document JSON. Reviewer Workspace filters the assigned active review/approval stage before reading document JSON. Summaries are discovery hints; all writes still recheck authoritative state and permissions.
- Switching from a limited response to another workspace fetches the required scope. An abandoned response cannot overwrite the new screen. Saved items and health are deferred while authoring or managing entitlements.
- New document references use the stable document key, not the number of loaded records.
- Preview heading, cover and article now share one responsive column with equal outer margins.

Workspace lists still enumerate lightweight Working-page summaries within the existing safe limit. Matching documents still load their current metadata/history; this change does not introduce a separate indexed summary store or server-side pagination. Search remains scoped native CQL. Live response times depend on the internal Confluence server.

## Idle return and Add document responsiveness (2026-10-21)

The shared header now reuses its last verified access result only to open the Add document menu and navigate to the editor. Opening and choosing a type no longer repeat the complete access query. This navigation hint lives in memory for this page only; after 60 seconds it refreshes on interaction or returning to the tab, without blocking an already enabled menu. Concurrent refreshes share one check. A denial or error disables the button, and returning to the tab can retry a failed check. Back/Forward restoration and explicit configuration updates still revalidate. The editor and all writes continue to read current identity, policy, native permissions and document versions; the header hint grants no write authority.

Access/JSON requests now have bounded fetch and response-body waits, including cancellation when a transport ignores its abort signal. A failed read releases its caller with an error instead of leaving a form waiting indefinitely. An uncertain write retains the original request and Check save recovery; returning to a tab never unlocks or retries it automatically.

Shared dialog cleanup now notifies the editor when Confluence removes a dialog from the DOM. This prevents a detached dialog handle from silently blocking later editor tools or the leave dialog. Resume cleanup restores only WCSpedia-owned modal state; it does not remove native restrictions or unlock an active save.

Replace the JavaScript attachments with the matching files in the configured package, especially both `wcspedia-add-document` files and both My workspace files. Close old WCSpedia tabs and reopen after uploading to ensure the old script instance is no longer running. Preserve live JSON attachments. There are no new page IDs, JSON files, services or permission changes to configure.

Local regression coverage includes simulated ten-minute idle return, repeat menu clicks with no extra reads, refresh denial/recovery, detached dialogs, preserved draft content, bounded hung requests, and unchanged unknown-write recovery. This is not verification of the internal Confluence session timeout or theme scripts.

## Shared floating controls

Use the supplied `html/wcspedia-navbar.html` once in an HTML macro on the existing navBar page and keep `{include:wcspedia:navBar}` in Look and Feel. Add document stays above a circular Back to top control at the bottom right. The progress ring appears after 8% of scrolling and follows the existing Confluence scroll owner. It does not add a scroll box or change the page URL. A short page needs no Back to top control; Add document keeps its fixed position. The shared script mounts once on native child articles and interface pages. No separate include on every article is needed. Upload the matching Add document JS pair and global CSS, plus the updated page bundles to remove the previous page-owned Back to top implementation.

### Automatic Job aid reviewer access

Creation, Submit for review and Start revision automatically reconcile the Working document's individual editing restrictions to its assigned author, reviewer and manager. This repairs older author-only drafts during an authorized action without asking users to edit each page's restriction dialog. An exact existing match produces no restriction write. Verification/rejection stops before the changed workflow body and state are saved. Publication remains limited to the approving manager. Use the native space permission setup above once for the authoring team; a WCSpedia grant alone cannot authorize the restriction PUT. Manual restriction changes are only a recovery option when that native API step is rejected.

### Live View/Edit validation correction

For the observed HTTP 400 requiring read restrictions for every editor, the writer now submits paired read/update operations. Drafts preserve their existing viewing audience and explicitly add their assigned editors as viewers. First publication clears only the new staged publication's direct viewing restriction in the same request that limits editing to the approving manager; destination and space restrictions still apply. Revisions preserve existing published-page viewing restrictions. Both operations are verified. A rejected publication remains private and is not reported as published. No Confluence group or live entitlement-file change is required by this payload correction. Restore Working-root viewing restrictions if they were removed; current private staging depends on that protection for every content type.
