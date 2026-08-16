import { supabase } from "./supabaseClient.js";

// Drop-in replacement for the `window.storage` API used inside App.jsx, backed
// by a single Supabase Postgres row per signed-in user. Because the app only
// ever reads/writes one key (the whole app-state blob), this stores the
// entire object as one `jsonb` column rather than building a generic
// multi-key store.

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

export const storage = {
  async get(key) {
    const userId = await currentUserId();
    if (!userId) return null;
    const { data, error } = await supabase
      .from("app_data")
      .select("data")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return null;
    return { key, value: JSON.stringify(data.data), shared: false };
  },

  async set(key, value) {
    const userId = await currentUserId();
    if (!userId) return null;
    const parsed = JSON.parse(value);
    const { error } = await supabase
      .from("app_data")
      .upsert({ user_id: userId, data: parsed, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) {
      console.error("Supabase save failed:", error.message);
      return null;
    }
    return { key, value, shared: false };
  },

  async delete(key) {
    const userId = await currentUserId();
    if (!userId) return null;
    const { error } = await supabase.from("app_data").delete().eq("user_id", userId);
    if (error) return null;
    return { key, deleted: true, shared: false };
  },

  async list() {
    return { keys: [], prefix: "", shared: false };
  },
};
