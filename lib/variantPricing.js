function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundUpToNext05Kes(value) {
  const numericValue = toNumber(value);
  if (numericValue === null || numericValue < 0) {
    return 0;
  }

  const roundedUp = Math.ceil(numericValue);
  const remainder = roundedUp % 10;

  if (remainder === 0 || remainder === 5) {
    return roundedUp;
  }

  if (remainder < 5) {
    return roundedUp + (5 - remainder);
  }

  return roundedUp + (10 - remainder);
}

function deriveMarginPercent(currentBuyPrice, conversionFactor, currentUnitPrice) {
  const baseBuyPrice = toNumber(currentBuyPrice);
  const factor = toNumber(conversionFactor);
  const unitPrice = toNumber(currentUnitPrice);

  if (baseBuyPrice === null || factor === null || unitPrice === null || baseBuyPrice <= 0 || factor <= 0 || unitPrice <= 0) {
    return null;
  }

  const costPrice = baseBuyPrice * factor;

  if (costPrice <= 0) {
    return null;
  }

  const marginPercent = ((unitPrice - costPrice) / unitPrice) * 100;

  if (!Number.isFinite(marginPercent)) {
    return null;
  }

  return Number(marginPercent.toFixed(4));
}

function computeVariantUnitPrice(baseBuyPrice, conversionFactor, marginPercent) {
  const unitBuyPrice = toNumber(baseBuyPrice);
  const factor = toNumber(conversionFactor);
  const margin = toNumber(marginPercent);

  if (unitBuyPrice === null || factor === null || margin === null || unitBuyPrice <= 0 || factor <= 0 || margin >= 100) {
    return 0;
  }

  const rawSellingPrice = (unitBuyPrice * factor) / (1 - (margin / 100));
  return roundUpToNext05Kes(rawSellingPrice);
}

module.exports = {
  computeVariantUnitPrice,
  deriveMarginPercent,
  roundUpToNext05Kes,
};
