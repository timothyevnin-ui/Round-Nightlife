/**
 * "What's hot right now" — the shelf on the home page, and the long reads
 * behind it. These are seed drafts written from general reputation so the
 * shelf has a shape; every one is meant to be rewritten in the back office
 * (Edit a place → What's hot right now) after a real visit. Nothing here is
 * copied from another publication.
 */
export const SEED_STORIES: Record<string, { rank: number; story: string }> = {
  "ear-inn": {
    rank: 2,
    story: `Older than almost everything around it, and it acts like it. Low doorway, creaky floor, a bar that's been polished by two centuries of elbows. On a wet night it's the coziest room south of Houston.

This is a beer-and-a-burger place at heart. Come with people who like to talk, take the table by the window if it's free, and don't be surprised when someone at the bar joins the conversation. There's live music some nights that feels like it wandered in rather than got booked.

The catch: it fills up early with people who work nearby, so a big group should aim for after nine or a Sunday afternoon. Two or three of you can walk in almost any time.`,
  },
  "bar-goto": {
    rank: 3,
    story: `Quiet, precise, and a little bit Tokyo. The cocktails here are the kind you sip slowly, and the bar snacks are good enough that you'll end up ordering a second round of those too.

It's a first-date room, honestly. Small enough that you're close, calm enough that you can talk, and the lighting does everyone a favor. It also works for the night when the group is three and everyone's a little tired of loud.

Get there on the early side; the room is small and it doesn't take reservations for the bar. If it's full, there's a lot within two blocks, but you'll want to come back.`,
  },
  walkers: {
    rank: 4,
    story: `The tavern that makes Tribeca feel like a neighborhood. Tin ceiling, a long bar, booths that fit six if everyone's friendly, and a kitchen that keeps going late enough to matter.

It's the place for the night that has no plan: someone's coming from work, someone's coming from the gym, someone's bringing a friend from out of town who's heard about the neighborhood and expected something fancier. Everybody's comfortable here within ten minutes.

Beer and a burger is the correct order. The corner table is the correct table. If you see it open, take it and text the group the address.`,
  },
  "thai-diner": {
    rank: 6,
    story: `The rare restaurant that's a full night out on its own. Loud in a good way, colorful, a menu you'll argue about, and a crowd that looks like it walked over from three different parties.

Go with four and order too much. The food arrives fast and the room keeps moving, so it works as the first stop before a bar as well as the whole plan. It's also the answer to "where do we take the friend who's visiting and wants New York to feel like New York."

Waits are real at peak. Put your name down, go get a drink around the corner, and come back when the text lands.`,
  },
};
