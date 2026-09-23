import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const timeRange = v.object({
  start: v.string(),
  end: v.string(),
});

const weeklyAvailabilityDay = v.object({
  weekday: v.number(),
  ranges: v.array(timeRange),
});

const dateException = v.object({
  date: v.string(),
  ranges: v.array(timeRange),
});

export default defineSchema({
  users: defineTable({
    clerkUserId: v.string(),
    tokenIdentifier: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    role: v.union(v.literal("member"), v.literal("admin")),
    locale: v.optional(v.string()),
    timezone: v.optional(v.string()),
    consentVersion: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_token_identifier", ["tokenIdentifier"])
    .index("by_clerk_user_id", ["clerkUserId"]),

  plannerTasks: defineTable({
    clerkUserId: v.string(),
    tokenIdentifier: v.string(),
    clientId: v.string(),
    title: v.string(),
    subtitle: v.string(),
    date: v.string(),
    time: v.string(),
    recurring: v.boolean(),
    completedDates: v.array(v.string()),
    deletedDates: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_token_identifier", ["tokenIdentifier"])
    .index("by_clerk_user_id", ["clerkUserId"])
    .index("by_clerk_user_client", ["clerkUserId", "clientId"]),

  bookingSettings: defineTable({
    key: v.string(),
    weeklyAvailability: v.array(weeklyAvailabilityDay),
    dateExceptions: v.array(dateException),
    updatedAt: v.number(),
    updatedBy: v.string(),
  }).index("by_key", ["key"]),

  bookings: defineTable({
    clerkUserId: v.string(),
    tokenIdentifier: v.string(),
    offerKey: v.string(),
    mode: v.string(),
    date: v.string(),
    time: v.string(),
    startAt: v.number(),
    endAt: v.number(),
    durationMinutes: v.number(),
    timezone: v.string(),
    priceCents: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("cancelled"),
      v.literal("expired"),
      v.literal("refunded"),
    ),
    paymentStatus: v.union(v.literal("unpaid"), v.literal("paid"), v.literal("refunded")),
    refundStatus: v.optional(v.union(v.literal("partial"), v.literal("refunded"))),
    refundedAmountCents: v.optional(v.number()),
    holdExpiresAt: v.optional(v.number()),
    stripeExpiresAt: v.optional(v.number()),
    idempotencyKey: v.string(),
    stripeCheckoutSessionId: v.optional(v.string()),
    stripePaymentIntentId: v.optional(v.string()),
    stripeEventId: v.optional(v.string()),
    name: v.string(),
    email: v.string(),
    level: v.string(),
    difficulties: v.string(),
    goal: v.string(),
    meetUrl: v.optional(v.string()),
    entitlementId: v.optional(v.id("entitlements")),
    creditsConsumed: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    rescheduledAt: v.optional(v.number()),
    rescheduledBy: v.optional(v.string()),
    rescheduleReason: v.optional(v.string()),
    rescheduleRevision: v.optional(v.number()),
  })
    .index("by_idempotency", ["idempotencyKey"])
    .index("by_token_identifier", ["tokenIdentifier"])
    .index("by_clerk_user_id", ["clerkUserId"])
    .index("by_start_at", ["startAt"])
    .index("by_checkout_session", ["stripeCheckoutSessionId"])
    .index("by_payment_intent", ["stripePaymentIntentId"])
    .index("by_entitlement", ["entitlementId"]),

  entitlements: defineTable({
    clerkUserId: v.string(),
    tokenIdentifier: v.string(),
    offerKey: v.string(),
    mode: v.string(),
    totalCredits: v.number(),
    priceCents: v.optional(v.number()),
    remainingCredits: v.number(),
    status: v.optional(v.union(v.literal("active"), v.literal("partial_refund"), v.literal("refunded"))),
    refundStatus: v.optional(v.union(v.literal("partial"), v.literal("refunded"))),
    refundedAmountCents: v.optional(v.number()),
    validUntil: v.number(),
    stripeCheckoutSessionId: v.string(),
    stripePaymentIntentId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_checkout_session", ["stripeCheckoutSessionId"])
    .index("by_token_identifier", ["tokenIdentifier"])
    .index("by_payment_intent", ["stripePaymentIntentId"]),

  // Private progression for the existing English lessons. The lesson body
  // remains in the source catalogue and is only returned by englishLessons
  // after the server has verified the buyer's entitlement. This table stores
  // no content and has no browser-supplied owner key.
  englishLessonProgress: defineTable({
    clerkUserId: v.string(),
    tokenIdentifier: v.string(),
    lessonSlug: v.string(),
    completed: v.boolean(),
    completedAt: v.optional(v.number()),
    lastOpenedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_clerk_user_lesson", ["clerkUserId", "lessonSlug"])
    .index("by_clerk_user_id", ["clerkUserId"])
    .index("by_token_identifier", ["tokenIdentifier"]),

  bookingEvents: defineTable({
    bookingId: v.id("bookings"),
    eventType: v.string(),
    status: v.string(),
    sourceEventId: v.string(),
    paymentIntentId: v.optional(v.string()),
    amountTotal: v.optional(v.number()),
    amountRefunded: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_booking", ["bookingId"])
    .index("by_source_event", ["sourceEventId"]),

  creditLedger: defineTable({
    entitlementId: v.id("entitlements"),
    clerkUserId: v.string(),
    bookingId: v.optional(v.id("bookings")),
    kind: v.union(v.literal("grant"), v.literal("consume"), v.literal("adjust")),
    units: v.number(),
    idempotencyKey: v.string(),
    createdAt: v.number(),
  }).index("by_idempotency", ["idempotencyKey"]),

  stripeEvents: defineTable({
    eventId: v.string(),
    eventType: v.string(),
    status: v.string(),
    bookingId: v.optional(v.id("bookings")),
    checkoutSessionId: v.optional(v.string()),
    paymentIntentId: v.optional(v.string()),
    amountTotal: v.optional(v.number()),
    amountRefunded: v.optional(v.number()),
    refundStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("sending"),
      v.literal("sent"),
      v.literal("skipped"),
      v.literal("failed"),
    )),
    refundId: v.optional(v.string()),
    notificationStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("sending"),
      v.literal("sent"),
      v.literal("skipped"),
      v.literal("failed"),
    )),
    notificationId: v.optional(v.string()),
    notificationError: v.optional(v.string()),
    notificationSnapshot: v.optional(v.object({
      email: v.string(),
      date: v.string(),
      time: v.string(),
      timezone: v.string(),
    })),
    processedAt: v.number(),
    effectsUpdatedAt: v.optional(v.number()),
  })
    .index("by_event_id", ["eventId"])
    .index("by_payment_intent", ["paymentIntentId"]),

  stripeRefunds: defineTable({
    paymentIntentId: v.string(),
    sourceEventId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("sending"),
      v.literal("sent"),
      v.literal("failed"),
    ),
    refundId: v.optional(v.string()),
    lastError: v.optional(v.string()),
    claimedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_payment_intent", ["paymentIntentId"]),

  bookingNotifications: defineTable({
    bookingId: v.id("bookings"),
    kind: v.union(v.literal("confirmed"), v.literal("rescheduled"), v.literal("reminder")),
    dedupeKey: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("sending"),
      v.literal("sent"),
      v.literal("skipped"),
      v.literal("failed"),
    ),
    attempts: v.number(),
    claimedAt: v.optional(v.number()),
    providerId: v.optional(v.string()),
    lastError: v.optional(v.string()),
    scheduleRevision: v.optional(v.number()),
    deliverySnapshot: v.optional(v.object({
      email: v.string(),
      date: v.string(),
      time: v.string(),
      timezone: v.string(),
    })),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_dedupe_key", ["dedupeKey"])
    .index("by_booking", ["bookingId"]),

  rescheduleOperations: defineTable({
    idempotencyKey: v.string(),
    bookingId: v.id("bookings"),
    date: v.string(),
    time: v.string(),
    rescheduleRevision: v.number(),
    notificationId: v.id("bookingNotifications"),
    createdAt: v.number(),
  }).index("by_idempotency_key", ["idempotencyKey"]),

  // Paid questionnaire dossiers. The owner fields deliberately duplicate the
  // Clerk identity so every query/mutation can enforce account isolation
  // without trusting an id supplied by the browser.
  clientRequests: defineTable({
    clerkUserId: v.string(),
    tokenIdentifier: v.string(),
    email: v.optional(v.string()),
    draftKey: v.string(),
    offerKey: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("awaiting_payment"),
      v.literal("payment_failed"),
      v.literal("paid"),
      v.literal("expired"),
      v.literal("refunded"),
      v.literal("cancelled"),
    ),
    paymentStatus: v.union(
      v.literal("unpaid"),
      v.literal("paid"),
      v.literal("failed"),
      v.literal("expired"),
      v.literal("refunded"),
    ),
    answersJson: v.string(),
    priceCents: v.number(),
    currency: v.string(),
    refundedAmountCents: v.optional(v.number()),
    stripeCheckoutSessionId: v.optional(v.string()),
    checkoutAttempt: v.optional(v.number()),
    checkoutPending: v.optional(v.boolean()),
    checkoutPreparationAttempt: v.optional(v.number()),
    checkoutPreparationExpiresAt: v.optional(v.number()),
    stripePaymentIntentId: v.optional(v.string()),
    stripeEventId: v.optional(v.string()),
    paidAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_draft_key", ["draftKey"])
    .index("by_token_identifier", ["tokenIdentifier"])
    .index("by_checkout_session", ["stripeCheckoutSessionId"])
    .index("by_payment_intent", ["stripePaymentIntentId"]),

  clientRequestFiles: defineTable({
    requestId: v.id("clientRequests"),
    clerkUserId: v.string(),
    tokenIdentifier: v.string(),
    storageId: v.id("_storage"),
    name: v.string(),
    mimeType: v.string(),
    size: v.number(),
    kind: v.string(),
    deliveryStage: v.optional(v.union(
      v.literal("preparation"),
      v.literal("book_guide"),
      v.literal("deliverable"),
    )),
    status: v.union(v.literal("active"), v.literal("deleted")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_request", ["requestId"])
    .index("by_storage_id", ["storageId"]),

  // A paid dossier is immutable after checkout. Every post-payment client
  // version gets its own submission row and, when applicable, its own private
  // file. Original questionnaire files remain dossier references and are not
  // review submissions for the animation project.
  clientSubmissions: defineTable({
    requestId: v.id("clientRequests"),
    clerkUserId: v.string(),
    tokenIdentifier: v.string(),
    offerKey: v.string(),
    kind: v.union(v.literal("animation"), v.literal("feedback"), v.literal("book")),
    sequence: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("submitted"),
      v.literal("in_review"),
      v.literal("published"),
      v.literal("closed"),
    ),
    payloadJson: v.string(),
    sourceFileIds: v.array(v.id("clientRequestFiles")),
    submittedAt: v.optional(v.number()),
    reviewedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_request", ["requestId"])
    .index("by_request_sequence", ["requestId", "sequence"])
    .index("by_token_identifier", ["tokenIdentifier"]),

  // Upload reservations for post-payment submissions are separate from the
  // pre-payment attachment flow. This keeps paid dossier files immutable and
  // lets retries remain idempotent without exposing storage URLs to clients.
  clientSubmissionUploads: defineTable({
    requestId: v.id("clientRequests"),
    submissionId: v.id("clientSubmissions"),
    clerkUserId: v.string(),
    tokenIdentifier: v.string(),
    uploadKey: v.string(),
    uploadUrl: v.string(),
    name: v.string(),
    mimeType: v.string(),
    expectedSize: v.number(),
    status: v.union(v.literal("pending"), v.literal("finalized"), v.literal("rejected")),
    storageId: v.optional(v.id("_storage")),
    fileId: v.optional(v.id("clientRequestFiles")),
    rejectionReason: v.optional(v.string()),
    expiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_upload_key", ["uploadKey"])
    .index("by_submission", ["submissionId"])
    .index("by_storage_id", ["storageId"]),

  // One row per promised review cycle. A cycle can only move forward; the
  // immutable snapshot/file it references is never replaced by a later one.
  reviewCycles: defineTable({
    requestId: v.id("clientRequests"),
    submissionId: v.id("clientSubmissions"),
    offerKey: v.string(),
    kind: v.union(v.literal("animation"), v.literal("feedback"), v.literal("book")),
    cycleNumber: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("submitted"),
      v.literal("in_review"),
      v.literal("published"),
      v.literal("closed"),
    ),
    sourceFileId: v.optional(v.id("clientRequestFiles")),
    reviewDraftId: v.optional(v.id("reviewDrafts")),
    reviewSnapshotId: v.optional(v.id("reviewSnapshots")),
    notesJson: v.optional(v.string()),
    publishedBy: v.optional(v.string()),
    submittedAt: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_request", ["requestId"])
    .index("by_request_cycle", ["requestId", "cycleNumber"])
    .index("by_submission", ["submissionId"]),

  clientRequestUploads: defineTable({
    requestId: v.id("clientRequests"),
    clerkUserId: v.string(),
    tokenIdentifier: v.string(),
    uploadKey: v.string(),
    uploadUrl: v.string(),
    name: v.string(),
    mimeType: v.string(),
    expectedSize: v.number(),
    kind: v.string(),
    deliveryStage: v.optional(v.union(
      v.literal("preparation"),
      v.literal("book_guide"),
      v.literal("deliverable"),
    )),
    status: v.union(v.literal("pending"), v.literal("finalized"), v.literal("rejected")),
    storageId: v.optional(v.id("_storage")),
    rejectionReason: v.optional(v.string()),
    expiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_upload_key", ["uploadKey"])
    .index("by_request", ["requestId"])
    .index("by_storage_id", ["storageId"]),

  clientRequestEvents: defineTable({
    requestId: v.id("clientRequests"),
    eventType: v.string(),
    fromStatus: v.optional(v.string()),
    toStatus: v.string(),
    sourceId: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_request", ["requestId"]),

  // A publication creates one durable, private notification job.  The source
  // id is the immutable PDF file or review snapshot id; no storage URL belongs
  // in this outbox or in the email payload.
  deliveryNotificationOutbox: defineTable({
    requestId: v.id("clientRequests"),
    kind: v.union(v.literal("pdf"), v.literal("review")),
    sourceId: v.string(),
    dedupeKey: v.string(),
    recipient: v.optional(v.string()),
    deliveryLabel: v.string(),
    followUpPath: v.string(),
    publishedAt: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("sending"),
      v.literal("sent"),
      v.literal("skipped"),
      v.literal("failed"),
    ),
    attempts: v.number(),
    nextAttemptAt: v.number(),
    claimToken: v.optional(v.string()),
    claimExpiresAt: v.optional(v.number()),
    firstAttemptAt: v.optional(v.number()),
    idempotencyExpiresAt: v.optional(v.number()),
    providerPayload: v.optional(v.object({
      recipient: v.string(),
      from: v.string(),
      replyTo: v.string(),
      subject: v.string(),
      text: v.string(),
      html: v.string(),
    })),
    providerId: v.optional(v.string()),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_dedupe", ["dedupeKey"])
    .index("by_request", ["requestId"])
    .index("by_status_next_attempt", ["status", "nextAttemptAt"]),

  // The first animation review is deliberately separate from the payment
  // dossier.  The draft is mutable through an optimistic revision, while a
  // published snapshot is append-only and can be exposed to the buyer.
  reviewDrafts: defineTable({
    requestId: v.id("clientRequests"),
    sourceFileId: v.id("clientRequestFiles"),
    sourceStorageId: v.id("_storage"),
    sourceName: v.string(),
    sourceMimeType: v.string(),
    sourceSize: v.number(),
    revision: v.number(),
    strokesJson: v.string(),
    textBoxesJson: v.string(),
    commentsJson: v.string(),
    fps: v.number(),
    duration: v.number(),
    videoWidth: v.optional(v.number()),
    videoHeight: v.optional(v.number()),
    status: v.union(v.literal("draft"), v.literal("published")),
    publishedSnapshotId: v.optional(v.id("reviewSnapshots")),
    cycleNumber: v.optional(v.number()),
    submissionId: v.optional(v.id("clientSubmissions")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_request", ["requestId"])
    .index("by_source_file", ["sourceFileId"])
    .index("by_request_cycle", ["requestId", "cycleNumber"])
    .index("by_submission", ["submissionId"]),

  // No mutation updates this table after publication.  It is the read-only
  // contract used by the buyer's library and its private media proxy.
  reviewSnapshots: defineTable({
    draftId: v.id("reviewDrafts"),
    requestId: v.id("clientRequests"),
    sourceFileId: v.id("clientRequestFiles"),
    sourceStorageId: v.id("_storage"),
    sourceName: v.string(),
    sourceMimeType: v.string(),
    sourceSize: v.number(),
    revision: v.number(),
    strokesJson: v.string(),
    textBoxesJson: v.string(),
    commentsJson: v.string(),
    fps: v.number(),
    duration: v.number(),
    videoWidth: v.optional(v.number()),
    videoHeight: v.optional(v.number()),
    publishedBy: v.string(),
    publishedAt: v.number(),
    cycleNumber: v.optional(v.number()),
    submissionId: v.optional(v.id("clientSubmissions")),
  })
    .index("by_request", ["requestId"])
    .index("by_draft", ["draftId"])
    .index("by_request_cycle", ["requestId", "cycleNumber"])
    .index("by_submission", ["submissionId"]),

  clientStripeEvents: defineTable({
    eventId: v.string(),
    eventType: v.string(),
    status: v.string(),
    requestId: v.optional(v.id("clientRequests")),
    checkoutSessionId: v.optional(v.string()),
    paymentIntentId: v.optional(v.string()),
    amountTotal: v.optional(v.number()),
    amountRefunded: v.optional(v.number()),
    refunded: v.optional(v.boolean()),
    currency: v.optional(v.string()),
    processedAt: v.number(),
  })
    .index("by_event_id", ["eventId"])
    .index("by_payment_intent", ["paymentIntentId"]),

  // The legal contract is prepared before Checkout is created.  Payment
  // success alone never changes this record to accepted: only a Stripe
  // Checkout event carrying explicit terms consent can do so.
  paymentContractProofs: defineTable({
    kind: v.union(v.literal("client_request"), v.literal("booking")),
    requestId: v.optional(v.id("clientRequests")),
    bookingId: v.optional(v.id("bookings")),
    clerkUserId: v.string(),
    tokenIdentifier: v.string(),
    offerKey: v.string(),
    contractVersion: v.string(),
    termsPath: v.string(),
    refundPolicyPath: v.string(),
    consentText: v.string(),
    termsConsentRequired: v.boolean(),
    earlyStartConsentRequired: v.boolean(),
    stripeMode: v.union(v.literal("test"), v.literal("live")),
    status: v.union(
      v.literal("pending"),
      v.literal("attached"),
      v.literal("accepted"),
      v.literal("rejected"),
    ),
    stripeCheckoutSessionId: v.optional(v.string()),
    checkoutAttempt: v.optional(v.number()),
    stripePaymentIntentId: v.optional(v.string()),
    stripeConsentStatus: v.optional(v.union(
      v.literal("accepted"),
      v.literal("missing"),
      v.literal("pending"),
    )),
    consentAcceptedAt: v.optional(v.number()),
    consentEventId: v.optional(v.string()),
    lastEventId: v.optional(v.string()),
    lastEventType: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_request", ["requestId"])
    .index("by_booking", ["bookingId"])
    .index("by_checkout_session", ["stripeCheckoutSessionId"]),
});
