import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { SynthesisService } from "./synthesis.service";

@Controller()
export class SynthesisController {
  constructor(private readonly synthesisService: SynthesisService) {}

  @Post("synthesize-constellation")
  @UseGuards(SupabaseAuthGuard)
  async synthesize(@Req() req: Request, @Body() body: any) {
    const user = (req as any).user as { id: string; email?: string };
    return this.synthesisService.synthesize(user.id, body);
  }
}
