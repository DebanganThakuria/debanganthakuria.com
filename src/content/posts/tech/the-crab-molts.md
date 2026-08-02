---
title: "The crab molts: Narad 2.0"
description: "The v1.0 post ended with an honest column of three things Narad refused to claim. Four days later, one of them fell: the cluster can now rebalance and shrink itself. This is how you move the only copy of a partition between machines without losing a record — plus a CLI, a fuzz harness, and eight releases in two weeks."
date: 2026-08-02
tags: ["Tech"]
cover_image: ../../../assets/images/narad/v1-cover.png
---

The last post ended with an honest column — the three things a 1.0 refused to claim: no replication, no ordering guarantee, and no partition rebalancing. "New nodes serve new topics until the rebalance-and-decommission work ships in a future release," I wrote, with the comfortable vagueness of someone who assumed *future* meant months.

The future release shipped four days later. [Narad is v2.0](https://github.com/DebanganThakuria/narad/releases/tag/v2.0.0) now, and the two weeks since the last post produced eight releases: a full CLI with a Homebrew tap, a fuzz harness for the storage engine, a stack of error-semantics fixes — and the headline, the reason the major version doubled: **the cluster can rebalance and shrink on its own.**

A crab grows by molting. It can't expand inside a rigid shell, so it sheds the whole thing and sits there soft and vulnerable until the new one hardens. Survival is a function of how short you keep that window. That, it turns out, is also exactly how you move a partition between machines when you've sworn off replication.

## The problem with owning your data exactly once

Here's the corner the v1.0 design painted itself into, on purpose. Every partition in Narad has exactly one owner, and that owner's disk holds the *only* copy of the data. No followers, no quorums — that was the amputated claw, and I stand by it.

But it means rebalancing can't be what it is in Kafka, where "moving" a partition mostly means promoting a replica that already exists somewhere else. In Narad, moving a partition means **physically copying the only copy of the data to another machine and cutting over without losing a record** — while producers keep producing into it. And decommissioning a node means doing that for everything the node owns before it's allowed to leave.

The design follows the principle that already runs the rest of the system: *nodes worry about themselves*. Every partition assignment in the metastore now carries two fields — **Owner**, who serves it now, and **Target**, where it should end up. The controller (the Raft leader) does policy only: it writes Targets to balance partition count across live nodes. Each node runs a local reconcile loop that notices "I'm someone's Target" and converges toward it. Nobody choreographs anybody, and the ownership flip at the end is a single guarded compare-and-swap in Raft — atomic, one entry, no split-brain window to argue about.

## Freeze at the last possible moment

A partition can be gigabytes. Freezing produce for the whole copy would be an outage wearing a feature's name tag, so the copy is two-phase and the freeze covers only the tail.

**CatchUp** streams the source's segments — sealed files plus the growing active tail — while produce keeps flowing, iterating passes to shrink the un-copied delta. Once it's within a configured `lagBytes` of the live tail, **PrepareHandoff** freezes the source, and **Finalize** drains what's left — a few MiB, milliseconds of freeze — reproduces the source's exact high-watermark and committed consumer offset, verifies the staged copy actually *recovers* into a valid log, installs it with an atomic rename, and flips ownership.

If this shape looks familiar, it should: it's pre-copy/stop-and-copy cutover, the same algorithm as live VM migration. And it has the same failure mode — what if the partition is being written faster than you can copy it? Each CatchUp pass copies the delta since the last one, and consecutive deltas scale by write-rate over copy-bandwidth. If writes are slower than the copy (the normal case), deltas shrink geometrically and the freeze is tiny. If writes are faster, the tail never shrinks, so CatchUp is **bounded**: after a capped number of passes, or once the tail stops shrinking, it gives up on convergence and freezes anyway, and the freeze does a stop-and-copy of whatever remains. That's always safe and always terminates, because the freeze *stops the writes* — you're no longer chasing a moving target. The counterintuitive bit I enjoyed most: since the tail only grows while you keep chasing it, **stopping sooner is what makes the freeze smallest**.

The best part is what clients see during all of this: **nothing blocks, for anyone, at any point.** A produce that would route to the frozen partition reroutes to a live partition of the same topic — the same AP reflex Narad already uses around a dead owner. Consume is never frozen at all, because reads can't violate the no-loss invariant; the source keeps serving consumers straight through its own handoff. Consumer offsets travel with the partition, and anything unacked at the flip simply redelivers at the new owner. Duplicates, never gaps — the at-least-once contract absorbing the seam, exactly as designed.

## The paranoia section

The last post's worst bug — the freshly elected Raft leader that trusted its stale memory and destroyed 2,106 messages' worth of real cursors — produced a lesson I said belonged in a textbook: *winning leadership is a statement about your log, not your memory.* In v2.0 that lesson stopped being a scar and became a design rule. The rebalance planner runs only after a **Raft barrier**, under a mutex, so a freshly elected leader can never plan partition moves against a state machine that hasn't caught up to its own log. The bug from July is structurally impossible in the feature from July. That's the kind of compounding I hoped this project would produce.

The rest of the machinery is similarly mistrustful of itself:

- **The flip is guarded.** `CompleteMove` sets Owner to Target *only if* the owner is still the source and the target is still this node. A re-plan or competing worker fails the CAS, the install rolls back, the source stays authoritative, and a retry is legitimate.
- **Force-promote is gated twice.** If the source dies mid-move, the destination waits — the source's disk is the only authority, so waiting is the data-safe default. Past a two-minute threshold it promotes the copy it holds, but only if the copy session actually reached the source at least once, *and* the staged copy recovers to at least the source's last-known high-watermark. If promoting would drop a single visible record, it refuses and keeps waiting.
- **The planner moves the minimum.** Level-triggered, recomputed every tick, idempotent under in-flight moves (a mid-move partition counts at its destination, so plans reach a fixpoint instead of oscillating), and capped at eight concurrent moves so a big rebalance drains gradually instead of copying the world at once.
- **Even the cleanup is suspicious.** The v2.0.1 polish release added a stale-copy sweep that reclaims the old owner's partition directory after a flip — behind three separate safety checks, because deleting data is the one operation this project has taught me to fear properly.

## Decommission is rebalance wearing a different hat

My favourite design economy in the release: node decommission required almost no new machinery. Marking a node *draining* just removes it from the planner's receiver set while it remains a live owner. The same minimal-movement algorithm that balances a scale-out now sheds every partition the node owns onto the others — a decommission is simply a rebalance in which one node's capacity is zero.

Once the draining node owns nothing, the controller removes it from the Raft voter set behind two guards: never drop below three voters, and never let a node remove itself from a configuration it currently leads — if the drained node is the leader, leadership transfers away first and the new leader finishes the removal. One command from the operator's side:

```bash
narad cluster decommission narad-4
```

This is the same trick as the P.S. in the last post, where replication fell out of fan-out placement instead of a replication subsystem. The pattern has held twice now: the best features come from refusing to build the feature and then noticing the system can almost already do it.

## The receipts

Same rules as v1.0 — a claim is worth what survived trying to kill it:

- **Extreme-chaos soak**: scale-up rebalance, full rolling restart, decommission, pod kills, and forced recovery, all under load — 23,728 of 23,728 records durable, verified by replay audit.
- **Clean decommission under sustained load**: 53,824 of 53,824 records durable, zero produce rejections — availability really was never the price of a move.
- 1,637 unit and integration tests, plus native **fuzz targets** on the storage engine's parse and recovery surfaces, because the soak taught me that the inputs nobody sends are the ones that matter.
- Partition moves are observable: Prometheus metrics for in-flight moves, duration, and bytes copied, and `narad cluster moves` for humans.

## The broker grew a front door

The other thing the fortnight produced is less deep and more delightful: Narad has a real CLI now. Everything was always possible with `curl` — that's the point of an HTTP-only broker — but humans at terminals deserve verbs. The sixty-second demo is genuinely sixty seconds:

```bash
brew install debanganthakuria/narad/narad
narad server start --dev          # real broker, zero config
narad topic add demo
narad sub demo --peek             # watch the topic live
narad pub demo '{"hello":"narad"}' --count 100 --rate 20
```

The detail I'm proudest of is `--peek`. A queue's "subscribe" is destructive by nature — consume, ack, gone — which makes debugging production topics nerve-wracking. `narad sub` without flags is a real consumer that competes with your workers. With `--peek` it's a bystander: it tails every partition using replay reads, reserves nothing, acks nothing, and production consumers never notice it existed. It's the "what is actually flowing through this topic right now?" tool I kept wishing for during every soak run, finally extracted from my throwaway scripts into the product.

Around the edges, the same fortnight shipped the unglamorous correctness stack: control-plane operations during elections now return a retryable 503 instead of a 500, invalid arguments return 400 instead of a misleading 409, idle partition logs close after thirty minutes and reopen lazily, and a security pass added explicit integer-bounds checks in the wire codecs. None of it is a headline. All of it is the difference between a project and a product.

## The honest column, revised

So the column is shorter now. What remains: no follower replication — still, and the rebalance work is quietly the strongest argument yet for that choice, because single-owner partitions are what made "move the partition" a problem simple enough to solve with a copy loop and a CAS. And no ordering guarantee — which was never a gap, just a price tag, printed in the second paragraph of the docs where it belongs.

Two posts ago Narad was a design sketch that kept turning into Kafka. One post ago it was a shipped 1.0 with a chaos matrix for a spine. Now it's a cluster you can grow and shrink under load without a maintenance window, operated from a CLI you can install with brew. The crab molted: it shed the shell it had outgrown, spent its soft window measured in milliseconds per partition, and came out bigger.

The code is at [github.com/DebanganThakuria/narad](https://github.com/DebanganThakuria/narad), the docs — including a full internals page on the [rebalance machinery](https://debanganthakuria.github.io/narad/internals/rebalance/) — are at [debanganthakuria.github.io/narad](https://debanganthakuria.github.io/narad/). The honest column has one structural item left on it. I've stopped predicting how long "future work" takes.
