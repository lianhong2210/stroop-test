/* TEMPORARY: logs icon requests to debug the missing favicon on Android. Delete after. */
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const ua = request.headers.get("user-agent") ?? "";
  console.log(
    `[icon-debug] ${request.method} ${request.nextUrl.pathname}${request.nextUrl.search} ` +
      `ua=${/Android/.test(ua) ? "android" : /iPhone|iPad/.test(ua) ? "ios" : "other"} ` +
      `accept=${request.headers.get("accept") ?? "-"} ` +
      `dest=${request.headers.get("sec-fetch-dest") ?? "-"}`,
  );
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/favicon.ico",
    "/icon1.png",
    "/icon2.png",
    "/apple-icon.png",
    "/apple-touch-icon.png",
    "/apple-touch-icon-precomposed.png",
    "/icons/:path*",
    "/manifest.webmanifest",
  ],
};
