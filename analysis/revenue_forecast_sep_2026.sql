-- SQLite-compatible reproduction of the September 2026 revenue forecast.
-- Monthly inputs were extracted from AdeegoPOS with revenue_forecast_sep_2026.js
-- using the application's canonical net-sales rules and Africa/Nairobi dates.

WITH monthly_inputs(month, x, days_in_month, revenue, first_7_days) AS (
  VALUES
    ('2026-03', 0, 31, 645256.00, 189192.00),
    ('2026-04', 1, 30, 646890.00, 226199.00),
    ('2026-05', 2, 31, 784602.00, 275332.00),
    ('2026-06', 3, 30, 850484.00, 254410.00),
    ('2026-07', 4, 31, 873687.00, 247357.00),
    ('2026-08', 5, 31, 1003797.00, 340149.00)
),
means AS (
  SELECT AVG(x) AS mean_x, AVG(revenue) AS mean_revenue
  FROM monthly_inputs
),
linear_model AS (
  SELECT
    mean_revenue
      + SUM((x - mean_x) * (revenue - mean_revenue))
        / SUM((x - mean_x) * (x - mean_x))
        * (6 - mean_x) AS forecast
  FROM monthly_inputs, means
),
median_first_week_share AS (
  SELECT AVG(observed_share) AS share
  FROM (
    SELECT first_7_days * 1.0 / revenue AS observed_share
    FROM monthly_inputs
    ORDER BY observed_share
    LIMIT 2 OFFSET 2
  )
),
model_outputs AS (
  SELECT 'First-seven-day pacing' AS model, 289055.00 / share AS forecast
  FROM median_first_week_share
  UNION ALL
  SELECT 'Six-month linear trend', forecast
  FROM linear_model
  UNION ALL
  SELECT 'August calendar adjustment', 1003797.00 * 30.0 / 31.0
  UNION ALL
  SELECT 'Weighted recent months',
    (
      SELECT SUM(revenue * (x - 2)) / 6.0
      FROM monthly_inputs
      WHERE month IN ('2026-06', '2026-07', '2026-08')
    )
)
SELECT
  model,
  ROUND(forecast, 2) AS forecast,
  ROUND(AVG(forecast) OVER (), 2) AS ensemble_forecast
FROM model_outputs
ORDER BY forecast DESC;
