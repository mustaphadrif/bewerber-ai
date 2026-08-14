/**
 * Controlled delivery tests for the Email Sender worker.
 *
 * - The Gmail HTTP call / server function is MOCKED (mailer seam) — nothing is
 *   ever sent over the network and no real Gmail account is touched.
 * - The only recipient address used is the fictional max@example.com.
 * - Imports the worker-core and MIME builder compiled to /tmp/es-test-build
 *   (see verification step: npx tsc ... --outDir /tmp/es-test-build).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { buildMimeMessage } from "/tmp/es-test-build/mime.js";
import {
  DeliveryError,
  runDeliveryPass,
} from "/tmp/es-test-build/worker-core.js";

const DAY = "2026-08-14";

/* ── Test doubles ───────────────────────────────────────────────────────── */

function makeCampaign(overrides = {}) {
  return {
    id: "campaign-1",
    user_id: "user-1",
    title: "Testkampagne",
    subject: "Testbetreff",
    body_html: "<p>Hallo</p>",
    body_text: "Hallo",
    status: "pending",
    queue_state: "queued",
    from_email: "me@example.com",
    attachments: [],
    ...overrides,
  };
}

function makeRecipient(overrides = {}) {
  return {
    id: "recipient-1",
    campaign_id: "campaign-1",
    email: "max@example.com",
    status: "pending",
    failure_reason: null,
    rate_limited: false,
    attempts: 0,
    next_attempt_at: null,
    created_at: "2026-08-14T08:00:00.000Z",
    ...overrides,
  };
}

function makeStorage(initial = {}) {
  const state = {
    campaigns: [makeCampaign()],
    recipients: [makeRecipient()],
    attachments: [],
    dailySent: 0,
    dailyLimit: 100,
    pausedCampaigns: new Set(),
    sentCalls: [],
    failedCalls: [],
    retriedCalls: [],
    blockedCalls: [],
    finishedCampaigns: [],
    events: [],
    // Daily-slot reservation bookkeeping (in-memory mirror of migration 006).
    // reserve/commit/release bodies are synchronous → atomic per call, so two
    // concurrent passes can never oversubscribe the limit.
    activeReservations: new Set(),
    reservationCounter: 0,
    releaseCalls: [],
    failRecordSent: false,
    ...initial,
  };
  return {
    state,
    async listQueuedCampaigns() {
      return state.campaigns.filter((c) => !state.pausedCampaigns.has(c.id));
    },
    async resetStaleSending() {
      return 0;
    },
    async claimNextRecipient(campaignId, now) {
      const candidates = state.recipients
        .filter(
          (r) =>
            r.campaign_id === campaignId &&
            r.status === "pending" &&
            (!r.next_attempt_at || new Date(r.next_attempt_at) <= now)
        )
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      const row = candidates[0];
      if (!row) return null;
      row.status = "sending";
      row.attempts += 1;
      return { ...row };
    },
    async loadAttachments() {
      return state.attachments;
    },
    async getDailySentCount() {
      return state.dailySent;
    },
    async getDailyLimit() {
      return state.dailyLimit;
    },
    // Atomic slot reservation: synchronous body → no interleaving between
    // check and increment, even across two concurrent passes.
    async reserveDailySlot(dayKey, limit) {
      const used = state.dailySent + state.activeReservations.size;
      if (used >= limit) return null;
      state.reservationCounter += 1;
      const id = `res-${state.reservationCounter}`;
      state.activeReservations.add(id);
      return id;
    },
    async commitDailyReservation(reservationId) {
      // sent_count grows only on confirmed successful sends.
      state.dailySent += 1;
      state.activeReservations.delete(reservationId);
    },
    async releaseDailyReservation(reservationId) {
      state.releaseCalls.push(reservationId);
      state.activeReservations.delete(reservationId);
    },
    async campaignPausedOrStopped(campaignId) {
      return state.pausedCampaigns.has(campaignId);
    },
    async countPending(campaignId) {
      return state.recipients.filter((r) => r.campaign_id === campaignId && ["pending", "sending"].includes(r.status))
        .length;
    },
    async recordSent(recipient, messageId, threadId, sentAt) {
      if (state.failRecordSent) throw new Error("Datenbank-Ausfall (Mock).");
      const row = state.recipients.find((r) => r.id === recipient.id);
      row.status = "sent";
      row.sent_at = sentAt;
      row.gmail_message_id = messageId;
      row.gmail_thread_id = threadId;
      state.sentCalls.push({ recipientId: recipient.id, messageId, threadId });
    },
    async recordRetry(recipient, nextAttemptAt, attempts, reason) {
      const row = state.recipients.find((r) => r.id === recipient.id);
      row.status = "pending";
      row.next_attempt_at = nextAttemptAt.toISOString();
      row.failure_reason = reason;
      row.rate_limited = true;
      state.retriedCalls.push({ recipientId: recipient.id, attempts, nextAttemptAt: nextAttemptAt.toISOString() });
    },
    async recordFailed(recipient, reason, temporary) {
      const row = state.recipients.find((r) => r.id === recipient.id);
      row.status = "failed";
      row.failure_reason = reason;
      row.rate_limited = temporary;
      state.failedCalls.push({ recipientId: recipient.id, reason });
    },
    async recordDailyLimitBlocked(recipient, reason) {
      const row = state.recipients.find((r) => r.id === recipient.id);
      row.status = "failed";
      row.failure_reason = reason;
      state.blockedCalls.push({ recipientId: recipient.id, reason });
      state.pausedCampaigns.add(recipient.campaign_id);
    },
    async incrementDailyCounter() {
      state.dailySent += 1;
    },
    async updateCampaignProgress() {},
    async finishCampaign(campaignId, status) {
      state.finishedCampaigns.push({ campaignId, status });
      const campaign = state.campaigns.find((c) => c.id === campaignId);
      if (campaign) campaign.status = status;
    },
    async pauseCampaign(campaignId) {
      state.pausedCampaigns.add(campaignId);
    },
    async logEvent(campaignId, recipientId, eventType, message) {
      state.events.push({ campaignId, recipientId, eventType, message });
    },
  };
}

