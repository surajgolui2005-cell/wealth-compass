/**
 * Alert Module DTOs
 * ─────────────────
 * Defines all inbound and outbound shapes for the Alerts REST API:
 *
 *   CreateAlertRuleDto    — POST /api/v1/alerts
 *   UpdateAlertRuleDto    — PUT  /api/v1/alerts/:id
 *   AlertRuleResponseDto  — GET  /api/v1/alerts, GET /api/v1/alerts/:id
 *   AlertLogResponseDto   — GET  /api/v1/alerts/:id/history
 *   EvaluateAlertDto      — POST /api/v1/alerts/evaluate (manual trigger for testing)
 */

import { AlertType, DeliveryStatus } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

// ── CreateAlertRuleDto ────────────────────────────────────────────────────────

export class CreateAlertRuleDto {
  @IsString()
  @IsNotEmpty({ message: "Alert rule name is required" })
  @MaxLength(128, { message: "Alert name cannot exceed 128 characters" })
  name: string;

  @IsEnum(AlertType, {
    message: `alertType must be one of: ${Object.values(AlertType).join(", ")}`,
  })
  alertType: AlertType;

  /**
   * Typed condition payload — shape depends on alertType:
   *
   *  DRAWDOWN_LIMIT      → { thresholdPct: number }
   *  PORTFOLIO_REBALANCE → { maxAssetWeightPct?: number; maxSectorWeightPct?: number }
   *                        OR { tolerancePpt: number }  (TargetDrift variant)
   *  RISK_SCORE_SPIKE    → { thresholdPct: number }
   *  PRICE_THRESHOLD     → { symbol: string; thresholdPrice: number; direction: 'above'|'below' }
   *  FD_MATURITY         → { daysBeforeMaturity: number }
   *  SYNC_FAILURE        → {}   (fires on any sync error)
   */
  @IsObject({ message: "condition must be a JSON object" })
  @IsNotEmpty()
  condition: Record<string, unknown>;

  /**
   * Notification channel configuration.
   * e.g. { "email": true, "push": false, "sms": false }
   */
  @IsObject({ message: "channels must be a JSON object" })
  @IsNotEmpty()
  channels: Record<string, unknown>;

  /**
   * Minimum minutes between successive alerts for the same rule.
   * Defaults to 60 minutes (1 hour) to prevent notification fatigue.
   */
  @IsOptional()
  @IsInt()
  @Min(1, { message: "cooldownDurationMinutes must be at least 1" })
  @Max(10080, { message: "cooldownDurationMinutes cannot exceed 10080 (1 week)" })
  @Type(() => Number)
  cooldownDurationMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ── UpdateAlertRuleDto ────────────────────────────────────────────────────────

export class UpdateAlertRuleDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @IsObject()
  condition?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  channels?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10080)
  @Type(() => Number)
  cooldownDurationMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ── AlertRuleResponseDto ──────────────────────────────────────────────────────

export class AlertRuleResponseDto {
  id: string;
  userId: string;
  name: string;
  alertType: AlertType;
  condition: Record<string, unknown>;
  channels: Record<string, unknown>;
  cooldownDurationMinutes: number;
  isActive: boolean;
  lastTriggeredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;

  /** Number of times this rule has fired (populated by JOIN query). */
  triggerCount?: number;

  static fromPrisma(rule: {
    id: string;
    userId: string;
    name: string;
    alertType: AlertType;
    condition: unknown;
    channels: unknown;
    cooldownDurationMinutes: number;
    isActive: boolean;
    lastTriggeredAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    _count?: { instances: number };
  }): AlertRuleResponseDto {
    const dto = new AlertRuleResponseDto();
    dto.id = rule.id;
    dto.userId = rule.userId;
    dto.name = rule.name;
    dto.alertType = rule.alertType;
    dto.condition = rule.condition as Record<string, unknown>;
    dto.channels = rule.channels as Record<string, unknown>;
    dto.cooldownDurationMinutes = rule.cooldownDurationMinutes;
    dto.isActive = rule.isActive;
    dto.lastTriggeredAt = rule.lastTriggeredAt;
    dto.createdAt = rule.createdAt;
    dto.updatedAt = rule.updatedAt;
    dto.triggerCount = rule._count?.instances;
    return dto;
  }
}

// ── AlertLogResponseDto ───────────────────────────────────────────────────────

export class AlertLogResponseDto {
  id: string;
  alertRuleId: string;
  alertRuleName: string;
  alertType: AlertType;
  triggeredAt: Date;
  triggeredValues: Record<string, unknown>;
  deliveryStatus: DeliveryStatus;
  deliveredAt: Date | null;
  errorMessage: string | null;

  static fromPrisma(log: {
    id: string;
    alertRuleId: string;
    triggeredAt: Date;
    triggeredValues: unknown;
    deliveryStatus: DeliveryStatus;
    deliveredAt: Date | null;
    errorMessage: string | null;
    alertRule: { name: string; alertType: AlertType };
  }): AlertLogResponseDto {
    const dto = new AlertLogResponseDto();
    dto.id = log.id;
    dto.alertRuleId = log.alertRuleId;
    dto.alertRuleName = log.alertRule.name;
    dto.alertType = log.alertRule.alertType;
    dto.triggeredAt = log.triggeredAt;
    dto.triggeredValues = log.triggeredValues as Record<string, unknown>;
    dto.deliveryStatus = log.deliveryStatus;
    dto.deliveredAt = log.deliveredAt;
    dto.errorMessage = log.errorMessage;
    return dto;
  }
}

// ── EvaluateAlertDto (manual evaluation trigger) ──────────────────────────────

export class EvaluateAlertDto {
  /** Portfolio to evaluate all alert rules against. */
  @IsUUID()
  @IsNotEmpty()
  portfolioId: string;

  /**
   * Optional: specify only these rule IDs to evaluate (subset evaluation).
   * Omit to evaluate all active rules for the portfolio's owner.
   */
  @IsOptional()
  @IsUUID("4", { each: true })
  ruleIds?: string[];
}
