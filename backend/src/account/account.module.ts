import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AccountController } from "./account.controller";
import { AccountService } from "./account.service";

/**
 * PHE-42 — Account Lifecycle module (export / freeze / delete). Imports AuthModule
 * for the SupabaseAuthGuard; SupabaseService (service-role client, cascade delete)
 * and EncryptionService (owner-side Polaris decrypt on export) are provided by the
 * globally-registered SupabaseModule / CommonModule.
 */
@Module({
  imports: [AuthModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
