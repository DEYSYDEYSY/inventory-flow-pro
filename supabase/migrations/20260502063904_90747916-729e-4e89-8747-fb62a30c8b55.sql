
-- CATEGORIES
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SUPPLIERS
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PRODUCTS
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  stock NUMERIC NOT NULL DEFAULT 0,
  min_stock NUMERIC NOT NULL DEFAULT 0,
  cost_unit_usd NUMERIC NOT NULL DEFAULT 0,
  profit_margin NUMERIC NOT NULL DEFAULT 0,
  sale_price_bs NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- EXCHANGE RATES
CREATE TABLE public.exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_date DATE NOT NULL UNIQUE,
  rate NUMERIC NOT NULL CHECK (rate > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PURCHASES (INGRESOS)
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  total_cost_usd NUMERIC NOT NULL CHECK (total_cost_usd >= 0),
  unit_cost_usd NUMERIC NOT NULL,
  invoice_number TEXT,
  exchange_rate NUMERIC NOT NULL,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SALES
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_bs NUMERIC NOT NULL DEFAULT 0,
  total_usd NUMERIC NOT NULL DEFAULT 0,
  exchange_rate NUMERIC NOT NULL,
  sale_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SALE ITEMS
CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit_price_bs NUMERIC NOT NULL,
  subtotal_bs NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX idx_purchases_product ON public.purchases(product_id);
CREATE INDEX idx_sales_date ON public.sales(sale_date);

-- TRIGGER: update product cost & stock on purchase
CREATE OR REPLACE FUNCTION public.handle_purchase_insert()
RETURNS TRIGGER AS $$
BEGIN
  NEW.unit_cost_usd := NEW.total_cost_usd / NEW.quantity;
  UPDATE public.products
    SET stock = stock + NEW.quantity,
        cost_unit_usd = NEW.unit_cost_usd,
        updated_at = now()
    WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_purchase_insert
BEFORE INSERT ON public.purchases
FOR EACH ROW EXECUTE FUNCTION public.handle_purchase_insert();

-- TRIGGER: decrement stock on sale_items insert, prevent negative
CREATE OR REPLACE FUNCTION public.handle_sale_item_insert()
RETURNS TRIGGER AS $$
DECLARE
  current_stock NUMERIC;
BEGIN
  SELECT stock INTO current_stock FROM public.products WHERE id = NEW.product_id FOR UPDATE;
  IF current_stock IS NULL THEN
    RAISE EXCEPTION 'Producto no encontrado';
  END IF;
  IF current_stock < NEW.quantity THEN
    RAISE EXCEPTION 'Stock insuficiente para el producto %', NEW.product_name;
  END IF;
  UPDATE public.products
    SET stock = stock - NEW.quantity,
        updated_at = now()
    WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_sale_item_insert
BEFORE INSERT ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.handle_sale_item_insert();

-- TRIGGER: prevent manual stock / cost edits on products
CREATE OR REPLACE FUNCTION public.protect_product_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow stock & cost_unit_usd changes only when triggered by purchase/sale (session var)
  IF current_setting('app.bypass_product_guard', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF NEW.stock IS DISTINCT FROM OLD.stock THEN
    RAISE EXCEPTION 'El stock no se puede editar manualmente. Use ingresos o ventas.';
  END IF;
  IF NEW.cost_unit_usd IS DISTINCT FROM OLD.cost_unit_usd THEN
    RAISE EXCEPTION 'El costo no se puede editar manualmente. Se actualiza desde ingresos.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_protect_product
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.protect_product_fields();

-- Adjust handle_purchase_insert and handle_sale_item_insert to bypass guard
CREATE OR REPLACE FUNCTION public.handle_purchase_insert()
RETURNS TRIGGER AS $$
BEGIN
  NEW.unit_cost_usd := NEW.total_cost_usd / NEW.quantity;
  PERFORM set_config('app.bypass_product_guard', 'on', true);
  UPDATE public.products
    SET stock = stock + NEW.quantity,
        cost_unit_usd = NEW.unit_cost_usd,
        updated_at = now()
    WHERE id = NEW.product_id;
  PERFORM set_config('app.bypass_product_guard', 'off', true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_sale_item_insert()
RETURNS TRIGGER AS $$
DECLARE
  current_stock NUMERIC;
BEGIN
  SELECT stock INTO current_stock FROM public.products WHERE id = NEW.product_id FOR UPDATE;
  IF current_stock IS NULL THEN
    RAISE EXCEPTION 'Producto no encontrado';
  END IF;
  IF current_stock < NEW.quantity THEN
    RAISE EXCEPTION 'Stock insuficiente para el producto %', NEW.product_name;
  END IF;
  PERFORM set_config('app.bypass_product_guard', 'on', true);
  UPDATE public.products
    SET stock = stock - NEW.quantity,
        updated_at = now()
    WHERE id = NEW.product_id;
  PERFORM set_config('app.bypass_product_guard', 'off', true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ENABLE RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- PUBLIC POLICIES (sistema interno sin auth)
CREATE POLICY "public_all_categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_suppliers" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_products" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_exchange_rates" ON public.exchange_rates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_purchases" ON public.purchases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_sales" ON public.sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_sale_items" ON public.sale_items FOR ALL USING (true) WITH CHECK (true);
