import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const userCookie = request.cookies.get("user")?.value;
  const path = request.nextUrl.pathname;

  // Protect Dashboard Routes
  if (path.startsWith("/dashboard")) {
    if (!token || !userCookie) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    try {
      const user = JSON.parse(userCookie);
      const role = user.role?.toUpperCase();

      // Role Based Access Control (RBAC) Logic
      if (path.startsWith("/dashboard/admin") && role !== "ADMIN") {
        return NextResponse.redirect(new URL("/login", request.url)); // Optionally pass an error param
      }
      // Assuming AUDITOR role accesses audit but ADMIN potentially has global fallback
      if (path.startsWith("/dashboard/audit") && role !== "AUDITOR" && role !== "ADMIN") {
        return NextResponse.redirect(new URL("/login", request.url));
      }
      if (path.startsWith("/dashboard/dfo") && role !== "DFO" && role !== "ADMIN") {
        return NextResponse.redirect(new URL("/login", request.url));
      }
      if (path.startsWith("/dashboard/verifier") && role !== "VERIFIER" && role !== "ADMIN") {
        return NextResponse.redirect(new URL("/login", request.url));
      }
      
    } catch (e) {
      // Corrupt user cookie, wipe it and force re-login
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("token");
      response.cookies.delete("user");
      return response;
    }
  }

  // Prevent logged-in users from seeing auth pages
  if ((path === "/login" || path === "/signup") && token && userCookie) {
    try {
      const user = JSON.parse(userCookie);
      const role = user.role?.toUpperCase() || "";
      const roleRoutes: Record<string, string> = {
        "ADMIN": "admin",
        "DFO": "dfo",
        "VERIFIER": "verifier",
        "AUDITOR": "audit"
      };
      
      const targetRoute = roleRoutes[role] || "dfo";
      return NextResponse.redirect(new URL(`/dashboard/${targetRoute}`, request.url));
    } catch (e) {
      // Ignore if user cookie fails to parse
    }
  }

  return NextResponse.next();
}

// Optimization: Only run middleware on targeted paths
export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup"],
};
