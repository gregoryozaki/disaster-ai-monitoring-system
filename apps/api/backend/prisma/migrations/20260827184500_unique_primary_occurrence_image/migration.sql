CREATE UNIQUE INDEX
  "occurrence_media_one_primary_image_per_occurrence"
ON "occurrence_media" ("occurrenceId")
WHERE
  "type" = 'IMAGE'
  AND "isPrimary" = true;