function makeMailer({ ok = true, error } = {}) {
  const calls = [];
  return {
    calls,
    async send(target) {
      calls.push({ to: target.to, from: target.from, subject: target.subject });
      if (!ok) {
        throw error ?? new DeliveryError("Permanenter Fehler (Mock).", { temporary: false });
      }
      return { id: `mock-msg-${calls.length}`, threadId: `mock-thread-${calls.length}` };
    },
  };
}

function makeDeps(storage, mailer, clock) {
  return {
    storage,
    mailer,
    now: () => clock.now,
    dayKey: () => DAY,
    // No-op sleep: controlled tests must stay fast (real pacing defaults to
    // 2000 ms and is asserted explicitly in the pacing test below).
    sleep: async () => {},
  };
}

/* ── MIME builder ───────────────────────────────────────────────────────── */

test("buildMimeMessage produces a valid multipart/alternative with HTML body", () => {
  const message = buildMimeMessage({
    from: "me@example.com",
    to: "max@example.com",
    subject: "Einfacher Betreff",
    text: "Nur Text",
    html: "<p>HTML-Body</p>",
  });
  assert.match(message, /^From: me@example\.com/m);
  assert.match(message, /^To: max@example\.com/m);
  assert.match(message, /^Subject: Einfacher Betreff/m);
  assert.match(message, /^MIME-Version: 1\.0/m);
  assert.match(message, /multipart\/alternative/);
  assert.match(message, /Content-Type: text\/plain; charset=UTF-8/);
  assert.match(message, /Content-Type: text\/html; charset=UTF-8/);
  assert.ok(!message.includes("multipart/mixed"));
});

