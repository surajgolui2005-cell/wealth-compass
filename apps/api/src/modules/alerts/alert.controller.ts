/**
 * AlertController
 * ────────────────
 * REST API surface for the Alert module.
 *
 * All routes require a valid JWT (JwtAuthGuard).
 * userId is always extracted from the JWT payload, never from the request body,
 * to prevent IDOR (Insecure Direct Object Reference) attacks.
 *
 * Route Map:
 *   POST   /api/v1/alerts                     — Create alert rule
 *   GET    /api/v1/alerts                     — List all alert rules for user
 *   GET    /api/v1/alerts/history             — All trigger logs for user
 *   GET    /api/v1/alerts/:id                 — Get single alert rule
 *   GET    /api/v1/alerts/:id/history         — Trigger logs for a specific rule
 *   GET    /api/v1/alerts/:id/cooldown        — Cooldown status for a rule
 *   PUT    /api/v1/alerts/:id                 — Update alert rule
 *   DELETE /api/v1/alerts/:id                 — Soft-delete alert rule
 *   POST   /api/v1/alerts/evaluate            — Manual evaluation trigger
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AlertService } from "./alert.service";
import { CreateAlertRuleDto, EvaluateAlertDto, UpdateAlertRuleDto } from "./dto/alert.dto";

type AuthRequest = Request & { user: { id: string } };

@UseGuards(JwtAuthGuard)
@Controller("api/v1/alerts")
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  // ── Rule CRUD ─────────────────────────────────────────────────────────────

  /** POST /api/v1/alerts — Create a new alert rule */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createAlertRule(@Req() req: AuthRequest, @Body() dto: CreateAlertRuleDto) {
    return this.alertService.createAlertRule(req.user.id, dto);
  }

  /** GET /api/v1/alerts — List all alert rules belonging to the user */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getUserAlertRules(@Req() req: AuthRequest) {
    return this.alertService.getUserAlertRules(req.user.id);
  }

  /**
   * GET /api/v1/alerts/history — All alert fire history for the user.
   * Placed BEFORE /:id to prevent 'history' being parsed as a UUID param.
   *
   * Query params:
   *   limit  — page size (default 50, max 200)
   *   offset — pagination offset (default 0)
   */
  @Get("history")
  @HttpCode(HttpStatus.OK)
  async getUserAlertHistory(
    @Req() req: AuthRequest,
    @Query("limit", new ParseIntPipe({ optional: true })) limit = 50,
    @Query("offset", new ParseIntPipe({ optional: true })) offset = 0,
  ) {
    return this.alertService.getUserAlertHistory(req.user.id, limit, offset);
  }

  /** GET /api/v1/alerts/:id — Get a single alert rule by ID */
  @Get(":id")
  @HttpCode(HttpStatus.OK)
  async getAlertRuleById(@Req() req: AuthRequest, @Param("id", ParseUUIDPipe) ruleId: string) {
    return this.alertService.getAlertRuleById(req.user.id, ruleId);
  }

  /**
   * GET /api/v1/alerts/:id/history — Fire history for a specific alert rule.
   *
   * Query params:
   *   limit  — page size (default 50, max 200)
   *   offset — pagination offset (default 0)
   */
  @Get(":id/history")
  @HttpCode(HttpStatus.OK)
  async getAlertHistory(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) ruleId: string,
    @Query("limit", new ParseIntPipe({ optional: true })) limit = 50,
    @Query("offset", new ParseIntPipe({ optional: true })) offset = 0,
  ) {
    return this.alertService.getAlertHistory(req.user.id, ruleId, limit, offset);
  }

  /**
   * GET /api/v1/alerts/:id/cooldown — Current cooldown status for a rule.
   * Returns:
   *   { inCooldown: boolean, remainingMinutes: number | null, lastTriggeredAt: Date | null }
   */
  @Get(":id/cooldown")
  @HttpCode(HttpStatus.OK)
  async getCooldownStatus(@Req() req: AuthRequest, @Param("id", ParseUUIDPipe) ruleId: string) {
    return this.alertService.getCooldownStatus(req.user.id, ruleId);
  }

  /** PUT /api/v1/alerts/:id — Update an existing alert rule */
  @Put(":id")
  @HttpCode(HttpStatus.OK)
  async updateAlertRule(
    @Req() req: AuthRequest,
    @Param("id", ParseUUIDPipe) ruleId: string,
    @Body() dto: UpdateAlertRuleDto,
  ) {
    return this.alertService.updateAlertRule(req.user.id, ruleId, dto);
  }

  /** DELETE /api/v1/alerts/:id — Soft-delete an alert rule */
  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  async deleteAlertRule(@Req() req: AuthRequest, @Param("id", ParseUUIDPipe) ruleId: string) {
    return this.alertService.deleteAlertRule(req.user.id, ruleId);
  }

  // ── Manual Evaluation Trigger ─────────────────────────────────────────────

  /**
   * POST /api/v1/alerts/evaluate
   * On-demand rule evaluation against the latest portfolio snapshot.
   * Primarily for testing, debugging, and dashboard "check now" UI actions.
   * Returns a per-rule summary (evaluated, suppressed, triggered, violationMessage).
   */
  @Post("evaluate")
  @HttpCode(HttpStatus.OK)
  async evaluatePortfolio(@Req() req: AuthRequest, @Body() dto: EvaluateAlertDto) {
    return this.alertService.evaluatePortfolio(req.user.id, dto);
  }
}
