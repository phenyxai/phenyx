import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { PersonaService } from "./persona.service";

@Controller()
export class PersonaController {
  constructor(private readonly personaService: PersonaService) {}

  @Post("generate-prompts")
  @UseGuards(SupabaseAuthGuard)
  async generate(@Body() body: any) {
    return this.personaService.generatePrompts(body);
  }
}
