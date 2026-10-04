CREATE TYPE "AppPermission" AS ENUM ('INVESTMENTS', 'BILLS_CONTROL');

ALTER TABLE "admin_users"
ADD COLUMN "permissions" "AppPermission"[] NOT NULL DEFAULT ARRAY['INVESTMENTS', 'BILLS_CONTROL']::"AppPermission"[];

ALTER TABLE "admin_users"
ALTER COLUMN "permissions" SET DEFAULT ARRAY['INVESTMENTS']::"AppPermission"[];