test("buildMimeMessage attaches base64 files under multipart/mixed with filename encoding", () => {
  const message = buildMimeMessage({
    from: "me@example.com",
    to: "max@example.com",
    subject: "Mit Anhang",
    text: "Text",
    html: "<p>HTML</p>",
    attachments: [
      { name: "lebenslauf.pdf", mimeType: "application/pdf", data: new Uint8Array([1, 2, 3, 4]) },
      { name: "bild.png", mimeType: "image/png", data: new Uint8Array([5, 6, 7]) },
    ],
  });
  assert.match(message, /multipart\/mixed/);
  assert.match(message, /Content-Type: application\/pdf; name=/);
  assert.match(message, /Content-Disposition: attachment; filename=/);
  assert.match(message, /Content-Transfer-Encoding: base64/);
  assert.match(message, /AQIDBA==/); // base64 of [1,2,3,4]
  assert.match(message, /BQYH/); // base64 of [5,6,7]
  // Boundaries must be unique and closed correctly.
  const mixed = message.match(/boundary="(----=_Part_[^"]+)"/);
  assert.ok(mixed, "outer boundary present");
  assert.ok(message.includes(`--${mixed[1]}--`), "outer boundary closed");
});

test("buildMimeMessage encodes non-ASCII subjects as RFC 2047 words", () => {
  const message = buildMimeMessage({
    from: "me@example.com",
    to: "max@example.com",
    subject: "Bewerbung für Möller GmbH",
    text: "Text",
    html: "<p>HTML</p>",
  });
  assert.match(message, /^Subject: =\?UTF-8\?B\?/m);
});

/* ── Worker: happy path ─────────────────────────────────────────────────── */

test("worker delivers one recipient: pending → sending → sent with message/thread ids", async () => {
  const storage = makeStorage();
  const mailer = makeMailer();
  const clock = { now: new Date("2026-08-14T09:00:00.000Z") };
  const result = await runDeliveryPass(makeDeps(storage, mailer, clock));

  assert.equal(result.sent, 1);
  assert.equal(result.retried, 0);
  assert.equal(result.failed, 0);
  assert.equal(result.remaining, 0);
  assert.equal(mailer.calls.length, 1);
  assert.equal(mailer.calls[0].to, "max@example.com");
  assert.equal(storage.state.recipients[0].status, "sent");
  assert.equal(storage.state.recipients[0].gmail_message_id, "mock-msg-1");
  assert.equal(storage.state.recipients[0].gmail_thread_id, "mock-thread-1");
  assert.equal(storage.state.dailySent, 1);
  assert.equal(storage.state.finishedCampaigns.length, 1);
  assert.equal(storage.state.events[0].eventType, "recipient_sent");
});

/* ── Worker: daily limit ────────────────────────────────────────────────── */

test("worker enforces the calendar-day limit immediately before each send", async () => {
  const storage = makeStorage({ dailySent: 100, dailyLimit: 100 });
  const mailer = makeMailer();
  const clock = { now: new Date("2026-08-14T09:00:00.000Z") };
  const result = await runDeliveryPass(makeDeps(storage, mailer, clock));

  assert.equal(mailer.calls.length, 0, "no send may happen at/above the limit");
  assert.equal(result.sent, 0);
  assert.equal(result.dailyLimitBlocked, 1);
  assert.equal(result.dailyLimit, 100);
  assert.equal(result.dailySent, 100);
  assert.equal(storage.state.recipients[0].status, "failed");
  assert.ok(storage.state.recipients[0].failure_reason.includes("Tageslimit"));
  assert.ok(storage.state.pausedCampaigns.has("campaign-1"), "campaign paused on limit");
});

/* ── Worker: temporary errors → exponential backoff → retry ─────────────── */

