> **Historical server-only reference — not deployable in this department.** This document describes the older Node analytics publisher, which requires server access and is outside the current space-only WCSpedia package workflow. Do not deploy it or configure its callbacks. Use **[MANUAL-ANALYTICS.md](MANUAL-ANALYTICS.md)** to download native comment analytics directly from Confluence; no service, scheduler or analytics attachment is required. See **[NATIVE-SPACE-SETUP.md](NATIVE-SPACE-SETUP.md)** for the current installation.

# One WCSpedia analytics JSON

`wcspedia-analytics.json` is one **read-only reporting snapshot for all verified WCSpedia child documents**. Native Confluence comments remain on their document pages. Helpful / Not helpful choices remain in the trusted feedback service. The report combines counts and metadata without copying comments, names, SOEIDs, user keys or individual voter records.

The supplied template is an empty schema example. Its `generatedAt: null` means **not collected yet**, not “there are no documents or comments.” Do not replace an existing live report with the empty template. A trusted scheduled or administrator-triggered job creates or replaces the real report. No browser scans the space and no comment submission rewrites this global file, so the report does not slow down articles or optimistic comment posting.

## What it contains

Each `documents[pageId]` record contains:

- Native page ID, business-area page ID, native version, original native creation/modification dates when known, and observation time.
- Current native **footer-comment count including replies**, plus latest known comment creation time. Inline comments are excluded. An unavailable count is `null` with `status: "unavailable"`; it is never presented as zero.
- Helpful / Not helpful current totals, totals grouped by the version evaluated, feedback revision/update time, and number of vote changes.

The report is a collection over a time window (`scanStartedAt` through `generatedAt`), not a transactionally frozen Confluence database. Each document's `observedAt` is the **start** of that document's summary collection, not an exact common timestamp for comments and feedback. A comment or vote submitted after its summary was collected appears in the next refresh. Counts can decrease after native comment deletion; this is a current snapshot, not a permanent audit log. `lastCommentAt` uses native comment creation time, not a fabricated page update time. When native comment dates are incomplete, it remains `null`.

Native-comment analytics work even before the optional helpfulness service is deployed: omit `feedbackService` in the publisher options. Each document then has `helpfulness.status: "unavailable"` and `null` totals, revision and version data. This means **not collected**, not zero votes. Once a feedback service is configured, authorization or network failures abort the refresh and preserve the previous report; the publisher does not quietly hide failures as unavailable.

Example document entry (inside `documents`):

```json
"12345": {
  "pageId": "12345",
  "areaPageId": "3961735771",
  "pageVersion": 3,
  "createdAt": "2020-04-01T09:00:00.000Z",
  "updatedAt": "2026-10-17T10:00:00.000Z",
  "observedAt": "2026-10-17T12:00:00.000Z",
  "comments": {
    "source": "confluence-footer-comments",
    "status": "available",
    "total": 7,
    "lastCommentAt": "2026-10-16T14:30:00.000Z"
  },
  "helpfulness": {
    "source": "wcspedia-feedback-service",
    "status": "available",
    "revision": 6,
    "updatedAt": "2026-10-17T11:00:00.000Z",
    "yes": 4,
    "no": 1,
    "total": 5,
    "byPageVersion": [{ "pageVersion": 3, "yes": 4, "no": 1, "total": 5 }],
    "voteChanges": 6
  }
}
```

## Server integration

`article-analytics.cjs` is trusted Node service source, not a script for Confluence attachments. It adds no endpoint and deploys no scheduler. An existing authenticated service must supply the callbacks below; uploading the JSON alone does not collect data.

```js
const {
  createArticleAnalyticsPublisher,
  createArticleAnalyticsFileStore,
  createFooterCommentCounter
} = require('./article-analytics.cjs');

const publisher = createArticleAnalyticsPublisher({
  rootPageId: '3954553300',
  spaceKey: 'wcspedia',
  areaPageIds: [
    '3961735771', '3961735776', '3961735781', '3961735791',
    '3961735795', '3961735800', '3961735803', '3961735808'
  ],
  insightsPageId: '3961735728',
  excludePageIds: ['3962195316', '3961735744', '3961735749', '3961735759', '3961735763'],
  excludeAncestorIds: ['3961735834'],
  listArticles: listVerifiedNativeArticles,
  resolveAccess: resolveConfluenceArticleAccess,
  readCommentSummary: createFooterCommentCounter({ listComments: listNativeFooterCommentMetadata }),
  feedbackService: existingArticleFeedbackService, // Omit until this optional service is deployed.
  authorizeReport: authorizePrivateAnalyticsPublication,
  store: createArticleAnalyticsFileStore(process.env.WCS_ANALYTICS_DATA_DIR)
});

// Run from your authenticated administrator job/scheduler, not a page script.
await publisher.publish(trustedJobContext, { signal: abortSignal });
```

