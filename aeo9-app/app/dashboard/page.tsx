import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { Nav } from "@/components/Nav";

export default async function DashboardPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId || !session?.user) redirect("/signin");

  const [totalLessons, completedCount] = await Promise.all([
    db.lesson.count(),
    db.lessonProgress.count({ where: { userId } }),
  ]);
  const pct = totalLessons ? Math.round((completedCount / totalLessons) * 100) : 0;

  return (
    <div className="flex-1 flex">
      <Nav userEmail={session.user.email ?? ""} />
      <main className="flex-1 p-6 md:p-10">
        <h1 className="text-2xl font-light">Dashboard</h1>
        <p className="text-sm text-neutral-500 mt-1">Welcome back, {session.user.name ?? session.user.email}.</p>

        <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="rounded-lg border border-neutral-900 bg-neutral-950 p-4">
            <p className="text-[10px] tracking-widest uppercase text-neutral-500">Lessons completed</p>
            <p className="text-2xl font-light text-[#D4AF37] mt-1.5">
              {completedCount} <span className="text-sm text-neutral-500">/ {totalLessons}</span>
            </p>
            <p className="text-xs text-neutral-500 mt-0.5">{pct}% of curriculum</p>
          </div>
        </div>

        <div className="mt-9">
          <Link
            href="/learn"
            className="inline-block rounded-full border border-[#8a7028] bg-[#D4AF37]/10 text-[#D4AF37] px-5 py-2.5 text-sm hover:bg-[#D4AF37]/20 transition"
          >
            Browse catalog
          </Link>
        </div>
      </main>
    </div>
  );
}
