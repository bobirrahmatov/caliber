# Article comments and helpfulness

This adds a comment input to native document pages beneath the eight WCSpedia business areas and Insights. Comment cards have no left accent or connecting vertical line. Helpfulness reactions and a recorded-view counter use native JSON content properties on each published document, through the current Confluence session. The existing page design, header and fonts are retained. The landing page, workspaces, saved page, entitlements, area parents, attachments and restricted working tree are excluded.

## Install comments and engagement

1. Upload `attachments/wcspedia-article-engagement.js`, `attachments/wcspedia-article-discussion.js` and `attachments/wcspedia-article-discussion-bootstrap.js` to attachments page **3962195316**.
2. Replace the global `wcspedia-style.css` attachment.
3. Install `html/wcspedia-navbar.html` **once** in the existing shared header, replacing older WCSpedia header fragments. It contains the stylesheet, notifications, Add document, flags and article helpers together. Do not add another copy for comments.
4. Keep the existing navigation, native Create control and inherited site fonts. No per-document HTML macro is required.
5. Test one existing child document with an account allowed to comment, then an account without comment permission. Test helpfulness/view recording with and without native article Edit permission, and test the native comment fallback link as well. The internal Confluence server has not been exercised from this workspace.

The small discussion bootstrap makes no REST calls on the interface pages. On native articles, it waits until the reader approaches the bottom, loads the separate discussion bundle, and verifies the current page's space/root/area ancestry. It then fetches 20 native footer comments. Further comments load on demand. There is no polling, full-library comment scan, page reload, or React dependency.

The independent engagement helper waits until the page has remained visible for two seconds before checking article scope and loading the current account’s vote and the shared view counter. It then attempts a deduplicated visit recording for eligible users. It does not wait for scrolling to comments, and disabling blog comments does not disable feedback or view recording. Normal article startup never enumerates everyone’s vote records.

`hide-comments` may stay in the existing document style flags: it hides Confluence's original comment area, while this separately scoped widget displays the native comments. After the custom list successfully loads, an owned CSS class hides the duplicate native `#comments-section`. Load errors offer **Open comments in Confluence**, using `wcsNativeUi=1` to bypass WCSpedia's flags helper. Site-wide rules outside WCSpedia may still need your theme administrator to allow that native view.

## Posting and permissions

The input box appears above the comment list, once the signed-in reader is resolved. Keep this custom input for consistent WCSpedia styling and immediate updates, with native Confluence as the comment store. The former permanent **Open in Confluence** link was a shortcut to the same document's native comment tools; it is now removed from the normal layout. Recovery links appear only for load failures, denied posting or uncertain save outcomes.

Comments are saved by native Confluence REST on the actual document page. No comment JSON attachment is created. Confluence authenticates the current user and enforces its native comment permissions. Being a WCSpedia administrator does not grant additional Confluence rights. Older Server releases do not expose a reliable comment capability in page operations, so the native POST remains the final permission check.

Posting inserts a pending comment immediately. Confirmation replaces it with the server's saved ID and author/date. A definite rejection removes the pending row and keeps the draft. A network interruption after dispatch may mean the comment was saved: the UI keeps an **Awaiting confirmation** row and offers a read-only check/native fallback. It does not automatically repeat the POST. Draft text remains copyable.

This release posts plain-text top-level comments, with line breaks, and displays existing replies. It never executes comment HTML. Rich comment formatting, attachments, inline comments, reply composition, editing and deleting remain available in native Confluence. The custom view deliberately renders existing rich comments as plain text.

## Helpfulness and document JSON

Leave `feedbackEndpoint` empty. With `authoringMode: "confluence-session"`, the native helper stores each account’s latest choice as a compact JSON content property on the document. The interface uses the existing SVG Helpful/Not helpful faces, selected colours and press animation. A click updates immediately while pending; confirmation retains the selection. A definite rejection restores the previous choice. An uncertain save offers **Check saved feedback** (read-only) and **Retry original vote** using the same request receipt. An unchanged or missing record keeps the outcome unresolved and the other vote choices disabled; it is never silently treated as successful.

A later choice replaces that account’s earlier vote. The native page version evaluated is retained for manual analysis. Normal article loading reads only the current account’s record; aggregate vote totals are collected only by the explicit analytics download.

