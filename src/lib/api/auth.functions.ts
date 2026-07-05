// Auth server functions (Sam Stack): login / logout / me. Cookie set+cleared
// via TanStack Start's ambient setCookie/deleteCookie. Server-only imports
// (@/server/auth, which pulls in the DB) are dynamic so they stay off the client.
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { z } from "zod";

export type AuthMe = { id: string; email: string; name: string | null; role: string } | null;

export const meFn = createServerFn({ method: "GET" }).handler(async (): Promise<AuthMe> => {
  const { getSessionUser } = await import("@/server/auth");
  return await getSessionUser(getRequest());
});

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().email(), password: z.string().min(1) }))
  .handler(async ({ data }): Promise<AuthMe> => {
    const auth = await import("@/server/auth");
    const request = getRequest();
    const user = await auth.findUserByEmail(data.email);
    if (!user || !(await auth.verifyPassword(data.password, user.password_hash))) {
      throw new Error("Invalid email or password");
    }
    const token = await auth.createSession(user.id, request);
    setCookie(auth.SESSION_COOKIE, token, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      maxAge: auth.SESSION_TTL_SECONDS,
      secure: new URL(request.url).protocol === "https:",
    });
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  });

export const logoutFn = createServerFn({ method: "POST" }).handler(async (): Promise<{ ok: true }> => {
  const auth = await import("@/server/auth");
  await auth.revokeSession(getRequest());
  deleteCookie(auth.SESSION_COOKIE, { path: "/" });
  return { ok: true };
});
