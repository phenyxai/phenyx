import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { SignupStartDto } from "./dto/signup-start.dto";

/**
 * Pre-auth account flow. Routes are unprefixed (no global `/api` prefix in this
 * backend), so this maps to POST /auth/signup/start. PHE-9 (otp/verify) and
 * PHE-12 (signin, reset) add sibling routes here.
 */
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("signup/start")
  @HttpCode(200)
  async signupStart(@Body() dto: SignupStartDto) {
    return this.authService.signupStart(dto);
  }
}
