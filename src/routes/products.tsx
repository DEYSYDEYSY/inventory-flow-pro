import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Search, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatBs, formatUsd } from "@/lib/format";
import { getTodayRate } from "@/lib/queries";

export const Route = createFileRoute("/products")({ component: Page });

type Product = {
  id: string;
  name: string;
  category_id: string | null;
  stock: number;
  min_stock: number;
  cost_unit_usd: number;
  profit_margin: number;
  sale_price_bs: number;
  categories?: { name: string } | null;
};

type Category = { id: string; name: string };

function Page() {
  const [items, setItems] = useState<Product[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [rate, setRate] = useState<number>(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const emptyForm = {
    name: "",
    category_id: "",
    min_stock: "0",
    profit_margin: "30",
    sale_price_bs: "0",
  };
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const [pRes, cRes, r] = await Promise.all([
      supabase
        .from("products")
        .select("*, categories!products_category_fk(name)")
        .order("name"),
      supabase.from("categories").select("*").order("name"),
      getTodayRate(),
    ]);
    setItems((pRes.data ?? []) as Product[]);
    setCats((cRes.data ?? []) as Category[]);
    setRate(r ?? 0);
  };
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () => items.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())),
    [items, search],
  );

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      category_id: p.category_id ?? "",
      min_stock: String(p.min_stock),
      profit_margin: String(p.profit_margin),
      sale_price_bs: String(p.sale_price_bs),
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nombre requerido");
    const payload = {
      name: form.name.trim(),
      category_id: form.category_id || null,
      min_stock: Number(form.min_stock) || 0,
      profit_margin: Number(form.profit_margin) || 0,
      sale_price_bs: Number(form.sale_price_bs) || 0,
    };
    if (editing) {
      const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Producto actualizado");
    } else {
      const { error } = await supabase.from("products").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Producto creado");
    }
    setOpen(false);
    load();
  };

  const del = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Eliminado");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Productos</h1>
          <p className="text-sm text-muted-foreground">
            Tipo de cambio actual: <span className="font-mono">{rate.toFixed(2)} Bs/USD</span>
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo producto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar producto" : "Nuevo producto"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div>
                <label className="text-sm font-medium">Nombre</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Categoría</label>
                <Select
                  value={form.category_id}
                  onValueChange={(v) => setForm({ ...form, category_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {cats.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Stock mínimo</label>
                  <Input
                    type="number"
                    value={form.min_stock}
                    onChange={(e) => setForm({ ...form, min_stock: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Margen (%)</label>
                  <Input
                    type="number"
                    value={form.profit_margin}
                    onChange={(e) => setForm({ ...form, profit_margin: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Precio de venta (Bs)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.sale_price_bs}
                  onChange={(e) => setForm({ ...form, sale_price_bs: e.target.value })}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                El stock y costo se actualizan únicamente desde Ingresos y Ventas.
              </p>
              <Button onClick={save}>Guardar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar producto…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Costo USD</TableHead>
                <TableHead className="text-right">Margen</TableHead>
                <TableHead className="text-right">Sugerido</TableHead>
                <TableHead className="text-right">Venta</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const sugUsd = Number(p.cost_unit_usd) * (1 + Number(p.profit_margin) / 100);
                const sugBs = sugUsd * (rate || 0);
                const ventaBs = Number(p.sale_price_bs);
                const ventaUsd = rate ? ventaBs / rate : 0;
                const lowPrice = sugBs > 0 && ventaBs > 0 && sugBs > ventaBs;
                const lowStock = Number(p.stock) <= Number(p.min_stock);
                return (
                  <TableRow
                    key={p.id}
                    className={lowPrice ? "bg-destructive/10" : ""}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {p.name}
                        {lowPrice && (
                          <span
                            className="inline-flex items-center gap-1 text-xs text-destructive"
                            title="Precio por debajo del sugerido"
                          >
                            <AlertTriangle className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                      {lowPrice && (
                        <p className="text-xs text-destructive">Precio por debajo del sugerido</p>
                      )}
                    </TableCell>
                    <TableCell>{p.categories?.name ?? "—"}</TableCell>
                    <TableCell className={`text-right ${lowStock ? "text-destructive font-bold" : ""}`}>
                      {p.stock}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatUsd(Number(p.cost_unit_usd))}
                    </TableCell>
                    <TableCell className="text-right">{p.profit_margin}%</TableCell>
                    <TableCell className="text-right text-xs">
                      <div className="font-mono">{formatUsd(sugUsd)}</div>
                      <div className="font-mono text-muted-foreground">{formatBs(sugBs)}</div>
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      <div className="font-mono">{formatBs(ventaBs)}</div>
                      <div className="font-mono text-muted-foreground">{formatUsd(ventaUsd)}</div>
                    </TableCell>
                    <TableCell className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => del(p.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Sin productos
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