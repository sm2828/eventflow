// prisma/seed.ts
// Run with: npx ts-node prisma/seed.ts  (or tsx prisma/seed.ts)
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EVENT_TYPES = [
  "user.signup",
  "user.login",
  "order.created",
  "order.shipped",
  "payment.processed",
  "payment.failed",
  "session.started",
  "session.ended",
];

const STATUSES = ["QUEUED", "PROCESSING", "SUCCESS", "SUCCESS", "SUCCESS", "FAILED", "DEAD_LETTERED"] as const;

function randomFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPayload(type: string): Record<string, unknown> {
  const base: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    traceId: Math.random().toString(36).slice(2),
  };

  switch (type) {
    case "user.signup":
    case "user.login":
      return { ...base, userId: `usr_${Math.random().toString(36).slice(2, 10)}`, email: "user@example.com", plan: "free" };
    case "order.created":
    case "order.shipped":
      return { ...base, orderId: `ord_${Math.random().toString(36).slice(2, 10)}`, amount: Math.round(Math.random() * 10000) / 100, currency: "USD", items: 3 };
    case "payment.processed":
    case "payment.failed":
      return { ...base, transactionId: `txn_${Math.random().toString(36).slice(2, 10)}`, amount: Math.round(Math.random() * 10000) / 100, status: type.includes("failed") ? "failed" : "success" };
    default:
      return { ...base, sessionId: `ses_${Math.random().toString(36).slice(2, 10)}` };
  }
}

async function main() {
  console.log("Seeding database...");

  // Upsert API keys
  await prisma.apiKey.upsert({
    where: { key: "dev_key_123" },
    update: {},
    create: { key: "dev_key_123", name: "Development Key", rateLimit: 1000 },
  });

  await prisma.apiKey.upsert({
    where: { key: "test_key_456" },
    update: {},
    create: { key: "test_key_456", name: "Test Key", rateLimit: 100 },
  });

  console.log("✓ API keys seeded");

  // Seed 50 sample events across various statuses
  const events = Array.from({ length: 50 }, (_, i) => {
    const type = randomFrom(EVENT_TYPES);
    const status = randomFrom(STATUSES);
    const createdAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000); // Last 7 days

    return {
      type,
      source: "seed",
      payload: randomPayload(type),
      status,
      attempts: status === "DEAD_LETTERED" ? 3 : status === "FAILED" ? Math.ceil(Math.random() * 2) : 1,
      processedAt: status === "SUCCESS" ? new Date(createdAt.getTime() + Math.random() * 5000) : null,
      errorMessage: status === "FAILED" || status === "DEAD_LETTERED"
        ? "Simulated processing error for seed data"
        : null,
      createdAt,
      updatedAt: createdAt,
    };
  });

  await prisma.event.createMany({ data: events });

  console.log(`✓ ${events.length} sample events seeded`);
  console.log("\nDone! Start the server and open the dashboard.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
