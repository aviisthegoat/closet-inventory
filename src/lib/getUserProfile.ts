import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabaseClient";

export type UserProfile = {
  id: string;
  full_name: string | null;
  role: "admin" | "staff" | "viewer";
};

export async function getCurrentUserProfile() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, profile: null as UserProfile | null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return {
    user,
    profile: (profile as UserProfile | null) ?? null,
  };
}

