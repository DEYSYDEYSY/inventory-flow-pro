import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertTriangle, TrendingUp, DollarSign } from "lucide-react";
import { formatBs, formatUsd, todayISO } from "@/lib/format";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

type Stats = {
  salesTodayBs: number;
  salesTodayUsd: number;
  totalProducts: number;
  lowStock: { id: string; name: string; stock: number; min_stock: number }[];
};

function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    salesTodayBs: 0,
    salesTodayUsd: 0,
    totalProducts: 0,
    lowStock: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const today = todayISO();
      const startISO = `${today}T00:00:00.000Z`;
      const endISO = `${today}T23:59:59.999Z`;
      const [salesRes, prodCountRes, lowRes] = await Promise.all([
        supabase
          .from("sales")
          .select("total_bs,total_usd")
          .gte("sale_date", startISO)
          .lte("sale_date", endISO),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id,name,stock,min_stock"),
      ]);
      const salesTodayBs = (salesRes.data ?? []).reduce((s, r) => s + Number(r.total_bs), 0);
      const salesTodayUsd = (salesRes.data ?? []).reduce((s, r) => s + Number(r.total_usd), 0);
      const lowStock = (lowRes.data ?? []).filter(
        (p) => Number(p.stock) <= Number(p.min_stock),
      );
      setStats({
        salesTodayBs,
        salesTodayUsd,
        totalProducts: prodCountRes.count ?? 0,
        lowStock,
      });
      setLoading(false);
    };
    load();
  }, []);

  const cards = [
    {
      title: "Ventas hoy (Bs)",
      value: formatBs(stats.salesTodayBs),
      icon: TrendingUp,
      color: "text-success",
    },
    {
      title: "Ventas hoy (USD)",
      value: formatUsd(stats.salesTodayUsd),
      icon: DollarSign,
      color: "text-primary",
    },
    {
      title: "Total productos",
      value: String(stats.totalProducts),
      icon: Package,
      color: "text-accent-foreground",
    },
    {
      title: "Bajo stock",
      value: String(stats.lowStock.length),
      icon: AlertTriangle,
      color: "text-destructive",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Resumen del día</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {c.title}
              </CardTitle>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "…" : c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Productos con bajo stock</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todo el stock está en buen nivel ✅</p>
          ) : (
            <ul className="divide-y">
              {stats.lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-sm text-destructive">
                    {p.stock} / mín {p.min_stock}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
