# raft-kv

A three-node Raft consensus implementation with a key-value state machine, built
from scratch in TypeScript as a learning project.

It is the deliberate complement to a separate project (`~/Desktop/wallet-app`), a
sharded wallet that covers **partitioning** — splitting data across machines.
This one covers the other half of distributed systems: **replication and
consensus** — keeping copies in agreement, leader election, quorums, split-brain.

## How to work with me on this

**Teach by questions. I design and write the algorithm.** This is a learning
project, so working it out myself is the entire point.

- Go one step at a time, in chat: first explain the concept, then ask me one
  question. I answer it and write the code, then you check both.
- Do not hand me state fields, method signatures or step-by-step hints in
  advance — let me work out what is needed from the questions. That includes
  the overall architecture: files, classes, and how nodes talk to each other.
- Do not write Raft logic unless I explicitly ask.
- Plumbing (HTTP, JSON, config, boilerplate) you can write outright once my
  design calls for it — there is no Raft learning in it.
- Review what I write and tell me what is wrong and why, citing the Raft rule it
  violates. Be direct about bugs; do not soften them.
- When I ask a conceptual question, explain rather than patch the code.

## Current state

Started over from scratch on 2026-09-25. Stage 1 (leader election) is designed
and now being written:

- `src/transport.ts`, `src/cluster.ts` — plumbing written by Claude: `listen()`,
  `send()` (returns `null` when no reply comes back), and the 3-node list.
- `src/node.ts` — mine, in progress.

Stage 1 design, as I worked it out:

1. One leader; all writes go through it.
2. The leader sends heartbeats about every 0.5 s. A follower that hears nothing
   before its election countdown runs out starts an election.
3. Countdowns are random (1.5–3 s), so usually one node starts first. A stuck
   election retries when the countdown runs out again.
4. Starting an election: term + 1, become candidate, vote for yourself, restart
   the countdown, send a vote request (term + id) to all other nodes at once.
5. Each node votes at most once per term, first come first served. Winning
   needs a majority of the whole cluster (2 of 3). Voting yes restarts the
   voter's countdown. A reply from an old election (no longer a candidate, or a
   different term) is ignored. No reply is not a "no".
6. Every message and reply carries the sender's term. Smaller: ignore it and
   reply with your own term. Bigger: step down (copy the term, become follower,
   clear the vote, start the countdown, stop heartbeats). Same: handle normally.
7. Becoming leader: term and vote unchanged, stop the countdown, start the
   heartbeat timer and send the first heartbeat right away.
8. A heartbeat from the current term's leader restarts the countdown. A
   candidate in that term gives up and becomes a follower, keeping its vote.

## The stages

1. **Leader election** — three nodes agree on exactly one leader, and killing
   the leader produces a new one.
2. **Log replication** — the leader copies writes to the followers, and every
   node applies the same writes in the same order.
3. **Safety** — a node that is missing data can never become leader and erase it.
4. **Persistence** — a node that crashes and restarts comes back correctly.
5. **Client interface** — clients can set and get through any node and always
   see up-to-date data.

## Reference

The Raft paper: "In Search of an Understandable Consensus Algorithm" (Ongaro &
Ousterhout). Figure 2 is the complete specification; I use it after designing
each stage to check what I missed.
