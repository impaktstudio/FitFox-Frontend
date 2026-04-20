import { routeHandler } from "@/lib/api/handler";
import { getReadinessReport } from "@/lib/readiness/service";

export const runtime = "nodejs";

export const GET = routeHandler(() => getReadinessReport());
