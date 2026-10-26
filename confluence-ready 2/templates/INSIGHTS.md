**Current space-only deployment:** use [NATIVE-SPACE-SETUP.md](NATIVE-SPACE-SETUP.md). The configured package uses native-session persistence for authoring, approval, entitlements, favourites and suggestions. Custom service instructions below are legacy reference and are not required for this installation.

# Insights inside WCSpedia

Use one **Insights parent page inside the existing WCSpedia space**, page **3961735728** beneath landing page **3954553300**. Every supported type except **Job aid** publishes here directly. Job aids alone require a business area, reviewer and approver and publish beneath their business area after approval.


The visible categories are **Guides, Blogs, Training and Reports**. The creation menu and editor offer those four plus Job aids. Guides include existing Procedure, Playbook and Checklist articles; Training includes Knowledge sharing; Reports includes Reference, Template and existing FAQ articles. Legacy stored types remain readable and searchable without rewriting history. New MDX uses `Guide`, `Blog`, `Training`, `Report`, or `Job aid`. Five expandable help FAQs live below the landing page’s latest articles; FAQ is no longer a creation option.

The editor hides business-area, reviewer, approver and governance fields for Insights content. Topic tags and the comments setting remain available. Existing pages keep their history and are not moved in bulk. An authorized editor saving a legacy non-Job-aid document adopts direct publication to Insights; the routing change is recorded in its audit history.

Direct Insights publishing does not call `PUT /rest/api/content/{id}/restriction` or resolve reviewer/manager accounts. Like the earlier `blog.html`, it uses native page creation and editing, with the signed-in account's actual permissions. Unlike the older template copier, the current editor retains its private Working record, attachments and exact-request recovery. Working-parent viewing restrictions are still verified before staging content. Existing page restrictions are preserved, and a native edit denial still stops publication. Only Job aid creation/approval provisions per-page edit restrictions.

