import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { signUpAction } from "@/lib/actions";
import { OAuthButtons } from "@/components/OAuthButtons";

export default async function SignUpPage({
  searchParams,
}: PageProps<"/signup">) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <p className="text-xs tracking-[0.2em] uppercase text-neutral-500">Corporate Curators</p>
          <h2 className="text-3xl font-light text-[#D4AF37] mt-1.5">AEO 9</h2>
        </div>
        <h3 className="text-lg mb-5">Create account</h3>

        <form action={signUpAction} className="space-y-4">
          <div>
            <label className="block text-[11px] tracking-widest uppercase text-neutral-500 mb-1.5">Full name</label>
            <input
              name="name"
              required
              className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm outline-none focus:border-[#8a7028]"
            />
          </div>
          <div>
            <label className="block text-[11px] tracking-widest uppercase text-neutral-500 mb-1.5">Email</label>
            <input
              name="email"
              type="email"
              required
              className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm outline-none focus:border-[#8a7028]"
            />
          </div>
          <div>
            <label className="block text-[11px] tracking-widest uppercase text-neutral-500 mb-1.5">
              Password (min 10 characters)
            </label>
            <input
              name="password"
              type="password"
              required
              minLength={10}
              className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm outline-none focus:border-[#8a7028]"
            />
          </div>
          {error && <p className="text-red-400 text-xs">{decodeURIComponent(error)}</p>}
          <button
            type="submit"
            className="w-full rounded-full border border-[#8a7028] bg-[#D4AF37]/10 text-[#D4AF37] py-3 text-sm font-medium hover:bg-[#D4AF37]/20 transition"
          >
            Create account
          </button>
        </form>

        <OAuthButtons />

        <p className="text-center text-sm text-neutral-500 mt-6">
          Have an account?{" "}
          <Link href="/signin" className="text-[#D4AF37] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
