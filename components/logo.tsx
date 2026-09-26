import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
      <span aria-hidden className="grid h-7 w-7 place-items-center rounded bg-marque-700 text-sm font-bold text-white">
        A
      </span>
      Adjugé
    </Link>
  );
}