test("worker retries temporary errors with exponential backoff", async () => {
  const storage = makeStorage();
  const mailer = makeMailer({
    ok: false,
    error: new DeliveryError("Temporär (Mock).", { temporary: true }),
  });
  const clock = { now: new Date("2026-08-14T09:00:00.000Z") };
  const result = await runDeliveryPass(makeDeps(storage, mailer, clock));

  assert.equal(result.sent, 0);
  assert.equal(result.retried, 1);
  const row = storage.state.recipients[0];
  assert.equal(row.status, "pending", "temporary failure keeps the recipient pending");
  assert.equal(row.attempts, 1);
  assert.ok(row.next_attempt_at, "next attempt is scheduled");
  assert.ok(new Date(row.next_attempt_at) > clock.now, "backoff points to the future");
  assert.ok(storage.state.finishedCampaigns.length === 0, "campaign not finished while retry pending");

  // Advance the clock past the backoff and let the retry succeed.
  clock.now = new Date(new Date(row.next_attempt_at).getTime() + 1000);
  const storage2 = storage; // same state — now the mailer is switched
  const mailerOk = makeMailer();
  const result2 = await runDeliveryPass({
    storage: storage2,
    mailer: mailerOk,
    now: () => clock.now,
    dayKey: () => DAY,
    sleep: async () => {},
  });
  assert.equal(result2.sent, 1);
  assert.equal(storage2.state.recipients[0].status, "sent");
  assert.equal(storage2.state.recipients[0].gmail_message_id, "mock-msg-1");
});

/* ── Worker: permanent errors → failed ──────────────────────────────────── */

test("worker marks permanent errors as failed immediately", async () => {
  const storage = makeStorage();
  const mailer = makeMailer({
    ok: false,
    error: new DeliveryError("Ungültige Adresse (Mock).", { temporary: false }),
  });
  const clock = { now: new Date("2026-08-14T09:00:00.000Z") };
  const result = await runDeliveryPass(makeDeps(storage, mailer, clock));

  assert.equal(result.failed, 1);
  assert.equal(result.retried, 0);
  assert.equal(storage.state.recipients[0].status, "failed");
  assert.equal(storage.state.recipients[0].failure_reason, "Ungültige Adresse (Mock).");
  assert.equal(storage.state.recipients[0].rate_limited, false);
});

/* ── Worker: pause prevents new sends ───────────────────────────────────── */

test("worker sends nothing when the campaign is paused or stopped", async () => {
  const storage = makeStorage({ pausedCampaigns: new Set(["campaign-1"]) });
  const mailer = makeMailer();
  const clock = { now: new Date("2026-08-14T09:00:00.000Z") };
  const result = await runDeliveryPass(makeDeps(storage, mailer, clock));

  assert.equal(mailer.calls.length, 0);
  assert.equal(result.sent, 0);
  assert.equal(storage.state.recipients[0].status, "pending");
});

/* ── Worker: max attempts exhausted → failed ────────────────────────────── */

test("worker fails the recipient after max attempts with temporary errors", async () => {
  const storage = makeStorage();
  const mailer = makeMailer({
    ok: false,
    error: new DeliveryError("Temporär (Mock).", { temporary: true }),
  });
  const clock = { now: new Date("2026-08-14T09:00:00.000Z") };

  // Pass 1 → attempts=1 < maxAttempts=2 → retry scheduled.
  let result = await runDeliveryPass({ ...makeDeps(storage, mailer, clock), maxAttempts: 2 });
  assert.equal(result.retried, 1);
  assert.equal(storage.state.recipients[0].status, "pending");

  // Pass 2 (clock advanced) → attempts=2, not < maxAttempts → failed.
  clock.now = new Date(new Date(storage.state.recipients[0].next_attempt_at).getTime() + 1000);
  result = await runDeliveryPass({ ...makeDeps(storage, mailer, clock), maxAttempts: 2 });
  assert.equal(result.retried, 0);
  assert.equal(result.failed, 1);
  assert.equal(storage.state.recipients[0].status, "failed");
  assert.equal(storage.state.recipients[0].attempts, 2);
});

