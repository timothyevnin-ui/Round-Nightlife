/**
 * "What's hot right now" — the shelf on the home page, and the long reads
 * behind it. These six are seed drafts written from general reputation so the
 * shelf has a shape; every one is meant to be rewritten in the back office
 * (Edit a place → What's hot right now) after a real visit. Nothing here is
 * copied from another publication.
 */
export const SEED_STORIES: Record<string, { rank: number; story: string }> = {
  "achilles-heel": {
    rank: 1,
    story: `There are bars that are trying, and then there's a corner tavern in Greenpoint that stopped trying a long time ago and got better for it. Low ceiling, wood everything, a window onto the street that goes gold about an hour before sunset.

The move is a weeknight. Two of you, or four at a squeeze, a glass of something the bartender picked, and a conversation that doesn't need to compete with anything. It gets busier late on weekends, but even then it stays a room where you can hear the person across from you.

Go before you're hungry, because you'll want to stay, and then walk down to the water after. That's the whole night, and it's a good one.`,
  },
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
  clems: {
    rank: 5,
    story: `A proper dive on a corner that gets busy for the right reasons: it's cheap, it's easy, and it's open late. Nobody is dressed up. The jukebox is doing more work than any DJ within a mile.

This is the second stop, the "let's just go somewhere" stop, the place a night out gets a second wind. A group of five can find a stretch of bar without a fight, and the backyard-ish situation in warmer months takes the pressure off.

If you want to sit, come before eleven. If you want the night to get a little unhinged, come after.`,
  },
  "thai-diner": {
    rank: 6,
    story: `The rare restaurant that's a full night out on its own. Loud in a good way, colorful, a menu you'll argue about, and a crowd that looks like it walked over from three different parties.

Go with four and order too much. The food arrives fast and the room keeps moving, so it works as the first stop before a bar as well as the whole plan. It's also the answer to "where do we take the friend who's visiting and wants New York to feel like New York."

Waits are real at peak. Put your name down, go get a drink around the corner, and come back when the text lands.`,
  },
};
