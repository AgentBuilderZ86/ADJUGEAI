import Link from "next/link";
import { cn } from "@/lib/utils";

const variantes = {
  primaire: "bg-marque-700 text-white hover:bg-marque-800",
  secondaire: "border border-slate-300 bg-white text-encre hover:bg-slate-50",
  fantome: "text-encre hover:bg-slate-100",
};

type Props = { variante?: keyof typeof variantes; className?: string };

const base =
  "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marque-700 disabled:opacity-50";

export function Button({ variante = "primaire", className, ...p }: Props & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn(base, variantes[variante], className)} {...p} />;
}

export function LienBouton({ variante = "primaire", className, href, children }: Props & { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={cn(base, variantes[variante], className)}>
      {children}
    </Link>
  );
}