Recorded visits use one compact shared JSON property on the published document. CAS versions protect cooperating concurrent writers. One eligible account contributes at most one successfully recorded visit per rolling 30 minutes; confirmed retries do not increment again. Delayed expired retries are rejected rather than counted as a new visit. The ledger supports 180 active distinct accounts per document in that window, conservatively below the native 32 KB content-property limit. Reaching the bound gives an explicit recording error until entries expire, while retaining earlier counts.

**Native article Edit/update permission is required for both writes.** Reader-only users receive an unavailable recording state; a WCSpedia JSON grant cannot elevate their Confluence rights. Native commenting is a separate permission and can still work. Recorded views are eligible WCSpedia recordings, not total Confluence traffic, anonymous visits or unique-reader counts. Native editors can change content properties outside WCSpedia, so ballots and counters are cooperative metadata rather than tamper-proof records. Do not broaden native editing just to increase coverage.

No starter JSON attachment or service endpoint is required. Content properties are native JSON storage and are created on a successful write. Preserve existing properties. No shared analytics JSON is repeatedly uploaded on article visits.

## One analytics JSON for all documents

Use `wcspedia-analytics.json` as one combined reporting snapshot, keyed by native document page ID. It includes document/area IDs, page version, comment count and last-comment date when available, latest helpfulness totals grouped by evaluated version, recorded-view totals, recording coverage and collection timestamps. Comment text and reader identities are omitted. Native comments remain authoritative; the combined JSON can be regenerated. A complete validated scan with no engagement records returns zero recorded activity. Failed or inconsistent reads stop the export instead of being converted into zero.

Administrators select **Download analytics JSON** on Insights. The browser checks current access, reads scoped document/comment and engagement metadata with bounded concurrency and pagination, then downloads one completed file. It does not upload the JSON, collect on ordinary article views, or run on a schedule. Cancellation or a failure produces a visible status and no successful-looking partial file. Coverage is the indexed documents readable by the current account during collection, not a transactionally fixed snapshot or inaccessible pages. See [manual export](MANUAL-ANALYTICS.md).

The supplied `templates/wcspedia-analytics.json` is a historical reporting-format example, not a starter that enables collection. Do not upload it for this manual download. Use [manual export](MANUAL-ANALYTICS.md) for the current browser-generated format. Keep downloaded reporting files with the people authorized to view their source documents.

## References

- [Confluence Server REST reference](https://docs.atlassian.com/ConfluenceServer/rest/7.18.3/) and [native comment examples](https://developer.atlassian.com/server/confluence/confluence-rest-api-examples/) for pagination, native storage and posting.
- [GitHub Primer timeline](https://primer.style/product/components/timeline/) for the compact avatar, author and activity layout.
- [Dribbble feedback snippets](https://dribbble.com/shots/17097931-User-Feedback-Snippets) for compact feedback actions; no external design assets are loaded.
- [TanStack optimistic updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates) for immediate pending state, confirmation and rollback. The existing plain JavaScript implementation uses this pattern without adding React or TanStack bundles.

## Insights and per-blog settings

The supplied header includes Insights parent `3961735728` beneath the verified WCSpedia root. Its descendants use the same lazy native discussion as business-area documents; the Insights listing itself is excluded. Blog authors may set Article comments to Enabled or Disabled. The approved native body carries the setting atomically with the published version. Disabled discussions show their status and keep existing native comments; no custom comment POST is sent. An unreadable or malformed setting blocks custom posting visibly. The setting takes effect after publication and does not revoke native Confluence commenting permissions.

Administrators can download one `wcspedia-analytics.json` from Insights for manual reporting. No reporting server or starter attachment is needed for native comment metadata. See [manual export](MANUAL-ANALYTICS.md). Helpfulness and recorded-view metadata are included in that download. The per-blog comment setting affects the discussion only; it does not disable this independent engagement row.

The shared-header fragment contains only configuration and scripts. Discussion controls mount below the child article, never inside navHeader/navBar, native header or banner containers. Replace any old header HTML that contains a manually added Load comments button with the supplied fragment. Attachment URLs omit cache-version suffixes; hard-refresh after updates.
