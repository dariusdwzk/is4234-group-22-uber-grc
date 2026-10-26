import { performLogout } from "@/server/commands/logout";

export async function POST(request: Request): Promise<Response> {
  await performLogout();
  return Response.redirect(new URL("/login", request.url), 303);
}
