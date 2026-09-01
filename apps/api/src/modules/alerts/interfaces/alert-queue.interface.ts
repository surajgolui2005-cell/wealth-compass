/**
 * Alert Queue Constants
 * ─────────────────────
 * Single source of truth for all queue and job name constants in the
 * alerts/notifications subsystem.
 *
 * Keeping these here prevents circular imports between the event listener
 * (which produces jobs), the processor (which consumes them), and the
 * module (which registers the queue).
 */

/** BullMQ queue name for all alert notification jobs. */
export const ALERT_NOTIFICATION_QUEUE = "alert-notifications";

/** BullMQ job name constants */
export const ALERT_JOBS = {
  /**
   * Triggered after a portfolio valuation update.
   * The processor runs the evaluator engine against the snapshot and,
   * if rules fire, enqueues DISPATCH_NOTIFICATION jobs.
   */
  EVALUATE_PORTFOLIO_ALERTS: "evaluate-portfolio-alerts",

  /**
   * Dispatches a single notification (in-app, email, webhook) for one
   * triggered alert rule. One job per channel per rule invocation.
   */
  DISPATCH_NOTIFICATION: "dispatch-notification",
} as const;

// ── Job Payload Types ─────────────────────────────────────────────────────────

/**
 * Payload for EVALUATE_PORTFOLIO_ALERTS jobs.
 * Enqueued by AlertEventListener when portfolio.updated fires.
 */
export interface EvaluatePortfolioAlertsPayload {
  portfolioId: string;
  userId: string;
  /** ISO string of the event that triggered this evaluation. */
  triggeredAt: string;
  /** Human-readable trigger source for logging. */
  source: "portfolio.updated" | "holding.updated" | "manual";
}

/**
 * Notification channel type.
 */
export type NotificationChannel = "in_app" | "email" | "webhook";

/**
 * Payload for DISPATCH_NOTIFICATION jobs.
 * Enqueued by the evaluation processor when a rule fires.
 */
export interface DispatchNotificationPayload {
  alertLogId: string;
  alertRuleId: string;
  alertRuleName: string;
  userId: string;
  portfolioId: string;
  channel: NotificationChannel;
  violationMessage: string;
  triggeredValues: Record<string, unknown>;
  triggeredAt: string;
}
