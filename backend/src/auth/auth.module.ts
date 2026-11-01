import { Module } from "@nestjs/common";
import { SupabaseAuthGuard } from "./supabase-auth.guard";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { OtpService } from "./otp.service";

@Module({
  controllers: [AuthController],
  providers: [SupabaseAuthGuard, AuthService, OtpService],
  exports: [SupabaseAuthGuard, OtpService],
})
export class AuthModule {}
