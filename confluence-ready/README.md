# WCSpedia — space-only upload package

This release keeps the current editor, approval screens, header and fonts and uses built-in Confluence APIs for Add document, drafts, approval/publication, entitlement editing, Saved items, suggestion delivery, helpfulness voting, recorded views and content-health persistence. No custom service endpoints or server installation are required. Keep the existing WCSpedia editor, design and custom approval workflow.

Use only `WCSpedia-configured-upload.zip`, which expands to one `confluence-ready/` folder. It includes all page and navbar files together, with one stylesheet: `attachments/wcspedia-style.css`. No separate header ZIP is needed.

1. Upload all files from `attachments/` to **3962195316**, replacing files with the same names.
2. In your existing **navBar** page, remove the old WCSpedia Add document macros, WCSpedia stylesheet links, notifications and article-helper script fragments. Keep your navigation, native Create control and site font/theme CSS.
3. Paste **`html/wcspedia-navbar.html` once** into an HTML macro in the right-hand action area. This includes the single stylesheet, Add document pair, notifications and scoped child-article helpers. Keep `{include:wcspedia:navBar}`.
4. Replace each interface page's macro with its matching `html/wcspedia-*.html` fragment, using the page-ID table below. Do not paste the navbar fragment into those pages.
5. Publish and hard-refresh. The attachment URLs have no `&v=` cache suffix. No config attachment or standalone widget stylesheet is needed.

All IDs are prefilled. Page fragments contain no document/header/font wrappers. Duplicate current header mounts are collapsed to one; remove older manually written buttons or inline widget styles during step 2.

**Keep your live `entitlements.json`.** `initial-json/` is for first installation only. Keep older projections/history as backups; do not overwrite existing data with starters. The native workflow uses separate document pages and their own metadata attachments, not one growing full-library JSON.

Each file is below **10 MB (10,000,000 bytes) per attachment**. Extract the ZIP and upload individual files. There are no development `.cjs` files in this package.

Before use, restrict viewing of Working page **3961735834** to the authoring/review team and verify native Add/Edit/Restrict permissions. Add a second eligible manager in Entitlements: an author cannot approve their own document. Keep native edit access to the entitlement attachment host restricted to administrators.

Read **[the native setup and recovery guide](templates/NATIVE-SPACE-SETUP.md)** before rollout. It explains storage, the two-account acceptance check, migration limits and cooperative approval. Native Confluence permissions remain authoritative. Local tests do not verify your internal server.

The six page pairs are Landing, My workspace, Reviewer workspace, Saved items, Entitlements and Insights. Each page fragment loads its matching logic `.js` and `HTMLPage.js`. The navbar owns the single Add document widget; live page code does not mount another. It opens the existing My workspace editor. On denied access/setup errors it stays visible but disabled, with the reason in its tooltip and the console message beginning `[WCSpedia Add document]`. The style marker is a manual marker for native document pages only. Comments appear below eligible child articles, never as a navbar button. Only Landing uses the splash.

The policy filename is exactly **`entitlements.json`**, on **3962195316**. Keep its `schemaVersion`, `revision`, `records` and `audit` fields; these are data/history controls, not filename suffixes. If fields were removed, restore them from the last valid policy attachment without resetting grants or audit history. `wcspedia.entitlements.v1` is an internal native content-property key, not a filename or a second JSON to upload. Do not remove native Confluence versions or pointer records. An administrator's JSON creation grant still requires native permissions and the restricted Working page.

JSON reads now use the **latest attachment by filename**. Keep your live `entitlements.json`; a normal manual replacement no longer needs **Review JSON recovery**. Do not add version suffixes or remove JSON schema/revision/audit fields. Missing/invalid files still produce an error, and unfinished saves still need their original request reconciled. Shared scripts, CSS, logos and MDX templates also use stable filename URLs. Saved remains independent of entitlement JSON. See `templates/NATIVE-SPACE-SETUP.md` for write conflict and recovery boundaries.

The reusable MDX template is in both `templates/` and `attachments/`. Native comments remain on articles, favourites are personal Confluence labels, suggestions become document comments, and analytics JSON is downloaded explicitly for manual reporting. Helpfulness votes and recorded views use compact JSON content properties on each published article; health rules/history use `wcspedia-health.json` on each managed document’s Working page. These records are created on successful writes; **no starter JSON is needed**. Insights downloads one combined analytics JSON on demand.

Recording votes/views requires native Edit permission on that article. Health changes require appropriate JSON grants and native Working-page Edit/Add attachments access. JSON does not elevate native permissions. Recorded views cover successful eligible recordings, deduplicated per account for 30 minutes, with an explicit limit of 180 active accounts per document; they do not represent all Confluence traffic. Existing unmanaged pages need enrollment in the WCSpedia approval workflow for health persistence. Article comments remain independent and use native comment permissions.

The latest interface update fixes Entitlements footer controls/code formatting, Insights search/Topics, and action spinners. Insights no longer offers analytics export. Workspace reads now tolerate missing draft-privacy setup while draft writes remain disabled; configure **Working 3961735834**, not the workspace interface pages. See `templates/NATIVE-SPACE-SETUP.md`.

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
