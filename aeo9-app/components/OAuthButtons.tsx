import { signIn } from "@/lib/auth";

const PROVIDERS = [
  { id: "google", label: "Google" },
  { id: "microsoft-entra-id", label: "Microsoft" },
  { id: "github", label: "GitHub" },
] as const;

export function OAuthButtons() {
  return (
    <div className="mt-5 flex gap-2">
      {PROVIDERS.map((p) => (
        <form
          key={p.id}
          className="flex-1"
          action={async () => {
            "use server";
            await signIn(p.id, { redirectTo: "/dashboard" });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-full border border-neutral-800 bg-neutral-950 py-2.5 text-sm hover:bg-neutral-900 transition"
          >
            {p.label}
          </button>
        </form>
      ))}
    </div>
  );
}
