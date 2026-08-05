-- ══════════════════════════════════════════════════════════════════════════════
-- BTC-BRL order seed
-- Run on prod with:
--   docker compose -f docker-compose.prod.yml exec -T postgres \
--     psql -U <POSTGRES_USER> -d <POSTGRES_DB> < scripts/seed-btc-orders.sql
--
-- Prices are calculated as total_paid / quantity (price per 1 BTC in BRL).
-- The investment row for BTC-BRL must already exist before running this.
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_investment_id TEXT;
BEGIN
  -- Resolve the BTC-BRL investment id
  SELECT id INTO v_investment_id FROM investments WHERE ticker = 'BTC-BRL';

  IF v_investment_id IS NULL THEN
    RAISE EXCEPTION 'Investment BTC-BRL not found. Add it via the app first.';
  END IF;

  INSERT INTO orders ("id", "investmentId", "type", "quantity", "price", "orderDate", "createdAt", "updatedAt")
  VALUES
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00779678,  126207.85, '2023-06-06', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00389431,  126334.07, '2023-06-12', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00196724,  502207.77, '2025-02-25', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00385114,  514127.99, '2025-02-26', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00211336,  469413.21, '2025-02-28', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00216243,  458762.07, '2025-03-10', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00209714,  474924.05, '2025-03-29', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00207893,  479087.92, '2025-03-31', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00221267,  450101.57, '2025-04-07', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00271007,  549069.37, '2025-06-22', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00166866,  594491.90, '2025-08-25', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00168691,  589233.07, '2025-08-29', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00117542,  592984.14, '2025-09-23', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00051215,  585891.37, '2025-09-26', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00168703,  592766.15, '2025-10-16', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00174801,  572081.85, '2025-10-17', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00172189,  580770.95, '2025-10-18', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00169797,  589000.69, '2025-10-21', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00170010,  588200.69, '2025-10-23', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00170102,  587882.17, '2025-10-30', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00172661,  579153.55, '2025-11-03', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00179022,  558596.82, '2025-11-04', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00183792,  544082.11, '2025-11-04', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00179682,  556543.96, '2025-11-05', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00182571,  547710.03, '2025-11-06', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00184281,  542638.07, '2025-11-12', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00191094,  523296.53, '2025-11-13', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00196225,  509613.53, '2025-11-14', NOW(), NOW()), -- corrected from 2026
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00201458,  496381.17, '2025-11-16', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00206935,  483242.75, '2025-11-19', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00225753,  443000.55, '2025-11-21', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00211369,  473118.07, '2025-11-25', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00205291,  487124.93, '2025-11-28', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00204041,  490095.05, '2025-12-04', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00203188,  492152.89, '2025-12-11', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00206351,  484626.91, '2025-12-14', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00205149,  487462.87, '2025-12-30', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00204743,  488430.09, '2026-01-08', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00198919,  502721.03, '2026-01-19', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00205551,  486507.17, '2026-01-20', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00213359,  468706.93, '2026-01-21', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00210816,  474364.89, '2026-01-23', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00216493,  462000.83, '2026-01-25', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00227326,  439916.03, '2026-01-29', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00230473,  433910.87, '2026-01-30', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00243282,  411001.15, '2026-02-03', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00261201,  382993.71, '2026-02-04', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00283324,  352966.13, '2026-02-06', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00270719,  369370.61, '2026-02-08', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00277990,  359724.45, '2026-02-10', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00286143,  349474.71, '2026-02-11', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00290519,  344202.17, '2026-02-12', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00280004,  357138.27, '2026-02-17', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00303026,  330015.49, '2026-02-28', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00279533,  357740.85, '2026-03-07', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00274737,  364000.05, '2026-03-26', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00130489,  383216.13, '2026-05-27', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00150487,  332270.57, '2026-06-14', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00155110,  322350.59, '2026-07-02', NOW(), NOW()),
    (gen_random_uuid(), v_investment_id, 'BUY', 0.00148407,  336913.03, '2026-07-27', NOW(), NOW());

  RAISE NOTICE 'Inserted % BTC-BRL orders for investment id %', 60, v_investment_id;
END $$;
