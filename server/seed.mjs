// Curated starter content for the Commons, inserted once if the board is empty.
// British English, no em dashes, in keeping with the site's honest, sealed-first tone.
import { db, nextNo, posterId } from './db.mjs';

const DATA = [
  { board: 'came-true', subject: 'the headline I read before it was printed',
    body: 'dreamed a local headline word for word. a factory fire, a street i know. woke at 4am and sealed it.\n>two days later it ran, near enough the same words\n>still cannot decide if it means anything\nbut the timestamp is there now, so at least it is on the record and not just a story i tell.',
    replies: [
      { body: 'this is the good kind of post. sealed first, checkable after. that is the only version of this that survives a sceptic.' },
      { body: 'did you resolve it on the registry? a sealed hit with a public proof is worth a hundred of these stories.' },
    ] },
  { board: 'came-true', subject: 'a text from someone I had not heard from in years',
    body: 'dreamed her name lighting up my screen. next morning, an actual message, out of nowhere. small, but it landed.\n>sealed it too late to prove though\nlesson learnt. seal it the same night or it never happened.' },

  { board: 'recurring', subject: 'the staircase down into still water',
    body: 'same staircase for maybe fifteen years. it goes down into dark water that never has a current. i never reach the bottom.\nanyone else get one location that just keeps returning?',
    replies: [ { body: 'mine is a corridor of doors. none of them open. i have stopped trying to read anything into it and just note when it comes back.' } ] },
  { board: 'recurring', subject: 'counting the ones that repeat',
    body: 'started tagging my vault entries and the motif detector flagged water in four of them, always still, always descending. did not notice until it was counted.' },

  { board: 'lucid', subject: 'realised I was dreaming mid-flight',
    body: '>looked at my hands, they were wrong\n>knew instantly\nheld the lucidity for what felt like minutes. flew over a version of my old school. woke up grinning.',
    replies: [ { body: 'the hand check still works for me more than anything else. reality testing through the day carries over.' } ] },
  { board: 'lucid', subject: 'how do you stay in without waking',
    body: 'every time i get lucid the excitement wakes me within seconds. tried spinning, tried rubbing my hands. what actually works for you?' },

  { board: 'astral', subject: 'the drift right at sleep onset',
    body: 'that heavy still moment just before sleep, where it feels like the bed tilts. not claiming anything about it. just that it is a real and repeatable sensation and i would like to understand it.' },
  { board: 'astral', subject: 'onset buzzing, then nothing',
    body: 'loud vibration, a sound like a rushing, then i am somewhere else for a moment. read that it is sleep paralysis onset. read that it is more. keeping an honest log either way.' },

  { board: 'altered', subject: 'tripping inside the dream, on nothing at all',
    body: 'sober for months but dreamed the full texture of a trip. colours breathing, time folding. no substance involved. the brain can clearly do it on its own.',
    replies: [ { body: 'this is the most interesting board honestly. the fact the mind produces the whole thing unprompted says a lot.' } ] },
  { board: 'altered', subject: 'a substance in the dream that does not exist',
    body: 'took something in the dream that has no name awake. very specific effects, very consistent across a few dreams. sealed the description so i can compare the next time it shows up.' },

  { board: 'nightmares', subject: 'teeth into my open hands',
    body: 'the teeth one again. they fall into my cupped hands and i cannot stop them. recurring, and always the same helpless feeling.\n>woke with my jaw aching\nnot reading it as an omen. just logging it.',
    replies: [ { body: 'teeth dreams are so common there is probably a plain physical reason. still horrible every time.' } ] },
  { board: 'nightmares', subject: 'the one I will not describe in full',
    body: 'sealed it in the vault instead of writing it here. some of them do not need an audience, only a timestamp.' },

  { board: 'discussion', subject: 'do dreams predict anything or are we fooling ourselves',
    body: 'genuine question. i lean sceptic but the hit rate on this board makes me wonder. the honest answer is we will not know until there is enough sealed, dated data to actually count.',
    replies: [
      { body: 'the timestamp idea is the only honest way to ever find out. record the prediction before the event, at scale, and let the numbers talk. anecdotes prove nothing.' },
      { body: 'exactly this. i do not need it to be real. i need it to be checkable. that is the whole point of sealing first.' },
    ] },
  { board: 'discussion', subject: 'why the misses matter as much as the hits',
    body: 'a board that only posted its hits would be worthless. the misses are what make a hit mean something. glad the registry shows both.' },
];

export function seedCommonsIfEmpty() {
  const n = db.prepare(`SELECT COUNT(*) AS c FROM commons_threads`).get().c;
  if (n > 0) return { seeded: false, existing: n };

  const insThread = db.prepare(`INSERT INTO commons_threads (no, board, name, poster_id, subject, body, created_at, bumped_at, reply_count) VALUES (?,?,?,?,?,?,?,?,?)`);
  const insPost = db.prepare(`INSERT INTO commons_posts (no, thread_no, name, poster_id, body, created_at) VALUES (?,?,?,?,?,?)`);
  const bump = db.prepare(`UPDATE commons_threads SET bumped_at = ? WHERE no = ?`);

  // spread threads back over the last few days so ordering looks natural
  let t = Date.now() - DATA.length * 5 * 3600 * 1000;
  for (const item of DATA) {
    const no = nextNo();
    const created = new Date(t).toISOString();
    insThread.run(no, item.board, null, posterId(no, 'seed-' + no), item.subject, item.body, created, created, (item.replies || []).length);
    let rt = t + 90 * 60 * 1000;
    for (const rep of item.replies || []) {
      const rno = nextNo();
      const rcreated = new Date(rt).toISOString();
      // a different synthetic client => a different id, as real repliers would have
      insPost.run(rno, no, rep.name || null, posterId(no, 'seed-' + rno + '-r'), rep.body, rcreated);
      bump.run(rcreated, no);
      rt += 75 * 60 * 1000;
    }
    t += 5 * 3600 * 1000;
  }
  return { seeded: true, threads: DATA.length };
}
