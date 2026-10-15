// Question statuses students never see. "UnderReview" holds AI-drafted
// questions until an admin approves them in the review queue.
export const HIDDEN_STATUSES = ['Archived', 'Flagged', 'UnderReview'];

/** Mongo condition for the `status` field of student-visible questions. */
export const visibleStatus = () => ({ $nin: HIDDEN_STATUSES });
