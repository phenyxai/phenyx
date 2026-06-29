import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

/**
 * Global so any module can inject PrismaService without re-importing.
 * Coexists with SupabaseService (supabase-js); Prisma is for typed,
 * service-role data access.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
