# WCSpedia native-session installation

This release implements Add document, draft saving, review/publishing, entitlement editing, Saved items, suggestions, helpfulness voting, recorded views and content-health persistence through built-in Confluence APIs. It requires no department server, backend, custom REST routes, plugin or service account. Keep the existing editor, design, header and fonts. All requests use the current user's same-origin Confluence session.

## Install the configured package

1. Extract `WCSpedia-configured-upload.zip`. Upload the individual files in `attachments/` to page **3962195316**, replacing matching filenames. Every supplied attachment is checked against **10 MB (10,000,000 bytes)**. Do not upload the ZIP itself.
2. Replace the six interface page HTML macros using their matching files from `html/`. Each fragment loads its own logic JS and HTMLPage JS pair. IDs are already configured. `authoringMode: "confluence-session"` selects native storage; leave legacy service URLs empty.
3. In the existing shared **navBar** (`{include:wcspedia:navBar}`), replace the old WCSpedia widget/style/notification/article-helper fragments with **one** `html/wcspedia-navbar.html` macro in the right-hand action row. Preserve navigation and inherited fonts. This fragment includes the single global stylesheet and all shared helpers. Add document sits before native Create; denied or failed checks leave it visible but disabled with a diagnostic tooltip. Do not also install an older header ZIP.
4. Keep your live `entitlements.json` on the attachments page. **Do not replace it with `initial-json/entitlements.json`.** The starter is only for first installation. Keep older JSON/history as migration backups; the new workflow does not overwrite or automatically import an older service's private drafts.
5. In native Confluence, restrict **viewing** of Working page **3961735834** to the authors, reviewers and managers who may access drafts. Keep this parent editable by the author/reviewer/manager group as well as viewable by them. On Data Center versions that omit space operations, verified ability to edit this parent is used as positive evidence of native Add page permission; excluding authors from its edit restriction can keep Add document disabled. Individual draft pages receive their own narrower edit restrictions. The code verifies a non-empty view restriction on Working or one of its native ancestors before it creates working content. A merely edit-restricted parent is insufficient.
6. Limit native editing of attachments page **3962195316** to trusted entitlement administrators. They need native Edit permission and the appropriate WCSpedia JSON grant. They also need the native Add attachments permission, because saving the policy writes an attachment version. Confluence supplies the actual security boundary; JSON cannot elevate native access.
7. Add colleagues through the existing Entitlements screen. With the current schema, a full entitlement administrator is a workflow Manager; active Add/Edit document holders are Authors and can be assigned as reviewers. An author cannot review or approve their own revision. BR47149 alone is therefore insufficient to complete an end-to-end approval: add another eligible manager and verify that person's native access. Reviewer and approving manager may be the same colleague, but both actions are explicit.
8. Helpfulness votes and recorded views require native **Edit/update permission on the published article**, because they write content properties. Reader-only users can still read the article and comments, but their votes/visits cannot be recorded by this implementation. Do not grant broad article editing merely to inflate analytics coverage. Content-health saves require the appropriate current WCSpedia grant plus native Edit and Add attachments access to that document’s Working page; rule management and verification additionally require the existing Manager role.
9. A person creating a working page, and the manager publishing it, need native Add page and Add attachments permissions. Draft source, workflow metadata and media all use document attachments. Suggestions and article comments require native Add comments permission; Saved items require access to the article. Applying per-page edit restrictions also requires the installed instance's Restrict/Edit permission. A missing permission produces an explicit error; the app does not bypass it.

## Where data is saved

| Feature | Native storage |
| --- | --- |
| Drafts and editable source | A working Confluence page beneath Working, with its own `wcspedia-document.json` attachment. The page is `status: current` in Confluence, with Draft/Review status managed by WCSpedia. |
| Assignments, revision and workflow audit | Per-document JSON and small versioned content properties on that working page. No full-library JSON download is needed for landing/search. |
| Approved article | An ordinary native child page beneath its configured business area, or Insights for Blog, Knowledge sharing and Reference. Revisions update the same published page ID. |
| Images and files | Versioned attachments on the relevant document pages. Publication stages and verifies media before exposing the new article. |
| Entitlements | Existing `entitlements.json` on the shared attachments page. Add/Edit/Revoke update it from the Entitlements screen with a conflict-checked pointer. |
| Saved items | The signed-in user's native Confluence favourites (`my:favourite`). No shared saved-items JSON. |
| Suggestions | Native comments on the selected WCSpedia document. No page reload; posting state is confirmed or shown as uncertain. There is no separate service inbox. |
| Helpfulness | One compact versioned JSON content property per account/document on the published article. A later vote replaces that account’s choice; the evaluated native page version is retained. |
| Recorded views | One compact versioned JSON counter/deduplication property on each published article. One successfully recorded visit per eligible account per rolling 30 minutes. |
| Content health | `wcspedia-health.json` on the managed document’s restricted Working page, plus versioned pointer/operation properties. Saves retain rules, assignments, review evidence and audit history. |
| Comments and analytics | Comments stay native. **Download analytics JSON** on Insights explicitly reads comments and engagement and downloads one combined `wcspedia-analytics.json` for manual analysis. |

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

View restrictions inherit; edit restrictions do not. The workflow verifies the working parent and applies individual edit restrictions. It stages a first publication under Working before moving it to the reader destination. Existing native page content and legacy service records are not automatically enrolled into this new per-document workflow.

Before department rollout, test with two actual accounts: save a small draft, reload it, submit, review, approve, verify the child page and media, make a new revision, check Saved items and send a suggestion. Also verify a user without rights cannot perform these actions. On an article, check a helpfulness vote survives reload, changing the vote replaces it, and repeated visits within 30 minutes do not add to recorded views. Test an account without article Edit permission and confirm it receives an unavailable recording state rather than a successful vote. Save content-health rules on a managed published document, reload, and verify the retained rules/evidence and conflict recovery. Download analytics JSON from Insights and check its aggregate counts and coverage. Disabling blog comments must leave helpfulness and view recording independent. Local automated tests cannot establish your internal instance's permissions, installed REST behavior or network performance.

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
