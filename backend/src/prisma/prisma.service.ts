import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * Thin NestJS wrapper around PrismaClient. Connects on module init and
 * disconnects on shutdown so the pooled connection is released cleanly.
 *
 * Connection URLs come from DATABASE_URL (transaction-mode pooler, :6543,
 * pgbouncer=true) and DIRECT_URL (session-mode pooler, :5432) — see
 * prisma/schema.prisma. Prisma loads them from backend/.env automatically.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log("Prisma connected");
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
