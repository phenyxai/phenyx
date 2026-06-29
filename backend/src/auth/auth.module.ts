import { Module } from "@nestjs/common";
import { SupabaseAuthGuard } from "./supabase-auth.guard";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { PassphraseService } from "./passphrase.service";
import { LoginThrottleService } from "./login-throttle.service";
import { OtpService } from "./otp.service";

@Module({
  controllers: [AuthController],
  providers: [
    SupabaseAuthGuard,
    AuthService,
    PassphraseService,
    LoginThrottleService,
    OtpService,
  ],
  // PassphraseService/OtpService exported for PHE-9/PHE-11/PHE-12 to reuse.
  // LoginThrottleService exported so PHE-12's signin/reset routes can share the
  // same per-account/per-IP brute-force lockout used by verifyCredentials.
  exports: [SupabaseAuthGuard, PassphraseService, OtpService, LoginThrottleService],
})
export class AuthModule {}
