import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/categories")({ component: Page });

type Category = { id: string; name: string };

function Page() {
  const [items, setItems] = useState<Category[]>([]);
  const [name, setName] = useState("");

  const load = async () => {
    const { data } = await supabase.from("categories").select("*").order("name");
    setItems(data ?? []);
  };
  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("categories").insert({ name: name.trim() });
    if (error) return toast.error(error.message);
    setName("");
    toast.success("Categoría creada");
    load();
  };

  const del = async (id: string) => {
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Eliminada");
    load();
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold">Categorías</h1>
      <Card>
        <CardHeader>
          <CardTitle>Nueva categoría</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            placeholder="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button onClick={add}>Agregar</Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <ul className="divide-y">
            {items.map((c) => (
              <li key={c.id} className="flex items-center justify-between p-3">
                <span>{c.name}</span>
                <Button size="icon" variant="ghost" onClick={() => del(c.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
            {items.length === 0 && (
              <li className="p-4 text-sm text-muted-foreground">Sin categorías</li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}