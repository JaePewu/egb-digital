import { NextResponse } from "next/server";
import { authenticateUser, setSessionCookie } from "@/lib/auth";
import { getDefaultPathForUser } from "@/lib/access";

export async function POST(request: Request) {
  const formData = await request.formData();
  const correo = String(formData.get("correo") ?? "");
  const contrasena = String(formData.get("contrasena") ?? "");
  const result = await authenticateUser(correo, contrasena);

  if (!result.ok) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", result.error);
    return NextResponse.redirect(url, { status: 303 });
  }

  const response = NextResponse.redirect(new URL(getDefaultPathForUser(result.user), request.url), {
    status: 303,
  });
  setSessionCookie(response, result.user.id);
  return response;
}
