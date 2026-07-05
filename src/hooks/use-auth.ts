import { useQuery, useQueryClient } from "@tanstack/react-query";
import { meFn, loginFn, logoutFn } from "@/lib/api/auth.functions";

/**
 * Tracks the current admin session (Sam Stack auth on Neon). Backed by a
 * shared react-query cache so every useAuth() consumer re-renders together
 * after sign in / out (replaces Supabase's global onAuthStateChange).
 */
export function useAuth() {
  const qc = useQueryClient();
  const { data: user = null, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => meFn(),
    staleTime: 60_000,
    retry: false,
  });

  return {
    session: user ? { user: { email: user.email } } : null,
    loading: isLoading,
    email: user?.email ?? null,
    signIn: async (email: string, password: string) => {
      await loginFn({ data: { email, password } });
      await qc.invalidateQueries({ queryKey: ["auth", "me"] });
    },
    signUp: async (_email: string, _password: string) => {
      throw new Error("Sign-up is disabled. Ask the site owner to add an admin account.");
    },
    signOut: async () => {
      await logoutFn();
      await qc.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  };
}
