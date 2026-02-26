import { type SupabaseClient } from "@supabase/supabase-js";

type EntityType =
  | "location"
  | "bin"
  | "item_group"
  | "item"
  | "checkout"
  | "qr_code";

export async function logActivity(
  supabase: SupabaseClient,
  params: {
    userId: string | null;
    action: string;
    entityType: EntityType;
    entityId?: string;
    details?: Record<string, unknown>;
  },
) {
  const { userId, action, entityType, entityId, details } = params;

  await supabase.from("activity_logs").insert({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    details: details ?? null,
  });
}

