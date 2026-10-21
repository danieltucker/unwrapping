-- No backfill: until now a price was only ever stored as cents, and the text it
-- was typed as was never kept, so there is nothing to recover. Every existing
-- row keeps its price_cents untouched and shows as "about $X". To look for
-- prices the old parser misread ("$20 to $30" stored as $2,030), run
-- `npm run prices:audit`.
ALTER TABLE `items` ADD `price_label` text;
