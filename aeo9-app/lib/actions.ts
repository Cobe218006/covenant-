"use server";

import { hash } from "argon2";
import { z } from "zod";
import { db } from "./prisma";
import { auth, signIn } from "./auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

const signUpSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(10),
});

export async function signUpAction(formData: FormData) {
  const parsed = signUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    redirect("/signup?error=" + encodeURIComponent("Check your name, email, and password (10+ characters)."));
  }
  const { name, email, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    redirect("/signup?error=" + encodeURIComponent("An account already exists for this email."));
  }

  const passwordHash = await hash(password);
  await db.user.create({ data: { name, email, passwordHash } });

  await signIn("credentials", { email, password, redirectTo: "/dashboard" });
}

export async function toggleLessonAction(lessonId: string) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/signin");

  const existing = await db.lessonProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
  });

  if (existing) {
    await db.lessonProgress.delete({ where: { id: existing.id } });
  } else {
    await db.lessonProgress.create({ data: { userId, lessonId } });
  }

  revalidatePath("/dashboard");
  revalidatePath("/learn");
}
