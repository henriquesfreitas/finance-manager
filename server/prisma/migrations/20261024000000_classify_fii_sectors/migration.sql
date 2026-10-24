-- Refuse to start if production has generic FII tickers that were not reviewed.
DO $$
DECLARE
  unclassified_tickers TEXT;
BEGIN
  SELECT string_agg("ticker", ', ' ORDER BY "ticker")
  INTO unclassified_tickers
  FROM "investments"
  WHERE "sector" = 'FIIs'
    AND "ticker" NOT IN (
      'HGLG11', 'KNRI11', 'FIIB11', 'VISC11', 'LVBI11', 'KNSC11', 'HGRE11', 'VRTA11',
      'RCRB11', 'XPLG11', 'BCRI11', 'XPML11', 'MXRF11', 'RBVA11', 'TRBL11', 'HSML11',
      'RBED11', 'VILG11', 'HGRU11', 'ALZR11', 'RECR11', 'MALL11', 'XPIN11', 'GGRC11',
      'HGPO11', 'JSRE11', 'LUGG11', 'IRDM11', 'VINO11', 'MAXR11', 'BBRC11', 'BCFF11',
      'BTAL11', 'CVBI11', 'HFOF11', 'HTMX11', 'KNCR11', 'HCTR11', 'DEVA11', 'IGTI11'
    );

  IF unclassified_tickers IS NOT NULL THEN
    RAISE EXCEPTION 'Unclassified legacy FIIs remain; add their researched mappings: %', unclassified_tickers;
  END IF;
END $$;

-- Classify the FII tickers present in the seed portfolio. Updates are limited
-- to legacy generic FIIs rows so the migration preserves manual classifications.
UPDATE "investments"
SET "sector" = CASE "ticker"
  WHEN 'HGLG11' THEN 'FIIs — Tijolo'
  WHEN 'KNRI11' THEN 'FIIs — Tijolo'
  WHEN 'FIIB11' THEN 'FIIs — Tijolo'
  WHEN 'VISC11' THEN 'FIIs — Tijolo'
  WHEN 'LVBI11' THEN 'FIIs — Tijolo'
  WHEN 'KNSC11' THEN 'FIIs — Papel'
  WHEN 'HGRE11' THEN 'FIIs — Tijolo'
  WHEN 'VRTA11' THEN 'FIIs — Papel'
  WHEN 'RCRB11' THEN 'FIIs — Tijolo'
  WHEN 'XPLG11' THEN 'FIIs — Tijolo'
  WHEN 'BCRI11' THEN 'FIIs — Papel'
  WHEN 'XPML11' THEN 'FIIs — Tijolo'
  WHEN 'MXRF11' THEN 'FIIs — Papel'
  WHEN 'RBVA11' THEN 'FIIs — Tijolo'
  WHEN 'TRBL11' THEN 'FIIs — Tijolo'
  WHEN 'HSML11' THEN 'FIIs — Tijolo'
  WHEN 'RBED11' THEN 'FIIs — Tijolo'
  WHEN 'VILG11' THEN 'FIIs — Tijolo'
  WHEN 'HGRU11' THEN 'FIIs — Tijolo'
  WHEN 'ALZR11' THEN 'FIIs — Tijolo'
  WHEN 'RECR11' THEN 'FIIs — Papel'
  WHEN 'MALL11' THEN 'FIIs — Tijolo'
  WHEN 'XPIN11' THEN 'FIIs — Tijolo'
  WHEN 'GGRC11' THEN 'FIIs — Tijolo'
  WHEN 'HGPO11' THEN 'FIIs — Tijolo'
  WHEN 'JSRE11' THEN 'FIIs — Misto'
  WHEN 'LUGG11' THEN 'FIIs — Tijolo'
  WHEN 'IRDM11' THEN 'FIIs — Papel'
  WHEN 'VINO11' THEN 'FIIs — Tijolo'
  WHEN 'MAXR11' THEN 'FIIs — Tijolo'
  WHEN 'BBRC11' THEN 'FIIs — Tijolo'
  WHEN 'BCFF11' THEN 'FIIs — Misto'
  WHEN 'BTAL11' THEN 'FIIs — Tijolo'
  WHEN 'CVBI11' THEN 'FIIs — Papel'
  WHEN 'HFOF11' THEN 'FIIs — Misto'
  WHEN 'HTMX11' THEN 'FIIs — Tijolo'
  WHEN 'KNCR11' THEN 'FIIs — Papel'
  WHEN 'HCTR11' THEN 'FIIs — Papel'
  WHEN 'DEVA11' THEN 'FIIs — Papel'
  WHEN 'IGTI11' THEN 'Exploração de Imóveis'
END
WHERE "sector" = 'FIIs'
  AND "ticker" IN (
    'HGLG11', 'KNRI11', 'FIIB11', 'VISC11', 'LVBI11', 'KNSC11', 'HGRE11', 'VRTA11',
    'RCRB11', 'XPLG11', 'BCRI11', 'XPML11', 'MXRF11', 'RBVA11', 'TRBL11', 'HSML11',
    'RBED11', 'VILG11', 'HGRU11', 'ALZR11', 'RECR11', 'MALL11', 'XPIN11', 'GGRC11',
    'HGPO11', 'JSRE11', 'LUGG11', 'IRDM11', 'VINO11', 'MAXR11', 'BBRC11', 'BCFF11',
    'BTAL11', 'CVBI11', 'HFOF11', 'HTMX11', 'KNCR11', 'HCTR11', 'DEVA11', 'IGTI11'
  );
