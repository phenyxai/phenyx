import { Module } from "@nestjs/common";
import { SupabaseAuthGuard } from "./supabase-auth.guard";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { OtpService } from "./otp.service";
import { ConfirmCodeService } from "./confirm-code.service";

@Module({
  controllers: [AuthController],
  providers: [SupabaseAuthGuard, AuthService, OtpService, ConfirmCodeService],
  // ConfirmCodeService: the account and profile modules confirm sensitive
  // changes with an emailed code (PHE-97: there is no passphrase).
  exports: [SupabaseAuthGuard, OtpService, ConfirmCodeService],
})
export class AuthModule {}
