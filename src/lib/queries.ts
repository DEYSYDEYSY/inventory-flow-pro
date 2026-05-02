import { supabase } from "@/integrations/supabase/client";
import { todayISO } from "./format";

export async function getTodayRate(): Promise<number | null> {
  const today = todayISO();
  const { data } = await supabase
    .from("exchange_rates")
    .select("rate")
    .eq("rate_date", today)
    .maybeSingle();
  if (data) return Number(data.rate);
  // fallback: latest rate
  const { data: latest } = await supabase
    .from("exchange_rates")
    .select("rate")
    .order("rate_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  return latest ? Number(latest.rate) : null;
}