The listing follows the visual hierarchy of [Citi All Insights](https://www.citigroup.com/global/insights/all): a plain editorial heading, underlined type filters, topic/search controls and a three-column article grid. It inherits the existing Confluence font/header, uses real article cover attachments from a matching published page version when available and falls back to readable text cards when no usable cover exists. It introduces no external image service or second site header.

## Upload and navigation

1. Upload `attachments/wcspedia-insights.js` and `attachments/wcspedia-insightsHTMLPage.js` to attachments page **3962195316**. Replace the shared `wcspedia-style.css` and use the matching cache revision.
2. Paste `html/wcspedia-insights.html` into one HTML macro on page **3961735728**. It contains inline configuration and loads its own JS pair. It has no document wrappers, fonts or header.
3. Optionally add `html/wcspedia-insights-header-link.html` to your existing navigation. It is only an **Insights** link. The default native URL does not need `#/insights`; actual filters retain their route state.
4. Update the other page pairs/macros and shared discussion header together. Keep your live JSON and deployed service endpoints. The five original `pageIds` entries remain; **insightsPageId** is a separate configuration field and generates `pages.insights`.

In the browser config:

```js
nativePublication: {
  enabled: true,
  publishedRootPageId: "3954553300",
  workingRootPageId: "3961735834",
  areaPageIds: { /* preserve the existing eight mappings */ },
  insightsPageId: "3961735728",
  insightsTypes: ['Procedure','Knowledge sharing','Blog','Training','Reference','Report','Guide','Playbook','Checklist','Template','FAQ']
}
```

The configured package includes these values. A native parent with this ID must exist in the correct WCSpedia tree; a local ID setting cannot create or move that page.

## Blog comments

Use the existing header's **Add document → Blog** option to create a blog. Insights has no separate creation button; the shared menu uses the same permission checks and editor as other document types.

When creating or editing any Insights article, the author sets **Article comments** to **Enabled** or **Disabled**. Enabled is the default for new and older content. The strict boolean is stored as `version.commentsEnabled`; MDX supports `commentsEnabled: true` or `commentsEnabled: false`. Review, revision, import/export and audit preserve it. New blogs use **Publish to Insights** immediately, without reviewer or approver assignments. Subsequent edits to these blogs also publish directly. Legacy non-Job-aid articles adopt direct publication on an explicit authorized save; Job aids keep review and approval.

The selected value is published with the article in the same native page version as its content. A native anchor records `wcs-comments-v1-enabled` or `wcs-comments-v1-disabled`, and Page Properties displays **Article comments**. The shared discussion component reads this setting during its existing lazy, scoped article read. Disabled articles display a notice without fetching the comment list or enabling the custom composer. Previously posted comments remain stored in Confluence.

This is a **WCSpedia discussion setting**, not a replacement for Confluence's native permissions. A reader who retains native Add Comments permission can still use a native Confluence interface or API outside the WCSpedia component. If disabling comments must be enforced across every interface, a server-side permission/policy integration must enforce that rule too. The browser setting must not be described as a security boundary.

If an explicit published setting is malformed or cannot be verified, the component reports the issue and blocks custom posting rather than silently assuming comments are enabled. Older articles without the new setting keep the documented enabled default.

## Legacy trusted-service reference (not required for this space-only installation)

Deploy the matching workflow, editor-content, publication-workflow and native publisher updates before relying on the new field or collection routing. Uploading browser attachments alone does not upgrade the trusted service.

The trusted publisher must independently receive:

```js
createPublisher({
  // Preserve the existing context, roots, space, storage and eight area mappings.
  insightsPageId: "3961735728",
  insightsTypes: ['Procedure','Knowledge sharing','Blog','Training','Reference','Report','Guide','Playbook','Checklist','Template','FAQ']
});
```

It verifies that Insights is directly beneath the configured published root in the exact space and distinct from working/area parents. Missing Insights configuration blocks publication of those types, while working drafts remain possible. Existing published pages are not silently moved into a new parent: a destination mismatch requires an explicit migration before publication writes proceed.

On first approval of an Insights article, the trusted publisher supplies the authorization resolver with:

```js
publicationDestination: {kind: "insights", parentPageId: "3961735728"}
```

The trusted `nativeAccess` resolver must obtain fresh native permissions for that exact parent and return:

```js
publicationDestination: {
  pageId: "3961735728",
  operations: [
    {operation: "read", targetType: "page"},
    {operation: "create", targetType: "page"}
  ]
}
```

This example describes required proof, not constants to grant to every caller. The resolver must derive it from the authenticated user's real Confluence rights. Missing proof or proof for a different page fails closed. Updating an already published article continues to require native update rights for that article.

## Search, performance and manual analytics

Insights uses a bounded native CQL listing inside the verified WCSpedia tree and space, with the configured content types. It does not enumerate all Confluence pages, fetch full article bodies for cards, or run analytics during browsing. More results are requested through **Load more**. Already loaded results are filtered/rendered in the current page session where appropriate; native CQL matches are not filtered away merely because the matching words appeared in body text omitted from the card metadata.

Business-area browsing includes both the area's physical descendants (including older unlabelled pages) and Insights descendants carrying that area's exact `wcs-area-*` label. Topic filters apply to both branches. The entire query stays beneath the WCSpedia root in its verified space; the Insights interface itself is excluded. Returned Insights matches must confirm their ancestry, space and area label. If Confluence omits label metadata, one bounded compatibility query repeats the same CQL; unavailable or conflicting scope metadata produces a visible error rather than a broader search. Visible cards include body.storage in their bounded search batch to read the published cover, excerpt, author and document key. Autocomplete and counts stay lightweight; discovery does not issue a separate metadata request per card.

Use **Download analytics JSON** on Insights as an authorized administrator when a report is needed. The explicit operation gathers readable document metadata and comment counts into one local `wcspedia-analytics.json` for manual analysis, with progress and cancellation. It neither uploads the report nor schedules recurring collection. See [manual analytics](MANUAL-ANALYTICS.md) for coverage, limits and nullable unavailable helpfulness totals.

Before production rollout, verify the real parent ancestry, a Blog publication with caller permissions, enabled/disabled comments, one nested result from each collection, and a completed analytics download in the internal Confluence environment. Local automated checks cannot prove native server permissions or deployment of the trusted service.

## Creation permissions and native editor links

The custom editor publishes blogs directly to Insights (3961735728), without a reviewer or manager approval. It currently keeps a private Working record for save recovery, media and editor history. That storage record does not introduce an approval step, but the signed-in author needs native permission to edit it. The older standalone blog HTML also used `POST /rest/api/content`; its simpler template-copy flow did not preserve this editor/recovery history.

After creating a native page, WCSpedia now reads that exact ID with `operations`, `body.storage`, `space`, `ancestors` and `version` expanded. Confluence's default POST response does not include expanded operations; missing fields on that response must not be interpreted as an edit denial. The expanded GET remains authoritative. A genuine denial reports the affected page ID; a missing operations expansion is reported separately. Exact-request recovery reuses the existing seed instead of creating a second one.

Native editor URLs need separate `spaceKey` and `fromPageId` query parameters (`&`, not `@`). For Insights, the parent ID is 3961735728; 3961735744 is the My Workspace interface. Prefer Confluence's native Create action from the Insights parent when creating outside WCSpedia. Do not store an `atl_token` from a copied URL in config, attachments or JSON. For a custom native-action link that requires it, read the current host token at click time with `AJS.Meta.get("atl-token")`, and build the query using `URLSearchParams`. A token is XSRF protection, not an edit permission or a fixed page identifier.

References: [Confluence REST content creation and expansions](https://docs.atlassian.com/ConfluenceServer/rest/8.8.0/#api/content-createContent) and [Atlassian XSRF tokens](https://developer.atlassian.com/server/confluence/enable-xsrf-protection-for-your-app/).

A console 404 on a missing content property can be an expected first-use read; the complete request URL is needed to distinguish it from a failed resource. The supplied `batch.js` MutationObserver stack points into host scripts, not this workflow's permission check. Do not suppress host errors or treat a CSS deprecation warning as proof that a page save failed.

## Article card consistency (23 October 2026)

Landing, Insights, search results and the reader use the published snapshot’s summary, author and cover. Without an uploaded cover, the stable document key selects one of the same 50 attached photographs on every surface. It does not reshuffle on each render. Native article templates use the same selection; republish an older native article once to replace its previously stored blue artwork.

Visible managed cards load recorded-view counts by document key. Count reads verify the native page and read only its view ledger, without fetching helpfulness or identity. An inaccessible or unconfirmed count is unavailable, not zero. Recorded WCSpedia visits are not total Confluence traffic.

The reader’s native page tree keeps all collections as sibling branches, with an Insights display label for the Blogs parent and no separator lines. The existing native branch button is on the right of the row, with its event handlers unchanged. Update the shared CSS and reader-sidebar attachment; do not add a new sidebar to navBar.

The native collapsed sidebar now retains its existing collection icons instead of hiding the whole page tree. Labels appear on pointer hover or keyboard focus; Escape dismisses a label. The active article’s collection is highlighted in Citi blue. Expanding uses the original native control and restores all tree labels and child branches. This runs only on readers, uses the same shared CSS, and adds no navigation requests or duplicate rail.
