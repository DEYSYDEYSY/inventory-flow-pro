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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatUsd, todayISO } from "@/lib/format";
import { getTodayRate } from "@/lib/queries";

export const Route = createFileRoute("/purchases")({ component: Page });

type Purchase = {
  id: string;
  product_id: string;
  supplier_id: string | null;
  quantity: number;
  total_cost_usd: number;
  unit_cost_usd: number;
  invoice_number: string | null;
  exchange_rate: number;
  purchase_date: string;
  products?: { name: string };
  suppliers?: { name: string } | null;
};

function Page() {
  const [items, setItems] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    product_id: "",
    supplier_id: "",
    quantity: "",
    total_cost_usd: "",
    invoice_number: "",
    exchange_rate: "",
    purchase_date: todayISO(),
  });

  const load = async () => {
    const [pRes, prRes, sRes, rate] = await Promise.all([
      supabase
        .from("purchases")
        .select("*, products!purchases_product_fk(name), suppliers!purchases_supplier_fk(name)")
        .order("purchase_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("products").select("id,name").order("name"),
      supabase.from("suppliers").select("id,name").order("name"),
      getTodayRate(),
    ]);
    setItems((pRes.data ?? []) as Purchase[]);
    setProducts(prRes.data ?? []);
    setSuppliers(sRes.data ?? []);
    setForm((f) => ({ ...f, exchange_rate: rate ? String(rate) : "" }));
  };
  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    const qty = Number(form.quantity);
    const total = Number(form.total_cost_usd);
    const rate = Number(form.exchange_rate);
    if (!form.product_id) return toast.error("Selecciona producto");
    if (!qty || qty <= 0) return toast.error("Cantidad inválida");
    if (!total || total < 0) return toast.error("Costo inválido");
    if (!rate || rate <= 0) return toast.error("Tipo de cambio requerido");
    const { error } = await supabase.from("purchases").insert({
      product_id: form.product_id,
      supplier_id: form.supplier_id || null,
      quantity: qty,
      total_cost_usd: total,
      unit_cost_usd: total / qty,
      invoice_number: form.invoice_number || null,
      exchange_rate: rate,
      purchase_date: form.purchase_date,
    });
    if (error) return toast.error(error.message);
    toast.success("Ingreso registrado, stock actualizado");
    setForm({
      product_id: "",
      supplier_id: "",
      quantity: "",
      total_cost_usd: "",
      invoice_number: "",
      exchange_rate: String(rate),
      purchase_date: todayISO(),
    });
    load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Ingresos (Compras)</h1>
      <Card>
        <CardHeader>
          <CardTitle>Registrar ingreso</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="text-sm font-medium">Producto</label>
            <Select
              value={form.product_id}
              onValueChange={(v) => setForm({ ...form, product_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Proveedor</label>
            <Select
              value={form.supplier_id}
              onValueChange={(v) => setForm({ ...form, supplier_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Opcional" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">N° Factura</label>
            <Input
              value={form.invoice_number}
              onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Cantidad</label>
            <Input
              type="number"
              step="0.01"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Costo total (USD)</label>
            <Input
              type="number"
              step="0.01"
              value={form.total_cost_usd}
              onChange={(e) => setForm({ ...form, total_cost_usd: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Tipo de cambio</label>
            <Input
              type="number"
              step="0.0001"
              value={form.exchange_rate}
              onChange={(e) => setForm({ ...form, exchange_rate: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Fecha</label>
            <Input
              type="date"
              value={form.purchase_date}
              onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
            />
          </div>
          <div className="flex items-end lg:col-span-3">
            <Button onClick={save} className="w-full md:w-auto">
              Registrar ingreso
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Factura</TableHead>
                <TableHead className="text-right">Cant.</TableHead>
                <TableHead className="text-right">Costo unit.</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">TC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.purchase_date}</TableCell>
                  <TableCell className="font-medium">{p.products?.name}</TableCell>
                  <TableCell>{p.suppliers?.name ?? "—"}</TableCell>
                  <TableCell>{p.invoice_number ?? "—"}</TableCell>
                  <TableCell className="text-right">{p.quantity}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatUsd(Number(p.unit_cost_usd))}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatUsd(Number(p.total_cost_usd))}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {Number(p.exchange_rate).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Sin ingresos
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