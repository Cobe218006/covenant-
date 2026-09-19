import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { Nav } from "@/components/Nav";

export default async function CoursePage({ params }: PageProps<"/learn/[slug]">) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId || !session?.user) redirect("/signin");

  const { slug } = await params;
  const course = await db.course.findUnique({
    where: { slug },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: { lessons: { orderBy: { order: "asc" }, include: { progress: { where: { userId } } } } },
      },
    },
  });
  if (!course) notFound();

  return (
    <div className="flex-1 flex">
      <Nav userEmail={session.user.email ?? ""} />
      <main className="flex-1 p-6 md:p-10">
        <Link href="/learn" className="text-xs text-neutral-500 hover:text-neutral-300">
          ← All courses
        </Link>
        <h1 className="text-2xl font-light mt-4">{course.title}</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Theme: <span className="text-[#D4AF37]">{course.theme}</span>
        </p>

        <div className="mt-8 space-y-6">
          {course.modules.map((m, mi) => (
            <div key={m.id}>
              <h3 className="text-sm font-medium border-b border-neutral-900 pb-2 mb-3">
                {mi + 1}. {m.title}
              </h3>
              <div className="flex flex-col gap-2">
                {m.lessons.map((l) => (
                  <Link
                    key={l.id}
                    href={`/learn/${course.slug}/${l.id}`}
                    className="flex items-center gap-3 rounded-md border border-neutral-900 bg-neutral-950 px-3.5 py-2.5 text-sm hover:border-[#8a7028] transition"
                  >
                    <span
                      className={`w-4 h-4 rounded-full border ${
                        l.progress.length > 0 ? "bg-[#D4AF37] border-[#D4AF37]" : "border-neutral-700"
                      }`}
                    />
                    <span className="flex-1">{l.title}</span>
                    <span className="text-neutral-600">→</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
