"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatHolding = formatHolding;
function formatHolding(holding) {
  return `${holding.symbol}: ${holding.quantity} @ ${holding.avgCostBasis} ${holding.costCurrency}`;
}