/* ── Worker: normal pacing between successful sends ─────────────────────── */

test("worker paces ~2000ms between successful sends (no sleep after the last)", async () => {
  const recipients = [
    makeRecipient({ id: "recipient-1", created_at: "2026-08-14T08:00:00.000Z" }),
    makeRecipient({ id: "recipient-2", created_at: "2026-08-14T08:00:01.000Z" }),
    makeRecipient({ id: "recipient-3", created_at: "2026-08-14T08:00:02.000Z" }),
  ];
  const storage = makeStorage({ recipients });
  const mailer = makeMailer();
  const clock = { now: new Date("2026-08-14T09:00:00.000Z") };
  const sleepCalls = [];
  const result = await runDeliveryPass({
    storage,
    mailer,
    now: () => clock.now,
    dayKey: () => DAY,
    // Spy sleep: records the requested delay instead of actually waiting.
    sleep: async (ms) => {
      sleepCalls.push(ms);
    },
  });

  assert.equal(result.sent, 3);
  assert.equal(mailer.calls.length, 3);
  // 3 successful sends → 2 pacing pauses, each the default 2000 ms, placed
  // between sends (never after the last send).
  assert.equal(sleepCalls.length, 2, "one pause between each pair of sends");
  for (const ms of sleepCalls) {
    assert.equal(ms, 2000, "default pacing is 2000 ms");
  }
});

test("worker does not pace after failed or retried sends", async () => {
  const recipients = [
    makeRecipient({ id: "recipient-1", created_at: "2026-08-14T08:00:00.000Z" }),
    makeRecipient({ id: "recipient-2", created_at: "2026-08-14T08:00:01.000Z" }),
  ];
  const storage = makeStorage({ recipients });
  // First recipient fails permanently, second succeeds.
  const mailer = {
    calls: [],
    async send(target) {
      this.calls.push(target.to);
      if (this.calls.length === 1) {
        throw new DeliveryError("Permanenter Fehler (Mock).", { temporary: false });
      }
      return { id: "mock-msg-1", threadId: "mock-thread-1" };
    },
  };
  const clock = { now: new Date("2026-08-14T09:00:00.000Z") };
  const sleepCalls = [];
  const result = await runDeliveryPass({
    storage,
    mailer,
    now: () => clock.now,
    dayKey: () => DAY,
    sleep: async (ms) => {
      sleepCalls.push(ms);
    },
  });

  assert.equal(result.sent, 1);
  assert.equal(result.failed, 1);
  // Only one successful send → no pacing pause at all.
  assert.equal(sleepCalls.length, 0);
});

/* ── Worker: reservation release on failures ────────────────────────────── */

test("worker releases the reserved slot on a temporary failure (retry path)", async () => {
  const storage = makeStorage();
  const mailer = makeMailer({
    ok: false,
    error: new DeliveryError("Temporär (Mock).", { temporary: true }),
  });
  const clock = { now: new Date("2026-08-14T09:00:00.000Z") };
  const result = await runDeliveryPass(makeDeps(storage, mailer, clock));

  assert.equal(result.retried, 1);
  assert.equal(result.sent, 0);
  assert.equal(storage.state.activeReservations.size, 0, "slot released before retry");
  assert.equal(storage.state.releaseCalls.length, 1);
  assert.equal(storage.state.dailySent, 0, "no successful send counted");
});

test("worker releases the reserved slot on a permanent failure", async () => {
  const storage = makeStorage();
  const mailer = makeMailer({
    ok: false,
    error: new DeliveryError("Permanent (Mock).", { temporary: false }),
  });
  const clock = { now: new Date("2026-08-14T09:00:00.000Z") };
  const result = await runDeliveryPass(makeDeps(storage, mailer, clock));

  assert.equal(result.failed, 1);
  assert.equal(storage.state.activeReservations.size, 0, "slot released before fail");
  assert.equal(storage.state.releaseCalls.length, 1);
  assert.equal(storage.state.dailySent, 0);
});

