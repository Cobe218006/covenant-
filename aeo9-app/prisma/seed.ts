import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

// Ported verbatim from the original single-file aeo9.html COURSES array.
const COURSES = [
  {
    slug: "seo-foundations",
    title: "SEO Foundations",
    school: 1,
    level: 1,
    theme: "SEO & Search",
    modules: [
      {
        title: "What SEO Actually Is",
        lessons: [
          {
            title: "Search engines as retrieval systems",
            content: `A search engine is a retrieval system. It crawls pages, indexes them, and ranks candidates by relevance signals. Nothing more mystical than that.

Your job as a professional is to make a page findable, parseable, and worth ranking. Every technique in this curriculum is downstream of that sentence.`,
          },
          {
            title: "Intent is the unit of work",
            content: `Keywords are not the unit of work. Intent is.

A keyword like "best CRM for agencies" encodes: comparative research, agency context, decision-stage buyer. The page that wins is the one that satisfies that intent — not the one that repeats the phrase most often.`,
          },
          {
            title: "Crawl, index, rank — the three gates",
            content: `Every SEO problem is one of three failures:

1. The crawler can't reach the page.
2. The indexer doesn't understand what the page is about.
3. The ranker doesn't consider it the best answer.

Diagnose in that order. Fixing rank before crawl is wasted work.`,
          },
        ],
      },
      {
        title: "Reading a SERP Like a Professional",
        lessons: [
          {
            title: "SERP features as intent signals",
            content: `Google doesn't just rank pages. It interprets intent and constructs a result page around it.

When you see AI Overviews, People Also Ask, local packs, or video carousels in a SERP, Google is telling you exactly what intent it thinks the query carries. Read it. That's the brief.`,
          },
          {
            title: "AI Overviews — what they change",
            content: `An AI Overview is a synthesized answer. It cites sources. It sits above the organic results.

For professionals, this changes two things: how often your page is cited (not just ranked), and what format wins (extractable, structured, evidence-backed answers).

This is where AEO begins.`,
          },
        ],
      },
    ],
  },
  {
    slug: "ai-search-foundations",
    title: "AI Search Foundations",
    school: 2,
    level: 1,
    theme: "AI Search",
    modules: [
      {
        title: "From Ranked Lists to Synthesized Answers",
        lessons: [
          {
            title: "What changed",
            content: `Traditional search returns ten ranked links. AI search returns one synthesized answer with citations.

The unit of competition shifts: it's no longer "can I be on page one," but "am I mentioned, and am I cited, in the answer the AI produces."`,
          },
          {
            title: "Mentions vs citations",
            content: `A mention is your brand named in the answer text.
A citation is a source URL surfaced by the AI as evidence for the answer.

They are different, and they require different work.

A mention without a citation means the AI knows your brand but is sourcing its answer elsewhere — different remediation than simply being absent.`,
          },
          {
            title: "Observation is the only evidence",
            content: `You cannot fabricate visibility. If you want to know whether a brand is cited by AI Overviews for a given prompt, you have to run the prompt, at a specific time, on a specific platform, and record what you saw.

Everything else is guessing dressed as expertise.`,
          },
        ],
      },
      {
        title: "AEO in Practice",
        lessons: [
          {
            title: "Extractable answers win",
            content: `AI systems retrieve passages, not pages. A page that buries the answer beneath three paragraphs of preamble loses to a page that opens with it.

Write so that any given paragraph could be lifted cleanly into an answer and still make sense.`,
          },
          {
            title: "Entities, not keywords",
            content: `AI search is entity-aware. It knows that "Apple" the company and "apple" the fruit are different, and it knows which one your query means.

To be found, you have to be a recognized entity with clear relationships to other entities — not just a page that mentions words.`,
          },
        ],
      },
    ],
  },
  {
    slug: "ai-seo-sales",
    title: "AI SEO Sales",
    school: 17,
    level: 1,
    theme: "AI SEO Sales",
    modules: [
      {
        title: "The Framework",
        lessons: [
          {
            title: "Research → Hypothesis → Permission → Discovery",
            content: `Every good sales conversation starts before the call.

Research the prospect using only public information. Form a specific hypothesis about what's likely true. Ask permission to share it. Use it to open discovery.

Skipping research produces generic calls. Skipping the hypothesis produces interrogations. Skipping permission produces resistance.`,
          },
          {
            title: "Evidence beats assertion",
            content: `"Your competitor outranks you in AI search" is an assertion. It sounds like expertise. It's also the kind of claim that ends a call when the buyer asks "how do you know?"

"In our observed test on [date] across [platform], your competitor appeared in 7 of 10 prompts. You appeared in 1. Here are the prompts and the raw answers" is evidence. It survives interrogation.

Only make the second kind of claim.`,
          },
          {
            title: "The Claim Firewall",
            content: `Before you make a claim about AI visibility, have four things ready:

1. The platform you observed.
2. The prompt you ran.
3. The date you ran it.
4. What you actually saw.

If you have all four, make the claim with confidence.
If you have fewer than four, reframe: "in our initial test" or "as an example" — or don't make it.`,
          },
        ],
      },
      {
        title: "Objections as Information",
        lessons: [
          {
            title: `"We already have SEO"`,
            content: `This objection is almost never about SEO. It's about risk.

The buyer is saying: "I don't want to fund something new that might fail. Help me understand how this connects to what we already do."

Good response: acknowledge, reframe as layer not replacement, propose a bounded next step.`,
          },
          {
            title: `"AI search doesn't matter"`,
            content: `Sometimes this is a real belief. Sometimes it's a test. Sometimes it's a delay tactic.

Do not argue. Ask which of their customer segments they believe are already using AI assistants. Let their answer guide the conversation.`,
          },
        ],
      },
    ],
  },
  {
    slug: "evidence-and-verification",
    title: "Evidence & Verification",
    school: 26,
    level: 2,
    theme: "Cryptographic Verification",
    modules: [
      {
        title: "Why Proof Matters",
        lessons: [
          {
            title: "Claim vs evidence",
            content: `A claim is a statement. Evidence is what makes it checkable.

In professional AI SEO work, most claims about results are unverifiable in real time. The professional response is not to make fewer claims — it's to attach evidence status to every claim you do make.

VERIFIED: independently checkable right now.
OBSERVED: you saw it, at a specific time, on a specific system.
INFERRED: derived from observed data, but not directly observed.
HYPOTHESIS: a working assumption you're testing.
UNKNOWN: you don't know.

Every professional statement should be reducible to one of these five.`,
          },
          {
            title: "What SHA-256 does",
            content: `SHA-256 is a hash function. Feed it any input, get a 64-character hex digest. Change one character of input, get a completely different digest.

This makes it useful for integrity: given the payload and the digest, anyone can verify the payload hasn't changed.

It does NOT:
- prove who issued the payload
- prove the payload is true
- prevent someone from generating a different valid digest

For that you need a digital signature (asymmetric keys) on top of the hash.`,
          },
          {
            title: "What a signature adds",
            content: `A digital signature uses a private key to sign a payload. Anyone with the public key can verify the signature without learning the private key.

This proves: this specific payload was signed by the holder of this specific private key.

A credential that only carries a SHA-256 digest is a checksum. A credential that carries a signature is a proof. Both are useful. They are not the same thing, and claiming the checksum is the proof is dishonest.`,
          },
        ],
      },
    ],
  },
  {
    slug: "ai-zmot",
    title: "AI-ZMOT Foundations",
    school: 6,
    level: 1,
    theme: "AI-ZMOT",
    modules: [
      {
        title: "The Six Stages",
        lessons: [
          {
            title: "Discovery",
            content: `At the discovery stage, the buyer doesn't yet know their problem has a name. They ask broad questions to AI assistants: "why do my competitors show up when I search?" or "how is AI changing search?"

If the AI doesn't mention your brand in answers to these questions, you don't exist at the top of the funnel.`,
          },
          {
            title: "Research",
            content: `The buyer now knows the category. They ask: "what is answer engine optimization" or "how does AEO differ from SEO?"

You need to be cited as a source on these questions — not just mentioned. This is where content depth and extractability matter most.`,
          },
          {
            title: "Comparison",
            content: `The buyer is evaluating named options. They ask: "AEO 9 vs [competitor]" or "best AEO training programs."

If you're not appearing next to your competitors in these answers, the buyer never sees you as an option.`,
          },
          {
            title: "Validation",
            content: `The buyer has a shortlist and is looking for reasons to be reassured. They ask: "is [brand] legit?" or "reviews of [brand]."

Third-party evidence, reviews, and citation-worthy references matter disproportionately here.`,
          },
          {
            title: "Shortlisting",
            content: `The buyer is comparing two or three finalists. They ask specific feature or fit questions.

At this stage, being mentioned is table stakes. Being cited as the answer to their specific question is what wins.`,
          },
          {
            title: "Action",
            content: `The buyer is ready to act. They ask "how do I sign up" or "where do I buy."

If your brand doesn't appear clearly in answers to action-stage prompts, buyers who were ready to convert can end up at a competitor because the AI pointed them there instead.`,
          },
        ],
      },
    ],
  },
];

async function main() {
  for (let ci = 0; ci < COURSES.length; ci++) {
    const c = COURSES[ci];
    const course = await db.course.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, title: c.title, school: c.school, level: c.level, theme: c.theme, order: ci },
      update: { title: c.title, school: c.school, level: c.level, theme: c.theme, order: ci },
    });

    for (let mi = 0; mi < c.modules.length; mi++) {
      const m = c.modules[mi];
      const existingModule = await db.module.findFirst({ where: { courseId: course.id, order: mi } });
      const mod = existingModule
        ? await db.module.update({ where: { id: existingModule.id }, data: { title: m.title } })
        : await db.module.create({ data: { courseId: course.id, title: m.title, order: mi } });

      for (let li = 0; li < m.lessons.length; li++) {
        const l = m.lessons[li];
        const existingLesson = await db.lesson.findFirst({ where: { moduleId: mod.id, order: li } });
        if (existingLesson) {
          await db.lesson.update({ where: { id: existingLesson.id }, data: { title: l.title, content: l.content } });
        } else {
          await db.lesson.create({ data: { moduleId: mod.id, title: l.title, content: l.content, order: li } });
        }
      }
    }
    console.log(`Seeded course: ${c.title}`);
  }
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
