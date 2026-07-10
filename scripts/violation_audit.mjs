import mysql from 'mysql2/promise';
import { config } from 'dotenv';
config();

const db = await mysql.createConnection(process.env.DATABASE_URL);

// 1. Overall stats
const [stats] = await db.execute(`
  SELECT 
    COUNT(DISTINCT vt.category) as unique_categories,
    COUNT(DISTINCT vt.label) as unique_labels,
    COUNT(DISTINCT vt.id) as total_tag_definitions,
    COUNT(dvt.id) as total_applications,
    COUNT(DISTINCT dvt.document_id) as docs_with_tags
  FROM violation_tags vt
  LEFT JOIN document_violation_tags dvt ON dvt.violation_tag_id = vt.id
`);
console.log('\n=== OVERALL STATS ===');
console.log(JSON.stringify(stats[0], null, 2));

// 2. Tags applied to multiple documents (same tag, multiple docs = same violation type across docs)
const [multiDoc] = await db.execute(`
  SELECT vt.label, vt.category, COUNT(DISTINCT dvt.document_id) as doc_count,
    GROUP_CONCAT(d.title ORDER BY d.id SEPARATOR ' | ') as documents
  FROM document_violation_tags dvt
  JOIN violation_tags vt ON dvt.violation_tag_id = vt.id
  JOIN documents d ON dvt.document_id = d.id
  GROUP BY vt.id, vt.label, vt.category
  HAVING doc_count > 1
  ORDER BY doc_count DESC, vt.category
`);
console.log('\n=== TAGS APPLIED TO MULTIPLE DOCUMENTS (same violation, multiple docs) ===');
console.log(`Count: ${multiDoc.length}`);
multiDoc.forEach(r => {
  console.log(`\n[${r.category}] "${r.label}" → ${r.doc_count} docs`);
  console.log(`  Docs: ${r.documents}`);
});

// 3. Category distribution
const [cats] = await db.execute(`
  SELECT vt.category, COUNT(DISTINCT vt.id) as unique_tags, COUNT(dvt.id) as total_applications,
    COUNT(DISTINCT dvt.document_id) as docs_affected
  FROM violation_tags vt
  LEFT JOIN document_violation_tags dvt ON dvt.violation_tag_id = vt.id
  GROUP BY vt.category
  ORDER BY total_applications DESC
`);
console.log('\n=== BY CATEGORY ===');
cats.forEach(r => {
  console.log(`${r.category}: ${r.unique_tags} tags, ${r.total_applications} applications across ${r.docs_affected} docs`);
});

// 4. Documents with the most tags (potential over-tagging)
const [heavyDocs] = await db.execute(`
  SELECT d.title, d.record_status, COUNT(dvt.id) as tag_count,
    GROUP_CONCAT(vt.label ORDER BY vt.category SEPARATOR ' | ') as tags
  FROM documents d
  JOIN document_violation_tags dvt ON dvt.document_id = d.id
  JOIN violation_tags vt ON dvt.violation_tag_id = vt.id
  GROUP BY d.id, d.title, d.record_status
  ORDER BY tag_count DESC
  LIMIT 15
`);
console.log('\n=== DOCUMENTS WITH MOST TAGS (top 15) ===');
heavyDocs.forEach(r => {
  console.log(`\n"${r.title}" (${r.record_status}) — ${r.tag_count} tags`);
  console.log(`  ${r.tags}`);
});

// 5. Near-duplicate tag labels (same root concept, slightly different wording)
const [allLabels] = await db.execute(`
  SELECT id, label, category, slug FROM violation_tags ORDER BY category, label
`);
console.log('\n=== ALL TAG DEFINITIONS (for manual duplicate review) ===');
let lastCat = '';
allLabels.forEach(r => {
  if (r.category !== lastCat) { console.log(`\n[${r.category}]`); lastCat = r.category; }
  console.log(`  ${r.id}: ${r.label}`);
});

// 6. Tags defined but never applied
const [unused] = await db.execute(`
  SELECT vt.label, vt.category
  FROM violation_tags vt
  LEFT JOIN document_violation_tags dvt ON dvt.violation_tag_id = vt.id
  WHERE dvt.id IS NULL
`);
console.log(`\n=== UNUSED TAGS (defined but never applied): ${unused.length} ===`);
unused.forEach(r => console.log(`  [${r.category}] ${r.label}`));

// 7. Timeline events vs document tags — are the same events being counted multiple times?
const [timelineVsDoc] = await db.execute(`
  SELECT 
    te.category as event_category,
    COUNT(DISTINCT te.id) as timeline_events,
    COUNT(DISTINCT dvt.id) as doc_tag_applications
  FROM timeline_events te
  LEFT JOIN document_violation_tags dvt ON 1=1
  GROUP BY te.category
  ORDER BY timeline_events DESC
  LIMIT 5
`);

await db.end();
console.log('\n=== DONE ===');
