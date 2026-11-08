UPDATE "admin_users"
SET "permissions" = array_append("permissions", 'NEWS'::"AppPermission")
WHERE "username" = 'admin_finance'
  AND NOT ('NEWS'::"AppPermission" = ANY("permissions"));

CREATE TABLE "news_digests" (
    "id" VARCHAR(16) NOT NULL DEFAULT 'latest',
    "articles" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_digests_pkey" PRIMARY KEY ("id")
);
