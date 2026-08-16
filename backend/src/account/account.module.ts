import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AccountController } from "./account.controller";
import { AccountService } from "./account.service";

/**
 * PHE-42 / PHE-75 — Account Lifecycle module (export / close / passphrase).
 * Freeze is gone: disconnecting through Onairos is the only stop. Imports
 * AuthModule for the SupabaseAuthGuard and PassphraseService; SupabaseService
 * and EncryptionService are provided by the globally-registered modules.
 */
@Module({
  imports: [AuthModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
