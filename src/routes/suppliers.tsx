import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/suppliers")({ component: Page });

type Supplier = { id: string; name: string; contact: string | null; notes: string | null };

function Page() {
  const [items, setItems] = useState<Supplier[]>([]);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ name: "", contact: "", notes: "" });

  const load = async () => {
    const { data } = await supabase.from("suppliers").select("*").order("name");
    setItems(data ?? []);
  };
  useEffect(() => {
    load();
  }, []);

  const reset = () => {
    setEditing(null);
    setForm({ name: "", contact: "", notes: "" });
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nombre requerido");
    if (editing) {
      const { error } = await supabase.from("suppliers").update(form).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Actualizado");
    } else {
      const { error } = await supabase.from("suppliers").insert(form);
      if (error) return toast.error(error.message);
      toast.success("Creado");
    }
    reset();
    load();
  };

  const edit = (s: Supplier) => {
    setEditing(s);
    setForm({ name: s.name, contact: s.contact ?? "", notes: s.notes ?? "" });
  };

  const del = async (id: string) => {
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Eliminado");
    load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Proveedores</h1>
      <Card>
        <CardHeader>
          <CardTitle>{editing ? "Editar proveedor" : "Nuevo proveedor"}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Input
            placeholder="Nombre"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            placeholder="Contacto (tel/email)"
            value={form.contact}
            onChange={(e) => setForm({ ...form, contact: e.target.value })}
          />
          <Textarea
            className="md:col-span-2"
            placeholder="Observaciones"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <div className="md:col-span-2 flex gap-2">
            <Button onClick={save}>{editing ? "Guardar" : "Agregar"}</Button>
            {editing && (
              <Button variant="outline" onClick={reset}>
                Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Observaciones</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.contact}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.notes}</TableCell>
                  <TableCell className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => edit(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => del(s.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Sin proveedores
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