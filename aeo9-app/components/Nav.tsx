import Link from "next/link";
import { signOut } from "@/lib/auth";

export function Nav({ userEmail }: { userEmail: string }) {
  return (
    <aside className="w-56 shrink-0 border-r border-neutral-900 p-5 hidden md:flex flex-col gap-1">
      <div className="mb-5 px-1">
        <p className="text-[10px] tracking-[0.2em] uppercase text-neutral-500">Corporate Curators</p>
        <p className="text-xl font-light text-[#D4AF37] mt-1">AEO 9</p>
      </div>
      <Link href="/dashboard" className="rounded-md px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-900">
        Home
      </Link>
      <Link href="/learn" className="rounded-md px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-900">
        Learn
      </Link>
      <div className="flex-1" />
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button type="submit" className="w-full text-left rounded-md px-3 py-2 text-sm text-neutral-400 hover:bg-neutral-900">
          Sign out
        </button>
      </form>
      <p className="px-3 text-[11px] text-neutral-600 truncate">{userEmail}</p>
    </aside>
  );
}
