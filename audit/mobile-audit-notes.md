# Mobile audit notes

## Before fixes

The mobile first screen had three concrete problems. First, the hero copy overflowed and was visually cut off at the right edge, so the user could not read the core value proposition. Second, the first-screen content over-explained abstract positioning while burying the real jobs: browse receipts, submit evidence, and inspect patterns. Third, the CTA row wrapped awkwardly, leaving a partially visible button and making the page feel broken on a phone.

## Applied fixes

The hero was shortened to a clearer operational promise: search receipts, see the timeline, and connect repeated misconduct patterns. The CTA order was changed to prioritize **View Patterns**, **Browse Evidence**, then **Submit Evidence**, with full-width mobile buttons. The decorative background was darkened on mobile to protect readability, and the eyebrow/stamp row was changed from a forced inline layout to a stacked mobile-safe layout.

## Remaining observation after screenshot

The revised screenshot is materially cleaner, but the paragraph still reaches the right edge too aggressively on a 390px viewport. The next pass should add a stricter mobile max-width/padding treatment for the hero content or adjust the shared container spacing if it is responsible for the text edge collision.

## Evidence viewer diagnosis

The active `/evidence/:id` page previously used `doc.fileUrl` directly and only rendered PDFs after clicking **View PDF**. Images/audio/video were explicitly hidden behind “use Download or Open,” which explains the user complaint that uploaded evidence could not actually be viewed. The backend already supports a same-origin `/manus-storage/{fileKey}` proxy, so the frontend needed to normalize to that proxy, render files inline by type, and preserve Open/Download as fallbacks.

## Final visual verification update

A clean server restart confirmed the build loads, but the mobile hero screenshot still shows right-edge clipping in headless Chromium at 390px. The code now includes global and container-level `box-sizing: border-box` plus `overflow-x: hidden`; if clipping persists in a real device browser, the likely remaining cause is a generated Tailwind container rule or another wide child forcing the document width. The functional evidence-viewing defect is still the higher-impact bug and has been fixed in the active route.

## Verified final screenshots

The final mobile homepage screenshot confirms the first screen is cleaner than baseline: the user now sees the core job quickly—search patterns, browse evidence, or submit evidence—rather than a long explanatory wall. A minor headless-Chromium right-edge crop remains visible on the hero paragraph and primary CTA at 390px, so I hardened the CSS with viewport-width gutters, border-box sizing, and horizontal overflow suppression; if this still appears on a physical phone, the next move is to stop using Tailwind's `.container` utility entirely and replace it with a custom `content-frame` class to avoid generated CSS collisions.

The final mobile evidence archive screenshot is usable as an entry page but still content-heavy. It clearly exposes search and filter chips, but on a 390px device the copy and chips compete with the actual evidence records. The functional defect was not this list screen; the broken path was the evidence detail viewer, which has now been changed to render uploaded files inline through the same-origin `/api/storage-proxy` route.

## Final mobile hero correction

After constraining the hero copy and CTA stack to a safe mobile line length, the 390px screenshot no longer hits the right viewport edge. This is the correct tactical fix: it avoids fighting Tailwind container precedence and optimizes the first screen for human phone use. The first viewport now communicates the actual user jobs—view patterns, browse evidence, submit evidence—without excess explanatory copy.
