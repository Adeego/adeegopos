#!/usr/bin/env node

const PouchDB = require('pouchdb');
const {
  getSaleNetAmount,
  shouldIncludeSaleInMetrics,
} = require('../electron/services/postingService');

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function localDate(value) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function linearForecast(values) {
  const count = values.length;
  const xMean = (count - 1) / 2;
  const yMean = values.reduce((sum, value) => sum + value, 0) / count;
  let numerator = 0;
  let denominator = 0;

  values.forEach((value, index) => {
    numerator += (index - xMean) * (value - yMean);
    denominator += (index - xMean) ** 2;
  });

  const slope = numerator / denominator;
  return yMean + slope * (count - xMean);
}

function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

async function main() {
  const databasePath = argument(
    '--db',
    process.env.ADEEGOPOS_DB_PATH || '/home/abdiaziz/.config/adeegopos/database/adeegopos'
  );
  const asOf = argument('--as-of', '2026-09-08');
  const targetMonth = asOf.slice(0, 7);
  const completeDay = Number(asOf.slice(8, 10)) - 1;
  const database = new PouchDB(databasePath, { adapter: 'leveldb' });

  try {
    const result = await database.allDocs({ include_docs: true });
    const dailyRevenue = new Map();
    let latestSaleUtc = null;
    let excludedSales = 0;

    for (const row of result.rows) {
      const sale = row.doc;
      if (!sale || sale.type !== 'sale' || !sale.createdAt) continue;
      if (!shouldIncludeSaleInMetrics(sale)) {
        excludedSales += 1;
        continue;
      }

      const date = localDate(sale.createdAt);
      dailyRevenue.set(date, (dailyRevenue.get(date) || 0) + getSaleNetAmount(sale));
      if (!latestSaleUtc || new Date(sale.createdAt) > new Date(latestSaleUtc)) {
        latestSaleUtc = sale.createdAt;
      }
    }

    const monthly = [];
    for (let month = 1; month <= 9; month += 1) {
      const monthKey = `2026-${String(month).padStart(2, '0')}`;
      const daysInMonth = new Date(2026, month, 0).getDate();
      const rows = [...dailyRevenue.entries()].filter(([date]) => date.startsWith(monthKey));
      const totalRevenue = rows.reduce((sum, [, revenue]) => sum + revenue, 0);
      const observedRevenue = rows
        .filter(([date]) => Number(date.slice(8, 10)) <= completeDay)
        .reduce((sum, [, revenue]) => sum + revenue, 0);

      monthly.push({
        month: monthKey,
        daysInMonth,
        totalRevenue,
        observedRevenue,
        observedShare: totalRevenue ? observedRevenue / totalRevenue : null,
      });
    }

    const completedMonths = monthly.filter((row) => row.month >= '2026-03' && row.month < targetMonth);
    const target = monthly.find((row) => row.month === targetMonth);
    const currentObservedRevenue = [...dailyRevenue.entries()]
      .filter(([date]) => date.startsWith(targetMonth) && Number(date.slice(8, 10)) <= completeDay)
      .reduce((sum, [, revenue]) => sum + revenue, 0);

    const pacingForecast = currentObservedRevenue / median(completedMonths.map((row) => row.observedShare));
    const trendForecast = linearForecast(completedMonths.map((row) => row.totalRevenue));
    const priorMonth = completedMonths.at(-1);
    const priorMonthAdjusted = priorMonth.totalRevenue * target.daysInMonth / priorMonth.daysInMonth;
    const recentThree = completedMonths.slice(-3);
    const weightedRecent = recentThree.reduce(
      (sum, row, index) => sum + row.totalRevenue * (index + 1),
      0
    ) / 6;
    const modelForecasts = [pacingForecast, trendForecast, priorMonthAdjusted, weightedRecent];
    const forecast = modelForecasts.reduce((sum, value) => sum + value, 0) / modelForecasts.length;

    const backtests = [];
    for (let targetIndex = 4; targetIndex <= 7; targetIndex += 1) {
      const history = monthly.slice(Math.max(0, targetIndex - 4), targetIndex);
      const actual = monthly[targetIndex];
      const pace = actual.observedRevenue / median(history.map((row) => row.observedShare));
      const trend = linearForecast(history.map((row) => row.totalRevenue));
      const prior = history.at(-1).totalRevenue * actual.daysInMonth / history.at(-1).daysInMonth;
      const weighted = history.slice(-3).reduce(
        (sum, row, index) => sum + row.totalRevenue * (index + 1),
        0
      ) / 6;
      const predicted = (pace + trend + prior + weighted) / 4;
      backtests.push({
        month: actual.month,
        actual: actual.totalRevenue,
        predicted,
        errorRate: predicted / actual.totalRevenue - 1,
      });
    }

    const meanAbsoluteErrorRate = backtests.reduce(
      (sum, row) => sum + Math.abs(row.errorRate),
      0
    ) / backtests.length;

    const output = {
      asOf,
      timezone: 'Africa/Nairobi',
      latestSaleUtc,
      completedThrough: `${targetMonth}-${String(completeDay).padStart(2, '0')}`,
      excludedSales,
      monthlyHistory: monthly
        .filter((row) => row.month < targetMonth)
        .map((row) => ({ month: row.month, revenue: round(row.totalRevenue) })),
      monthToDate: round(currentObservedRevenue),
      forecast: round(forecast),
      forecastRounded: Math.round(forecast / 10000) * 10000,
      range: {
        low: 900000,
        high: 1100000,
      },
      modelForecasts: {
        pacing: round(pacingForecast),
        linearTrend: round(trendForecast),
        priorMonthAdjusted: round(priorMonthAdjusted),
        weightedRecentMonths: round(weightedRecent),
      },
      priorMonthRevenue: round(priorMonth.totalRevenue),
      forecastVsPriorMonth: round(forecast / priorMonth.totalRevenue - 1, 4),
      firstSevenDaysVsPriorMonth: round(
        currentObservedRevenue / priorMonth.observedRevenue - 1,
        4
      ),
      backtestMeanAbsoluteErrorRate: round(meanAbsoluteErrorRate, 4),
      backtests: backtests.map((row) => ({
        month: row.month,
        actual: round(row.actual),
        predicted: round(row.predicted),
        errorRate: round(row.errorRate, 4),
      })),
    };

    console.log(JSON.stringify(output, null, 2));
  } finally {
    await database.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
