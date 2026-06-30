import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import express from "express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  // Behind Render's reverse proxy: trust the first hop so req.ip is the real
  // client IP (the X-Forwarded-For left-most), not the proxy. Without this the
  // per-IP ThrottlerGuard and the per-IP login lockout would bucket ALL traffic
  // under the proxy's single IP and 429 unrelated users.
  app.set("trust proxy", 1);

  // Stripe webhook needs the raw body for signature verification.
  app.use("/stripe/webhook", express.raw({ type: "application/json" }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // FRONTEND_ORIGIN may carry multiple origins (comma-separated) — staging is
  // served from both a custom domain and the Render URL. The cors middleware
  // reflects the matching origin from an array, which works with credentials.
  const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    })
  );

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`[phenyx-backend] listening on :${port}`);
}

bootstrap();
