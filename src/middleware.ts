import { NextResponse, type NextRequest } from "next/server";

// Public access: no login required. Everyone with the app URL can use the inventory.
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};

