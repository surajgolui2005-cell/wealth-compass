import { Holding } from "@investor-pm/types";

export function formatHolding(holding: Holding): string {
  return `${holding.symbol}: ${holding.quantity} @ ${holding.avgCostBasis} ${holding.costCurrency}`;
}
