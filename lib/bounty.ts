/**
 * The offer, in one place (client-safe). The live amount lives in the
 * settings table (`bounty`), which the Studio and schema.sql can change;
 * this is what the app says when it hasn't heard otherwise.
 */
export const BOUNTY_AMOUNT = 7;
export const BOUNTY_CAP = 300;

/** "$7" */
export const money = (n: number) => `$${Number.isFinite(n) ? n : BOUNTY_AMOUNT}`;
