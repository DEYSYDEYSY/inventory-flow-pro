export const formatBs = (n: number) =>
  new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    n || 0,
  ) + " Bs";

export const formatUsd = (n: number) =>
  "$" +
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    n || 0,
  );

export const todayISO = () => new Date().toISOString().slice(0, 10);