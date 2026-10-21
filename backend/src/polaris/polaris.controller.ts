import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { PolarisService } from "./polaris.service";

@Controller("api/polaris")
export class PolarisController {
  constructor(private readonly polarisService: PolarisService) {}

  /**
   * POST /api/polaris/ask — one authed question becomes exactly one grounded Claude
   * call. Bearer-auth via SupabaseAuthGuard, which resolves the user onto req.user.
   * Body: { thread_id?, question, mode?, context? }; mode and context only
   * apply when the call opens a new conversation. Returns { answer, pillar_tag,
   * thread_id, mode, message_id, usage } (or { limit_reached } / { is_crisis }
   * short-circuits).
   */
  @Post("ask")
  @UseGuards(SupabaseAuthGuard)
  async ask(
    @Req() req: Request,
    @Body()
    body: { thread_id?: string; question?: string; mode?: string; context?: string }
  ) {
    const user = (req as any).user as { id: string; email?: string };
    return this.polarisService.ask(user.id, body);
  }

  /**
   * GET /api/polaris/threads — idle-view payload: past conversations, one
   * starter question per mode from the caller's top pillars, and the weekly
   * question allowance for the allowance badge.
   */
  @Get("threads")
  @UseGuards(SupabaseAuthGuard)
  async listThreads(@Req() req: Request) {
    const user = (req as any).user as { id: string };
    return this.polarisService.listThreads(user.id);
  }

  /**
   * GET /api/polaris/threads/:id — reload one thread's messages (decrypted for
   * plain-text render), ownership-checked (a thread the caller does not own is a
   * 404, exactly like the ask path's ownership guard).
   */
  @Get("threads/:id")
  @UseGuards(SupabaseAuthGuard)
  async getThread(@Req() req: Request, @Param("id") id: string) {
    const user = (req as any).user as { id: string };
    return this.polarisService.getThread(user.id, id);
  }

  /**
   * POST /api/polaris/plans/:messageId — a plan card's check-offs and save
   * (PHE-129). Body: { done?: number[], saved?: boolean }. The reply must be
   * the caller's; anything else is a 404.
   */
  @Post("plans/:messageId")
  @UseGuards(SupabaseAuthGuard)
  async setPlan(
    @Req() req: Request,
    @Param("messageId", ParseUUIDPipe) messageId: string,
    @Body() body: { done?: unknown; saved?: unknown }
  ) {
    const user = (req as any).user as { id: string };
    return this.polarisService.setPlan(user.id, messageId, body ?? {});
  }
}
