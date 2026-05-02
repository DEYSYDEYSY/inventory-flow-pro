import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

type Product = { id: string; name: string; [key: string]: unknown };

type Props = {
  products: Product[];
  onSelect: (product: Product) => void;
  placeholder?: string;
  renderExtra?: (product: Product) => React.ReactNode;
  keepValue?: boolean;
};

export function ProductSearch({ products, onSelect, placeholder = "Buscar producto...", renderExtra, keepValue }: Props) {
  const [search, setSearch] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [showDropdown, setShowDropdown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return term ? products.filter((p) => p.name.toLowerCase().includes(term)) : products;
  }, [products, search]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const select = (p: Product) => {
    onSelect(p);
    setSearch(keepValue ? p.name : "");
    setShowDropdown(false);
    setHighlightIndex(-1);
  };

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={placeholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setShowDropdown(true);
            setHighlightIndex(-1);
          }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={(e) => {
            if (!showDropdown || filtered.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlightIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && highlightIndex >= 0) {
              e.preventDefault();
              select(filtered[highlightIndex]);
            } else if (e.key === "Escape") {
              setShowDropdown(false);
            }
          }}
        />
      </div>
      {showDropdown && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-56 overflow-y-auto">
          {filtered.map((p, i) => (
            <button
              key={p.id}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors ${
                i === highlightIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent hover:text-accent-foreground"
              }`}
              onMouseEnter={() => setHighlightIndex(i)}
              onMouseLeave={() => setHighlightIndex(-1)}
              onClick={() => select(p)}
            >
              <span className="font-medium">{p.name}</span>
              {renderExtra && <span className="text-xs text-muted-foreground">{renderExtra(p)}</span>}
            </button>
          ))}
        </div>
      )}
      {showDropdown && search.trim() && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md p-3 text-sm text-muted-foreground">
          Sin resultados
        </div>
      )}
    </div>
  );
}
