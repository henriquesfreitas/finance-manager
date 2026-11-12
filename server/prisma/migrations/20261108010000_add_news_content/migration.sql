CREATE TYPE "NewsContentStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');
CREATE TYPE "NewsContentSource" AS ENUM ('FULL_ARTICLE', 'RSS_ONLY');

ALTER TABLE "news_items"
    ADD COLUMN "content" TEXT,
    ADD COLUMN "contentStatus" "NewsContentStatus" NOT NULL DEFAULT 'PENDING',
    ADD COLUMN "contentSource" "NewsContentSource";

CREATE INDEX "news_items_contentStatus_isIncluded_idx" ON "news_items"("contentStatus", "isIncluded");
