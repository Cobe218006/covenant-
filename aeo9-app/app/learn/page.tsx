import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { Nav } from "@/components/Nav";

export default async function LearnPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId || !session?.user) redirect("/signin");

  const courses = await db.course.findMany({
    orderBy: { order: "asc" },
    include: { modules: { include: { lessons: { include: { progress: { where: { userId } } } } } } },
  });

  return (
    <div className="flex-1 flex">
      <Nav userEmail={session.user.email ?? ""} />
      <main className="flex-1 p-6 md:p-10">
        <h1 className="text-2xl font-light">Learn</h1>
        <p className="text-sm text-neutral-500 mt-1">Available courses.</p>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {courses.map((c) => {
            const lessons = c.modules.flatMap((m) => m.lessons);
            const done = lessons.filter((l) => l.progress.length > 0).length;
            const pct = lessons.length ? Math.round((done / lessons.length) * 100) : 0;
            return (
              <Link
                key={c.id}
                href={`/learn/${c.slug}`}
                className="rounded-lg border border-neutral-900 bg-neutral-950 p-4 hover:border-[#8a7028] transition"
              >
                <div className="flex justify-between items-start gap-3">
                  <h3 className="text-sm font-medium">{c.title}</h3>
                  <span className="text-[10px] rounded bg-neutral-900 border border-neutral-800 px-1.5 py-0.5 text-neutral-400">
                    L{c.level}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-1">{c.theme}</p>
                <div className="h-[3px] bg-neutral-900 rounded mt-3 overflow-hidden">
                  <div className="h-full bg-[#D4AF37]" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[11px] text-neutral-500 mt-1.5">
                  {done} / {lessons.length} · {pct}%
                </p>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
