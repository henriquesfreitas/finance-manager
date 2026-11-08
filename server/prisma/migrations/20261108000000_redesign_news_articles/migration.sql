CREATE TYPE "NewsSummaryStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

CREATE TABLE "news_items" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "description" TEXT NOT NULL DEFAULT '',
    "isIncluded" BOOLEAN NOT NULL DEFAULT true,
    "summary" TEXT,
    "summaryStatus" "NewsSummaryStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "news_items_sourceId_key" ON "news_items"("sourceId");
CREATE INDEX "news_items_isIncluded_publishedAt_idx" ON "news_items"("isIncluded", "publishedAt");
CREATE INDEX "news_items_summaryStatus_isIncluded_idx" ON "news_items"("summaryStatus", "isIncluded");

INSERT INTO "news_items" (
    "id", "sourceId", "title", "link", "publishedAt", "categories", "description",
    "isIncluded", "summary", "summaryStatus", "createdAt", "updatedAt"
)
SELECT
    md5(article->>'link'),
    article->>'link',
    article->>'title',
    article->>'link',
    (article->>'publishedAt')::TIMESTAMP(3),
    ARRAY[]::TEXT[],
    '',
    true,
    article->>'summary',
    CASE WHEN COALESCE(article->>'summary', '') = '' THEN 'PENDING'::"NewsSummaryStatus" ELSE 'READY'::"NewsSummaryStatus" END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "news_digests" AS digest
CROSS JOIN LATERAL jsonb_array_elements(digest."articles") AS article
WHERE COALESCE(article->>'link', '') <> ''
ON CONFLICT ("sourceId") DO NOTHING;

DROP TABLE "news_digests";
