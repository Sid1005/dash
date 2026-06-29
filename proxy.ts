import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isAuthBypassEnabled } from "@/lib/auth-bypass";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  if (isAuthBypassEnabled()) {
    return response;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) {
    return NextResponse.json(
      { error: "Supabase authentication is not configured" },
      { status: 503 }
    );
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  const isAuthRoute = path === "/login" || path.startsWith("/auth/");
  const isApiRoute = path.startsWith("/api/");
  const isTelegramApi = path.startsWith("/api/telegram/");
  const isStaticAsset =
    path.startsWith("/_next") ||
    path.startsWith("/static") ||
    path.includes("favicon.ico") ||
    path.includes("sitemap.xml");

  const apiKey = request.headers.get("x-api-key");
  const isSystemCron =
    !!apiKey &&
    (apiKey === process.env.TELEGRAM_WEBHOOK_SECRET ||
      apiKey === process.env.QUICK_LOG_SECRET);

  if (!user && isApiRoute && !isTelegramApi && !isSystemCron) {
    return NextResponse.json(
      { error: "Unauthorized access" },
      { status: 401 }
    );
  }

  if (!user && !isAuthRoute && !isApiRoute && !isStaticAsset) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  if (user && path === "/login") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    return NextResponse.redirect(homeUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
