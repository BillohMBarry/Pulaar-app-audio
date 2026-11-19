import { createClient } from "@/lib/server";

export interface AdminUser {
  id: string;
  email: string | null;
}

/**
 * Verifies the current Supabase Auth user is authenticated AND has
 * app_metadata.role === 'admin' (never user_metadata).
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return null;

  const role = data.user.app_metadata?.role;
  if (role !== "admin") return null;

  return {
    id: data.user.id,
    email: data.user.email ?? null,
  };
}
