// Pure business rules shared by the browser store (guests) and the server (signed-in users).
export const SIGNUP_BONUS = 25;
/** Daily claim: 10 credits, +5 per streak day (streak 2 => 15), capped at +30 (streak 7+ => 40). */
export const claimBonus = (streak: number) => 10 + 5 * Math.min(Math.max(streak - 1, 0), 6);
/** Largest balance we will carry over from a guest's (client-reported, unverifiable) local credits. */
export const IMPORT_CREDITS_CAP = 50;
