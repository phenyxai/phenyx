import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { OnairosConnectDto, OnairosDisconnectDto } from "./onairos.dto";
import { OnairosService } from "./onairos.service";

/**
 * Owner-authed Onairos endpoints (PHE-40). The guard resolves `req.user.id` from
 * the bearer, so every write is scoped to the caller — a non-owner cannot connect
 * or disconnect on someone else's behalf.
 */
@Controller("onairos")
@UseGuards(SupabaseAuthGuard)
export class OnairosController {
  constructor(private readonly onairosService: OnairosService) {}

  @Post("connect")
  async connect(@Req() req: Request, @Body() body: OnairosConnectDto) {
    const user = (req as any).user as { id: string };
    return this.onairosService.connect(user.id, body);
  }

  @Post("disconnect")
  async disconnect(@Req() req: Request, @Body() body: OnairosDisconnectDto) {
    const user = (req as any).user as { id: string };
    return this.onairosService.disconnect(user.id, body.platform);
  }

  @Get("connections")
  async connections(@Req() req: Request) {
    const user = (req as any).user as { id: string };
    return this.onairosService.listConnections(user.id);
  }
}
