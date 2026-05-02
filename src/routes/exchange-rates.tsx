import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { todayISO } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/exchange-rates")({ component: Page });

type Rate = { id: string; rate_date: string; rate: number };

function Page() {
  const [items, setItems] = useState<Rate[]>([]);
  const [date, setDate] = useState(todayISO());
  const [rate, setRate] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("exchange_rates")
      .select("*")
      .order("rate_date", { ascending: false });
    setItems((data ?? []) as Rate[]);
  };
  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    const r = Number(rate);
    if (!date || !r || r <= 0) return toast.error("Datos inválidos");
    const { error } = await supabase
      .from("exchange_rates")
      .upsert({ rate_date: date, rate: r }, { onConflict: "rate_date" });
    if (error) return toast.error(error.message);
    toast.success("Tipo de cambio guardado");
    setRate("");
    load();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-3xl font-bold">Tipo de cambio</h1>
      <Card>
        <CardHeader>
          <CardTitle>Registrar tipo de cambio</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-sm font-medium">Fecha</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Tasa (Bs por USD)</label>
            <Input
              type="number"
              step="0.0001"
              placeholder="36.50"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={save} className="w-full">
              Guardar
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Tasa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.rate_date}</TableCell>
                  <TableCell className="text-right font-mono">{Number(r.rate).toFixed(4)}</TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    Sin registros
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}