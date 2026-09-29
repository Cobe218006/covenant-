import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { Nav } from "@/components/Nav";
import { toggleLessonAction } from "@/lib/actions";

export default async function LessonPage({ params }: PageProps<"/learn/[slug]/[lessonId]">) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId || !session?.user) redirect("/signin");

  const { slug, lessonId } = await params;
  const course = await db.course.findUnique({
    where: { slug },
    include: { modules: { orderBy: { order: "asc" }, include: { lessons: { orderBy: { order: "asc" } } } } },
  });
  if (!course) notFound();

  const flat = course.modules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleTitle: m.title })));
  const idx = flat.findIndex((l) => l.id === lessonId);
  if (idx < 0) notFound();
  const lesson = flat[idx];
  const prev = idx > 0 ? flat[idx - 1] : null;
  const next = idx < flat.length - 1 ? flat[idx + 1] : null;

  const done = !!(await db.lessonProgress.findUnique({ where: { userId_lessonId: { userId, lessonId } } }));

  return (
    <div className="flex-1 flex">
      <Nav userEmail={session.user.email ?? ""} />
      <main className="flex-1 p-6 md:p-10 max-w-2xl">
        <Link href={`/learn/${course.slug}`} className="text-xs text-neutral-500 hover:text-neutral-300">
          ← {course.title}
        </Link>
        <p className="text-[10px] tracking-widest uppercase text-neutral-500 mt-4">{lesson.moduleTitle}</p>
        <h1 className="text-2xl font-light mt-2">{lesson.title}</h1>

        <div className="mt-8 whitespace-pre-wrap leading-relaxed text-[15px] text-neutral-200">
          {lesson.content}
        </div>

        <div className="mt-11 pt-5 border-t border-neutral-900 flex flex-wrap items-center justify-between gap-3">
          <form action={toggleLessonAction.bind(null, lesson.id)}>
            <button
              type="submit"
              className={`rounded-full border px-4 py-2 text-sm transition ${
                done
                  ? "border-neutral-800 bg-neutral-950 hover:bg-neutral-900"
                  : "border-[#8a7028] bg-[#D4AF37]/10 text-[#D4AF37] hover:bg-[#D4AF37]/20"
              }`}
            >
              {done ? "✓ Completed — undo" : "Mark complete"}
            </button>
          </form>
          <div className="flex gap-2">
            {prev && (
              <Link href={`/learn/${course.slug}/${prev.id}`} className="rounded-full border border-neutral-800 px-4 py-2 text-sm hover:bg-neutral-900">
                ← Prev
              </Link>
            )}
            {next && (
              <Link href={`/learn/${course.slug}/${next.id}`} className="rounded-full border border-neutral-800 px-4 py-2 text-sm hover:bg-neutral-900">
                Next →
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
