import { supabase } from "./supabase";

export type SupabaseHealthResult =
  | {
      ok: true;
      message: string;
    }
  | {
      ok: false;
      message: string;
    };

export async function checkSupabaseConnection(): Promise<SupabaseHealthResult> {
  if (!supabase) {
    return {
      ok: false,
      message:
        "Supabase is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local.",
    };
  }

  const { error } = await supabase
    .from("data_sources")
    .select("code")
    .limit(1);

  if (error) {
    return {
      ok: false,
      message: error.message,
    };
  }

  return {
    ok: true,
    message: "Supabase connection is ready.",
  };
}