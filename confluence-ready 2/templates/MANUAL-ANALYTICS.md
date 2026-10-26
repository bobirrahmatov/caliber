# Download one analytics JSON

Use **Download analytics JSON** in Insights to analyse WCSpedia in Excel, Power BI, Python or another tool. Collection starts only when you click. It reads native Confluence comments and WCSpedia engagement JSON, then downloads one `wcspedia-analytics.json` for all readable published documents. It does not upload or periodically replace a shared analytics attachment. No reporting service or server installation is required.

Comments remain native Confluence comments. Helpfulness votes and recorded visits are JSON content properties on their own published document page. Content properties are native Confluence JSON storage; they are not files you need to upload. New records are created when an eligible signed-in user successfully records a vote or visit. The downloaded report combines their aggregate counts for manual analysis.

## What the numbers mean

Each document includes its page ID, title, business area or Insights collection, native page version and dates, footer-comment counts, helpfulness totals, and recorded visits. Comment text, comment authors, account names, SOEIDs, user keys, account hashes and individual vote records are excluded from the download.

Helpfulness is the **latest recorded vote per account on that document**, with counts grouped by the native version evaluated. `currentVersionTotals` covers the current page version only; `byPageVersion` identifies votes on older versions. A later vote replaces that account's earlier choice. These are current choices, not a historical event log or a survey of every reader.

`views.recordedViews` counts successful WCSpedia recordings, deduplicated to one visit per account per 30-minute window. This is **not the Confluence server's total view count**, a unique-reader count or anonymous traffic. Native Confluence requires page update permission to write content properties. Readers without that permission can read the article and its comments, but their visits and votes cannot be recorded by this space-only feature. The JSON states this explicitly in `engagementCoverage`; it never claims complete traffic.

A native `status: "available"` with zero means the complete, validated engagement enumeration found no recorded activity. An unconfigured legacy source has `status: "unavailable"` and `null` counts. Failed reads, inconsistent records or lost permissions stop the download rather than converting missing data into zero. Native page/comment dates remain `null` when absent; `comments.creationDatesComplete` is `false` if any comment lacks its original creation date.

The compact view ledger supports up to 180 distinct active accounts per document in its rolling 30-minute window. Reaching that bound rejects the extra recording explicitly until entries expire; it does not drop earlier records or claim that the visit was counted. The bound is included as `engagementCoverage.activeViewCapacity`.

Native update permissions also allow users to edit page properties outside WCSpedia. The records support cooperative departmental reporting; they are not tamper-proof votes or an independent audit system. Keep native page permissions appropriate to the team.

## Scope, performance and completeness

The exporter verifies the configured WCSpedia root and each business-area/Insights parent against native Confluence space and ancestor metadata. Its CQL requires `type = page`, the exact space key, the WCSpedia root ancestor and a configured business-area or Insights ancestor. Interface, attachment and working-tree pages are excluded. Every returned document's ancestry is verified before reading its comments or engagement.

`coverage: "authenticated-current-user"` means the report covers published, indexed article pages visible to the signed-in account. It cannot count inaccessible pages or bypass restrictions. Recently published pages can be absent until Confluence's index catches up. `paginationComplete: true` confirms completion of the returned pagination; it does not claim unrestricted access. `pointInTimeSnapshot: false` and `scanStartedAt`/`generatedAt` describe a collection window, because comments and engagement can change during the export.

Native footer comments, including replies, are read in pages of 50 without requesting comment bodies. Only the explicit export enumerates per-document engagement properties; normal article loading reads its own record and the compact view counter. At most two metadata requests run concurrently by default. Engagement requests share the same request count, timeout, cancellation and concurrency limits as the rest of the export. There are document, comment, property pagination, response-size and total-request bounds. Collection never scans other Confluence spaces.

A failure, duplicate result, malformed count, invalid version, incomplete pagination, cancellation or permission change rejects the export. No successful-looking partial JSON is returned. Retry after the source settles or permissions are corrected. A large space can take time to export; opening an article does not trigger this reporting scan.

## JavaScript contract

The supplied page logic bundle contains both `WCSSpaceEngagement` and `WCSArticleAnalyticsDownload`; no separate reporting script tag is required. The existing admin action calls:

```js
const exporter = WCSArticleAnalyticsDownload.create({
  authoringMode: "confluence-session",
  contextPath: "/confluence",
  rootPageId: "3954553300",
  spaceKey: "wcspedia",
  attachmentPageId: "3962195316",
  pageIds: { /* existing interface page IDs */ },
  nativePublication: {
    areaPageIds: { /* existing eight business-area IDs */ },
    workingRootPageId: "3961735834",
    insightsPageId: "3961735728"
  }
});
const controller = new AbortController();
const report = await exporter.collect({
  signal: controller.signal,
  onProgress: ({ phase, completed, total }) => {
    // Keep the existing progress/cancel UI until this promise resolves.
  }
});
// Download JSON.stringify(report, null, 2) as wcspedia-analytics.json.
```

The caller owns the button, cancellation and JSON download. The module returns only the completed report, never writes a page/property/attachment, and starts no work at construction or page load. An instance rejects overlapping exports with `BUSY`. Native mode ignores obsolete feedback-service URLs. The older service mode remains compatible for historical installations; it is not required for this package.

## Analysis fields

| Field | Meaning |
| --- | --- |
| `documents[pageId].collection` | `business-area` or `insights` |
| `areaId` / `areaPageId` | Area slug (null for Insights) and native parent page ID |
| `pageVersion` | Native document version discovered during collection |
| `createdAt` / `updatedAt` | Native Confluence page dates; null when unavailable |
| `comments.total` | Native footer comments plus replies |
| `comments.topLevelTotal` / `repliesTotal` | Split using native comment ancestry |
| `comments.lastCommentAt` | Latest original comment creation date, or null if any is unknown |
| `helpfulness.yes` / `no` / `total` | Latest recorded vote per account, across evaluated versions |
| `helpfulness.currentVersionTotals` | Latest votes evaluating this native document version |
| `helpfulness.byPageVersion` | The same vote counts grouped by evaluated version |
| `views.recordedViews` | Successful WCSpedia visit recordings, not total Confluence traffic |
| `views.windowMinutes` | Per-account visit deduplication window: 30 minutes |
| `views.lastRecordedAt` | Last successful recorded visit; null when none exists |
| `engagementCoverage` | Native-update eligibility, deduplication definition and recording limitations |
| `observedAt` | Start of that document's metadata collection |
| `engagementObservedAt` | Observation time returned by its engagement enumeration |

Relevant APIs: [Atlassian CQL and pagination](https://developer.atlassian.com/server/confluence/advanced-searching-using-cql/) and [Confluence content properties](https://developer.atlassian.com/server/confluence/content-properties-in-the-rest-api/). This browser export does not depend on the historical server snapshot publisher.
