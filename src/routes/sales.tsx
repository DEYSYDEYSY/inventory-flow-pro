import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
} from "@/components/ui/dialog";
import { Plus, Trash2, Eye, Search } from "lucide-react";
import { toast } from "sonner";
import { formatBs, formatUsd, todayISO } from "@/lib/format";
import { getTodayRate } from "@/lib/queries";

export const Route = createFileRoute("/sales")({ component: Page });

type Product = {
  id: string;
  name: string;
  stock: number;
  sale_price_bs: number;
};

type CartLine = {
  product_id: string;
  name: string;
  unit_price_bs: number;
  quantity: number;
  stock: number;
};

type Sale = {
  id: string;
  total_bs: number;
  total_usd: number;
  exchange_rate: number;
  sale_date: string;
};

type SaleItem = {
  id: string;
  product_name: string;
  quantity: number;
  unit_price_bs: number;
  subtotal_bs: number;
};

function Page() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [rate, setRate] = useState(0);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItems, setDetailItems] = useState<SaleItem[]>([]);
  const [detailSale, setDetailSale] = useState<Sale | null>(null);

  const loadProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("id,name,stock,sale_price_bs")
      .order("name");
    setProducts((data ?? []) as Product[]);
  };

  const loadSales = async () => {
    let q = supabase.from("sales").select("*").order("sale_date", { ascending: false });
    if (from) q = q.gte("sale_date", `${from}T00:00:00.000Z`);
    if (to) q = q.lte("sale_date", `${to}T23:59:59.999Z`);
    const { data } = await q;
    setSales((data ?? []) as Sale[]);
  };

  useEffect(() => {
    (async () => {
      const r = await getTodayRate();
      setRate(r ?? 0);
      await loadProducts();
      await loadSales();
    })();
  }, []);

  useEffect(() => {
    loadSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const availableProducts = useMemo(
    () => products.filter((p) => !cart.find((c) => c.product_id === p.id)),
    [products, cart],
  );

  const filteredProducts = useMemo(() => {
    const term = search.toLowerCase().trim();
    return availableProducts.filter((p) =>
      term ? p.name.toLowerCase().includes(term) : true,
    );
  }, [availableProducts, search]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const addToCart = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    if (cart.find((c) => c.product_id === p.id)) {
      toast.error("Ya está en el carrito");
      return;
    }
    setCart([
      ...cart,
      {
        product_id: p.id,
        name: p.name,
        unit_price_bs: Number(p.sale_price_bs),
        quantity: 1,
        stock: Number(p.stock),
      },
    ]);
    setSearch("");
    setShowDropdown(false);
    setHighlightIndex(-1);
  };

  const updateQty = (id: string, qty: number) => {
    setCart((c) =>
      c.map((l) => (l.product_id === id ? { ...l, quantity: Math.max(0, qty) } : l)),
    );
  };

  const removeLine = (id: string) =>
    setCart((c) => c.filter((l) => l.product_id !== id));

  const totalBs = cart.reduce((s, l) => s + l.unit_price_bs * l.quantity, 0);
  const totalUsd = rate ? totalBs / rate : 0;

  const saveSale = async () => {
    if (cart.length === 0) return toast.error("Carrito vacío");
    if (!rate) return toast.error("Falta tipo de cambio del día");
    for (const l of cart) {
      if (l.quantity <= 0) return toast.error(`Cantidad inválida en ${l.name}`);
      if (l.quantity > l.stock) return toast.error(`Stock insuficiente: ${l.name}`);
    }
    const { data: sale, error } = await supabase
      .from("sales")
      .insert({ total_bs: totalBs, total_usd: totalUsd, exchange_rate: rate })
      .select()
      .single();
    if (error || !sale) return toast.error(error?.message ?? "Error");

    const items = cart.map((l) => ({
      sale_id: sale.id,
      product_id: l.product_id,
      product_name: l.name,
      quantity: l.quantity,
      unit_price_bs: l.unit_price_bs,
      subtotal_bs: l.unit_price_bs * l.quantity,
    }));
    const { error: e2 } = await supabase.from("sale_items").insert(items);
    if (e2) {
      await supabase.from("sales").delete().eq("id", sale.id);
      return toast.error(e2.message);
    }
    toast.success("Venta registrada");
    setCart([]);
    loadProducts();
    loadSales();
  };

  const openDetail = async (s: Sale) => {
    setDetailSale(s);
    const { data } = await supabase
      .from("sale_items")
      .select("*")
      .eq("sale_id", s.id);
    setDetailItems((data ?? []) as SaleItem[]);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold">Ventas</h1>
          <p className="text-sm text-muted-foreground">
            Tipo de cambio: <span className="font-mono">{rate.toFixed(2)} Bs/USD</span>
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nueva venta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative" ref={searchRef}>
              <label className="text-sm font-medium">Agregar producto</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Buscar producto..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setShowDropdown(true);
                    setHighlightIndex(-1);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  onKeyDown={(e) => {
                    if (!showDropdown || filteredProducts.length === 0) return;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setHighlightIndex((i) => Math.min(i + 1, filteredProducts.length - 1));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setHighlightIndex((i) => Math.max(i - 1, 0));
                    } else if (e.key === "Enter" && highlightIndex >= 0) {
                      e.preventDefault();
                      addToCart(filteredProducts[highlightIndex].id);
                    } else if (e.key === "Escape") {
                      setShowDropdown(false);
                    }
                  }}
                />
              </div>
              {showDropdown && filteredProducts.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-56 overflow-y-auto">
                  {filteredProducts.map((p, i) => (
                    <button
                      key={p.id}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors ${
                        i === highlightIndex
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent hover:text-accent-foreground"
                      }`}
                      onMouseEnter={() => setHighlightIndex(i)}
                      onMouseLeave={() => setHighlightIndex(-1)}
                      onClick={() => addToCart(p.id)}
                    >
                      <span className="font-medium">{p.name}</span>
                      <span className="text-xs text-muted-foreground">stock: {p.stock}</span>
                    </button>
                  ))}
                </div>
              )}
              {showDropdown && search.trim() && filteredProducts.length === 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md p-3 text-sm text-muted-foreground">
                  Sin resultados
                </div>
              )}
            </div>
            <Button
              onClick={() => {
                if (highlightIndex >= 0 && filteredProducts[highlightIndex]) {
                  addToCart(filteredProducts[highlightIndex].id);
                } else if (filteredProducts.length === 1) {
                  addToCart(filteredProducts[0].id);
                }
              }}
              disabled={filteredProducts.length === 0}
            >
              <Plus className="h-4 w-4 mr-1" />
              Agregar
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="w-32">Cantidad</TableHead>
                <TableHead className="text-right">Precio Bs</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cart.map((l) => (
                <TableRow key={l.product_id}>
                  <TableCell className="font-medium">
                    {l.name}
                    <div className="text-xs text-muted-foreground">stock: {l.stock}</div>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      max={l.stock}
                      value={l.quantity}
                      onChange={(e) => updateQty(l.product_id, Number(e.target.value))}
                    />
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatBs(l.unit_price_bs)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatBs(l.unit_price_bs * l.quantity)}
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => removeLine(l.product_id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {cart.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Carrito vacío
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between border-t pt-4">
            <div className="text-sm text-muted-foreground">
              Total: <span className="text-lg font-bold text-foreground">{formatBs(totalBs)}</span>{" "}
              <span className="text-foreground">/ {formatUsd(totalUsd)}</span>
            </div>
            <Button onClick={saveSale} disabled={cart.length === 0}>
              Registrar venta
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de ventas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4 flex-wrap">
            <div>
              <label className="text-xs text-muted-foreground">Desde</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Hasta</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setFrom("");
                  setTo("");
                }}
              >
                Limpiar
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Total Bs</TableHead>
                <TableHead className="text-right">Total USD</TableHead>
                <TableHead className="text-right">TC</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{new Date(s.sale_date).toLocaleString("es-VE")}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatBs(Number(s.total_bs))}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatUsd(Number(s.total_usd))}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {Number(s.exchange_rate).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => openDetail(s)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {sales.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Sin ventas
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Detalle de venta —{" "}
              {detailSale && new Date(detailSale.sale_date).toLocaleString("es-VE")}
            </DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Cant.</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detailItems.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>{i.product_name}</TableCell>
                  <TableCell className="text-right">{i.quantity}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatBs(Number(i.unit_price_bs))}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatBs(Number(i.subtotal_bs))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {detailSale && (
            <div className="flex justify-end gap-4 border-t pt-3 text-sm">
              <span className="font-mono">Total: {formatBs(Number(detailSale.total_bs))}</span>
              <span className="font-mono">{formatUsd(Number(detailSale.total_usd))}</span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}