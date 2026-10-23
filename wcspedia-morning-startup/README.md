# WCSpedia morning startup rollback — 23 October 2026

Startup code recovered from the 09:51 local command record. Later design/content changes remain; FAQ uses the restored loading sequence too. This is not a full application/data rollback.

1. Extract this ZIP. Upload the 14 JavaScript files inside attachments/ to existing attachment page 3962195316, replacing files with the same names.
2. Edit each interface page below. Replace the ENTIRE contents of its existing HTML macro with its matching file from html/. Save the macro and publish the page. Do not merely attach the HTML files. Keep one application macro per page.
3. Hard-refresh with Ctrl + Shift + R in Horizon Chrome.

Do not change navBar or live JSON. This ZIP deliberately contains no policy/data JSON, stylesheet or header changes.

| Page role | Confluence page ID | HTML macro file |
| --- | --- | --- |
| home | 3954553300 | wcspedia-landing.html |
| mine | 3961735744 | wcspedia-my-workspace.html |
| review | 3961735749 | wcspedia-reviewer-workspace.html |
| saved | 3961735759 | wcspedia-saved-items.html |
| entitlements | 3961735763 | wcspedia-entitlements.html |
| insights | 3961735728 | wcspedia-insights.html |
| faq | 3973992401 | wcspedia-faq.html |

The restored macro loads a small inline settings block, then its logic attachment, then its HTMLPage attachment. It does not inject the newer page-boot code or use markup settings recovery. The application displays one overlay after its scripts load; it cannot cover earlier downloads in this mode. No startup skeleton is restored.

Verified locally with the configured macros and JavaScript pairs, including native REST fixtures and actual HTTP loading for FAQ. The internal Confluence instance was not accessible for live verification. Native permissions, document data and entitlements are unchanged.
