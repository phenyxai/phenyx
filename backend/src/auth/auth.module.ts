import { Module } from "@nestjs/common";
import { SupabaseAuthGuard } from "./supabase-auth.guard";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { PassphraseService } from "./passphrase.service";
import { OtpService } from "./otp.service";

@Module({
  controllers: [AuthController],
  providers: [SupabaseAuthGuard, AuthService, PassphraseService, OtpService],
  // PassphraseService stays exported: the account and profile modules still
  // verify the stored hash of passphrase-era accounts.
  exports: [SupabaseAuthGuard, PassphraseService, OtpService],
})
export class AuthModule {}
