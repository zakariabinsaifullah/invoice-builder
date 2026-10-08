-- Create clients for bill-to names used on invoices saved before clients were auto-saved.
INSERT INTO `client` (`id`, `user_id`, `name`, `email`, `phone`, `address`, `tax_id`, `created_at`, `updated_at`)
SELECT
  lower(hex(randomblob(16))),
  i.`user_id`,
  trim(i.`client_name`),
  coalesce(json_extract(i.`data_json`, '$.to.email'), ''),
  coalesce(json_extract(i.`data_json`, '$.to.phone'), ''),
  coalesce(json_extract(i.`data_json`, '$.to.address'), ''),
  coalesce(json_extract(i.`data_json`, '$.to.taxId'), ''),
  unixepoch() * 1000,
  unixepoch() * 1000
FROM `invoice` i
WHERE trim(i.`client_name`) != ''
  AND NOT EXISTS (
    SELECT 1 FROM `client` c WHERE c.`user_id` = i.`user_id` AND lower(c.`name`) = lower(trim(i.`client_name`))
  )
GROUP BY i.`user_id`, lower(trim(i.`client_name`));
