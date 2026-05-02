-- Add foreign key relationships between tables and attach triggers

-- Clean orphan references first (safety)
UPDATE public.products SET category_id = NULL WHERE category_id IS NOT NULL AND category_id NOT IN (SELECT id FROM public.categories);
UPDATE public.purchases SET supplier_id = NULL WHERE supplier_id IS NOT NULL AND supplier_id NOT IN (SELECT id FROM public.suppliers);
DELETE FROM public.purchases WHERE product_id NOT IN (SELECT id FROM public.products);
DELETE FROM public.sale_items WHERE product_id NOT IN (SELECT id FROM public.products) OR sale_id NOT IN (SELECT id FROM public.sales);

-- Foreign keys
ALTER TABLE public.products
  ADD CONSTRAINT products_category_fk FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;

ALTER TABLE public.purchases
  ADD CONSTRAINT purchases_product_fk FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT,
  ADD CONSTRAINT purchases_supplier_fk FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;

ALTER TABLE public.sale_items
  ADD CONSTRAINT sale_items_sale_fk FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE,
  ADD CONSTRAINT sale_items_product_fk FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;

-- Unique constraint on exchange_rates per day
ALTER TABLE public.exchange_rates ADD CONSTRAINT exchange_rates_date_unique UNIQUE (rate_date);

-- Re-create triggers (they were missing - functions exist but no triggers attached)
DROP TRIGGER IF EXISTS trg_purchase_insert ON public.purchases;
CREATE TRIGGER trg_purchase_insert
  BEFORE INSERT ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.handle_purchase_insert();

DROP TRIGGER IF EXISTS trg_sale_item_insert ON public.sale_items;
CREATE TRIGGER trg_sale_item_insert
  BEFORE INSERT ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_sale_item_insert();

DROP TRIGGER IF EXISTS trg_protect_product_fields ON public.products;
CREATE TRIGGER trg_protect_product_fields
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.protect_product_fields();