import {
  Body,
  Controller,
  Get,
  Param,
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
   * Body: { thread_id?, question }. Returns { answer, pillar_tag, thread_id,
   * message_id, usage } (or { limit_reached } / { is_crisis } short-circuits).
   */
  @Post("ask")
  @UseGuards(SupabaseAuthGuard)
  async ask(
    @Req() req: Request,
    @Body() body: { thread_id?: string; question?: string }
  ) {
    const user = (req as any).user as { id: string; email?: string };
    return this.polarisService.ask(user.id, body);
  }

  /**
   * GET /api/polaris/threads — idle-view payload: past conversations, four
   * pillar-tagged questions from the caller's top pillars, and the weekly
   * token allowance for the token pill.
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
}
