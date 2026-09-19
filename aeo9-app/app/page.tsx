import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center">
        <p className="text-xs tracking-[0.2em] uppercase text-neutral-500">Corporate Curators</p>
        <h1 className="text-5xl font-light text-[#D4AF37] mt-3 tracking-wide">AEO 9</h1>
        <p className="text-xs tracking-[0.2em] uppercase text-neutral-500 mt-2">AI SEO Academy</p>
        <p className="text-sm text-neutral-400 mt-9 leading-relaxed">
          Train to diagnose AI search visibility, run AI-ZMOT audits, sell consultatively, and earn
          verifiable credentials.
        </p>
        <p className="text-[#D4AF37] mt-6 text-xs tracking-[0.15em] uppercase">Proof Before Pitch</p>
        <div className="mt-11 flex flex-col gap-3">
          <Link
            href="/signup"
            className="rounded-full border border-[#8a7028] bg-[#D4AF37]/10 text-[#D4AF37] py-3.5 text-sm font-medium hover:bg-[#D4AF37]/20 transition"
          >
            Create account
          </Link>
          <Link
            href="/signin"
            className="rounded-full border border-neutral-800 bg-neutral-950 py-3.5 text-sm hover:bg-neutral-900 transition"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