Required host contracts:

1. `authorizePrivateAnalyticsPublication({rootPageId, spaceKey, areaPageIds, insightsPageId, publishedParentPageIds, context})` returns `true` only for a trusted reporting principal entitled to collect **all** source articles and publish to the private destination. It is checked before starting, after obtaining the exclusive lock and before publication. Never derive this permission from caller-provided JSON, headers or an SOEID string.
2. `listVerifiedNativeArticles({rootPageId, spaceKey, areaPageIds, insightsPageId, publishedParentPageIds, cursor, limit, context, signal})` queries only this exact space and WCSpedia root descendant tree beneath a `publishedParentPageIds` entry (business areas plus the optional Insights parent). `areaPageIds` remains the business-area list; `insightsPageId` is the configured ID or null. Return `{results: [{id: 'native-page-id'}], nextCursor: 'opaque-cursor-or-null'}`. `null` confirms the end; never drop a native next link or treat a failed request as an empty list. Pass current native permissions through the trusted service context. Business-area/Insights navigation, root, interface and shared-attachment page IDs are excluded; working-root descendants are forbidden. The publisher independently verifies every included article. Report rows identify `collection` as `business-area` or `insights` and retain the native parent in `areaPageId`.
3. `resolveConfluenceArticleAccess({rootPageId, pageId, context, signal})` has the same native verification shape as the feedback service: `{authenticated:true, rootReadable:true, canRead:true, page:{id,type:'page',status:'current',spaceKey,ancestorIds,version,createdAt?,updatedAt?}}`. Use native ISO timestamps or `null` when absent. A privileged service account does not authorize ordinary users to receive these pages' aggregate data.
4. `listNativeFooterCommentMetadata({rootPageId, pageId, cursor, limit, context, signal})` returns `{results:[{id,location:'footer',createdAt:'ISO-or-null'}],nextCursor:'opaque-cursor-or-null'}`. Normalize native footer comments **and replies**, and distinguish inline comments (`location:'inline'`, excluded). Request lightweight metadata without body expansions. Native totals can be used through a custom `readCommentSummary` adapter if their footer/reply semantics are verified for your Confluence version. Do not infer a total from the first paginated page. If the server genuinely cannot provide a count, a custom adapter may return `{status:'unavailable',total:null,lastCommentAt:null}`. Authentication, timeout and parsing failures must throw rather than be disguised as unavailable/zero.
5. Optional `existingArticleFeedbackService.analytics({rootPageId,pageId},context)` is the existing authorized, aggregate-only export; it rechecks native article and analytics permissions. No raw private vote files are exposed or copied. Omit `feedbackService` entirely to collect native-comment metadata before helpfulness is deployed.

The publisher serializes complete refreshes and atomically replaces one `wcspedia-analytics.json` only after every page has been read and validated. Failed scope checks, incomplete pagination, missing permissions, failed requests, cancellation and scan limits leave the previous report intact. Limits default to 10,000 documents and 1,000 listing batches; configure larger bounded limits deliberately. Only one document is collected at a time, with its two independent summary reads in parallel. Do not run this scan on every article request.

The included file adapter uses a private local directory (`0700`) and report (`0600`), exclusive lock directories, atomic rename and file/directory fsync. It is for one host/local filesystem. Clustered services require an injected distributed lock and transactional/atomic store. A crashed lock is never automatically stolen; an operator must establish that its writer has stopped before removing it.

## Optional Confluence attachment copy

After a successful trusted refresh, your server can upload the snapshot to a **restricted analytics page** as `wcspedia-analytics.json`. Keep a single current attachment with Confluence versions. The uploader is a separate host integration and is not included in the browser package. It must serialize refresh and upload as one publication job (or reject older `generatedAt` values) so a delayed upload cannot replace a newer snapshot.

Do **not** place a cross-document report on a broadly readable shared-assets page: it can reveal that restricted document IDs/comments exist. The reporting page must be accessible only to readers authorized for every included document. Recheck destination permissions before publishing; revoke/remove access to an older published snapshot when source permissions require it. An authorized-only authenticated download can be used instead, with `Cache-Control: private, no-store`. No report read endpoint is added by this module.

Native comments keep Confluence permissions, editing, deletion and history. The analytics JSON supports later reporting; it does not replace native comments, approval audit trails or the concurrency-safe feedback write store.

## Verification

Run `node --test article-analytics.test.cjs`. Tests cover scope, authorization, pagination, unknown counts, failure preservation, count consistency, private filesystem permissions, atomic replacement and concurrent-run serialization. These local tests do not verify an undeployed internal Confluence integration.
