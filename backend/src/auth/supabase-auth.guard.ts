import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "@supabase/supabase-js";

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers?.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : undefined;

    if (!token) {
      throw new UnauthorizedException({ error: "unauthorized" });
    }

    const url = this.config.get<string>("SUPABASE_URL");
    const anonKey = this.config.get<string>("SUPABASE_ANON_KEY");
    if (!url || !anonKey) {
      throw new UnauthorizedException({ error: "unauthorized" });
    }

    const supabase = createClient(url, anonKey);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      throw new UnauthorizedException({ error: "unauthorized" });
    }

    request.user = { id: data.user.id, email: data.user.email };
    request.supabaseAccessToken = token;
    return true;
  }
}
