import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { PersonaService } from "./persona.service";

@Controller()
export class PersonaController {
  constructor(private readonly personaService: PersonaService) {}

  /**
   * Regenerates the caller's own constellation. The user id always comes from
   * the verified session, never the request body: trusting `body.userId` let
   * any signed-in user overwrite someone else's constellation_state and
   * onairos_data.
   */
  @Post("generate-prompts")
  @UseGuards(SupabaseAuthGuard)
  async generate(@Req() req: Request, @Body() body: any) {
    const user = (req as any).user as { id: string };
    return this.personaService.generatePrompts({
      onairosData: body?.onairosData,
      userId: user.id,
    });
  }
}