/* ── Worker: ambiguous post-provider bookkeeping failure ────────────────── */

test("worker fails safely when post-send bookkeeping errors (no blind retry, not falsely sent)", async () => {
  const storage = makeStorage({ failRecordSent: true });
  const mailer = makeMailer(); // provider send succeeds
  const clock = { now: new Date("2026-08-14T09:00:00.000Z") };
  const result = await runDeliveryPass(makeDeps(storage, mailer, clock));

  assert.equal(mailer.calls.length, 1, "provider confirmed one send");
  assert.equal(result.sent, 0, "not falsely counted as sent");
  assert.equal(result.retried, 0, "no blind retry of the same recipient");
  assert.equal(result.failed, 1);
  const row = storage.state.recipients[0];
  assert.equal(row.status, "failed");
  assert.match(row.failure_reason, /Status konnte nicht gespeichert werden/);
  assert.equal(row.gmail_message_id, undefined, "no sent ids recorded");
  assert.equal(storage.state.activeReservations.size, 0, "slot released");
  assert.equal(storage.state.dailySent, 0, "daily counter untouched");
});

/* ── Worker: concurrent passes cannot oversubscribe the daily limit ─────── */

function runTwoConcurrentPasses(storage, budget) {
  const mailer = makeMailer();
  const clock = { now: new Date("2026-08-14T09:00:00.000Z") };
  const deps = { ...makeDeps(storage, mailer, clock), budget };
  return Promise.all([runDeliveryPass(deps), runDeliveryPass(deps)]).then((results) => ({
    results,
    mailer,
  }));
}

test("two concurrent passes cannot send over a daily limit of 1", async () => {
  const storage = makeStorage({
    dailyLimit: 1,
    recipients: [
      makeRecipient({ id: "recipient-1", created_at: "2026-08-14T08:00:00.000Z" }),
      makeRecipient({ id: "recipient-2", created_at: "2026-08-14T08:00:01.000Z" }),
    ],
  });
  const { results, mailer } = await runTwoConcurrentPasses(storage, 10);

  const totalSent = results.reduce((sum, r) => sum + r.sent, 0);
  const totalBlocked = results.reduce((sum, r) => sum + r.dailyLimitBlocked, 0);
  assert.equal(totalSent, 1, "exactly one send despite two racing passes");
  assert.equal(totalBlocked, 1);
  assert.equal(mailer.calls.length, 1, "provider called at most once");
  assert.ok(totalSent <= 1, "never over the limit of 1");
});

test("two concurrent passes cannot send over a daily limit of 100", async () => {
  const recipients = Array.from({ length: 120 }, (_, i) =>
    makeRecipient({ id: `recipient-${i + 1}`, created_at: `2026-08-14T08:00:${String(i).padStart(2, "0")}.000Z` })
  );
  const storage = makeStorage({ dailyLimit: 100, recipients });
  const { results, mailer } = await runTwoConcurrentPasses(storage, 200);

  const totalSent = results.reduce((sum, r) => sum + r.sent, 0);
  const totalBlocked = results.reduce((sum, r) => sum + r.dailyLimitBlocked, 0);
  const sentRows = storage.state.recipients.filter((r) => r.status === "sent").length;
  const failedRows = storage.state.recipients.filter((r) => r.status === "failed").length;

  assert.equal(totalSent, 100, "exactly the limit was sent across both passes");
  assert.ok(totalBlocked >= 1, "at least one racing pass observes the exhausted limit");
  assert.equal(mailer.calls.length, 100, "provider called at most 100 times");
  assert.equal(sentRows, 100);
  assert.ok(failedRows >= 1, "at least one recipient is marked blocked");
  assert.ok(totalSent <= 100, "never over the limit of 100");
});
