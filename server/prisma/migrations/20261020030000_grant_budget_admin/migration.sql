UPDATE "admin_users"
SET "permissions" = array_append("permissions", 'ADMIN'::"AppPermission")
WHERE "username" = 'admin_finance'
  AND NOT ('ADMIN'::"AppPermission" = ANY("permissions"));
