import { Module } from "@nestjs/common";
import { SupabaseAuthGuard } from "./supabase-auth.guard";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { PassphraseService } from "./passphrase.service";
import { OtpService } from "./otp.service";

@Module({
  controllers: [AuthController],
  providers: [SupabaseAuthGuard, AuthService, PassphraseService, OtpService],
  // PassphraseService/OtpService exported for PHE-9/PHE-11/PHE-12 to reuse.
  exports: [SupabaseAuthGuard, PassphraseService, OtpService],
})
export class AuthModule {}
