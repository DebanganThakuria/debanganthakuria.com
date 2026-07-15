---
title: "The crab ships: Narad 1.0"
description: "A year ago I set out to build a message broker to learn distributed systems properly. Two posts ago it was a design sketch that kept turning into Kafka. Today it's v1.0 — 300 million soaked messages, a chaos matrix, and a release tag I had to delete within the hour. This is the story of proving it."
date: 2026-07-15
tags: ["Tech"]
draft: false
cover_image: ../../../assets/images/narad/v1-cover.png
---

Two posts ago, I wrote about how designing a message queue from scratch kept converging on the shape of Kafka — carcinization, but for infrastructure. The follow-up was about the lessons you only learn standing inside that shape, and it ended with me admitting that replication and the consumer protocol were "still slightly intimidating words on a whiteboard."

Today, [Narad is v1.0](https://github.com/DebanganThakuria/narad/releases/tag/v1.0.0). It has a [documentation site](https://debanganthakuria.github.io/narad/), a Helm chart, and a body of evidence behind the tag: 300+ million messages soaked through a live five-node cluster at 1,000 messages per second, a chaos matrix of kill -9s and mid-write restarts with zero loss, a 50,000 msg/s full-flow bench, and backup/restore, rolling-upgrade, and replay drills — all against a real Kubernetes deployment, not a laptop.

This post is about the distance between "it works" and "I trust it," which turned out to be most of the project. But first I have to confess something about the crab.

## The claw I amputated

The whiteboard said replication. The whole convergent-evolution argument said replication — every serious system in this space grows that organ, and post one treated it as inevitable.

I built Narad without it. On purpose.

Every partition in Narad has exactly one owner, and that owner's disk holds the only copy of the data. Durability is not "it's on three machines"; it's two fsync points with a CRC read-back between them — the record hits the write-ahead log durably before the producer gets its 202, and hits the partition log durably, verified, before any consumer can see it. If the volume survives, the data survives. If the volume is destroyed, that partition's retained data is gone, and the docs say so in bold instead of a footnote.

The reason is honesty about what the system is *for*. Replication buys you availability of old data through permanent machine loss, and it charges you for it in quorum writes, consistency protocols, and the exact operational complexity I built Narad to avoid. But a queue is not a database. The working set is messages that live for minutes between produce and ack; retention exists for replay, not archival. For that workload, "any surviving node accepts your writes, and disks are durable" covers the failure modes people actually hit — nodes crash and come back — while staying a system one person can operate and read.

The same honesty applies to ordering: Narad doesn't guarantee it, and says so in the second paragraph of its docs rather than in an appendix about partition semantics. If the owner of your key's partition is down, your message goes to a live partition instead of waiting for a dead machine. Availability and durability are the priorities; order is not. Narad is an AP system and would rather deliver your message somewhere than make you wait for the right somewhere.

So the crab is missing a claw. It turns out you can ship a crab like that, as long as you never claim the claw is there.

## A green test suite is a hypothesis

Narad has had race-enabled unit tests, end-to-end tests, and three-node chaos smoke tests in CI for most of its life. For months that felt like rigor. Then I started running multi-day soaks — a harness producing at a fixed rate around the clock, consuming through the full flow, and reconciling every produced message against every consumed one in a ledger — and learned that a green suite is a hypothesis, not a result.

Here's the bug that taught me. A few days into one soak window, the ledger showed hundreds of thousands of duplicate deliveries over seven hours. No losses — every message accounted for — just an absurd storm of redelivery. The chain, once I dug it out: consumers were acking out of order, which is legal; the per-partition set that tracks out-of-order acks filled to its cap, which is by design; the broker started refusing further acks with a 503, which is documented; the harness didn't retry failed acks, which was my bug; so the unacked messages hit their visibility timeouts and were redelivered, which is the at-least-once contract working exactly as specified. Six correct behaviors composing into one pathological system.

No unit test finds that, because every unit was right. The fix was a design change: when the ack-tracking set is full, the broker now hands out only the *one message the frontier is stuck on*, instead of cheerfully redelivering the whole backlog so it can fail to ack again. The spiral can't form. But I'd never have known the spiral existed without letting the system run long enough for statistics to do their work.

That became the operating principle for the entire last stretch: the test suite proves the parts, the soak proves the composition. The final window ran 47 and a half hours at 1,000 msg/s through a produce→consume→ack flow with a fan-out child and a delayed child — 170.9 million messages, zero lost, four produce retries total, and not one delayed message fired early.

## An election proves your log, not your memory

The best bug of the project — the one I'd put in a textbook — came from crash-recovery testing, and it cost 2,106 messages in the run that exposed it.

Narad's control plane is Raft. A node that wins an election is guaranteed, by the algorithm, to have every committed log entry. What the algorithm does *not* guarantee is that the node's state machine has *applied* those entries yet. A leader restored from an old snapshot can win a legitimate election — its log is complete — and then serve reads from a state machine that is still hours in the past, because replaying the log takes time and nothing forces it to finish first.

My fresh leader woke up, looked at its stale memory, concluded that some fan-out consumer cursors didn't belong to any live configuration, and cleaned them up. The cleanup was destructive. The cursors were real. 2,106 messages fell through the gap.

The fix is one call: a freshly elected leader must issue a Raft barrier — wait for its state machine to catch up to its log — and re-read before making any "my local state is authoritative" decision. Cheap, boring, and invisible until the exact moment it saves you. The general form of the lesson is the one I keep re-learning in this project: *winning leadership is a statement about your log, not about your memory*, and every line of code that trusted the memory was wrong in a way no amount of reading about Raft had prepared me to notice.

Finding the lost messages was its own small adventure — the on-disk segments are zstd-compressed, so you can't grep a disk for a missing payload. I ended up writing throwaway scanners against the storage engine's own read path to walk frames and prove exactly which offsets existed where. Debugging a storage engine with the storage engine felt like something between dogfooding and surgery on yourself.

## The first v1.0.0 lasted about an hour

Release day had a plan: final soak readout, tear down the harness, tag v1.0.0, deploy, done by lunch.

The tag went up. The deploy went out. And then, as a formality, I smoke-tested the release the way a stranger would use it — and a stranger's first `curl` broke it. I produced the string `hello-v1`. Not JSON, just bytes, which is legal: produce is deliberately an octet-stream, no schema, no ceremony. Then I tried to consume it, and got a 500.

The consume response is a JSON envelope, and it embedded the payload as a raw JSON value. Feed it bytes that aren't JSON and one code path refused to serialize the response — *after* reserving the message, so the message redelivered and failed forever, a poison pill — while the other code path happily spliced the raw bytes into the response and returned syntactically invalid JSON with a straight face and a 200.

Three hundred million soaked messages never caught this, because the soak harness, like a polite user, always sent JSON. The one input a stranger would try in their first five minutes was the one input the entire evidence pyramid had never contained.

The fix keeps produce permissive — that's the point; it's the feature SQS forbids and Pub/Sub makes clients do themselves — and makes the response envelope adapt instead: JSON comes back verbatim, byte for byte; plain text comes back as a JSON string; binary comes back base64-encoded with a `payload_encoding` flag telling you so. Whatever bytes you send are exactly the bytes you get back. I deleted the release, landed the fix with a test for every payload shape, re-cut the same tag against the fixed commit, redeployed, and re-ran the smoke matrix — this time with JSON, text, and raw binary through every routing path, ten times each, asserting byte-identical responses regardless of which node answered.

v1.0.0, the first one, existed for roughly an hour. I'm choosing to read that as the process working: the smoke test did its one job on the one morning it mattered. But it was a humbling coda to a month of evidence-gathering — the last bug wasn't in the consensus code or the storage engine or the failure handling. It was in the gap between what produce accepts and what consume can say, sitting in plain sight the whole time.

## The receipts

What the tag stands on, compressed:

- **Soak**: multi-day windows at 1,000 msg/s across produce → consume → ack with fan-out and delayed children. 300M+ messages in aggregate, zero lost, zero early delay fires. The final 47.5-hour window: 170.9M messages, four produce retries, ledger fully reconciled.
- **Chaos**: kill -9 of partition owners, Raft leaders, and joining nodes; restarts mid-produce; a night of real infrastructure node churn that killed pods for me, free of charge. Zero loss everywhere.
- **Capacity**: 50,000 msg/s sustained through the full produce → consume → ack flow on a three-node cluster — and the load *generator* saturated first, so that's a floor, not a ceiling.
- **Drills**: full backup/restore with a measured recovery point, a mixed-version rolling upgrade, live scale-out from three nodes to five under traffic, and a replay hammer of thousands of offset reads with no measurable effect on live consumers.
- One accidental bonus test: mid-verification, my VPN died for fifteen minutes. The ledger's overdue counter spiked to eighteen thousand and reconciled to exactly zero when the network came back. I couldn't have scripted a better outage.

And the honest column, because a 1.0 is defined by what it refuses to claim: no replication (a destroyed volume loses that partition's retained data), no ordering guarantee, and no partition rebalancing yet — new nodes serve new topics until the rebalance-and-decommission work ships in a future release.

## What the year was actually for

I started this to learn distributed systems properly, and the first two posts were about design — how the constraints herd you into the crab shape, how the log is the only honest structure, how every distributed question is an ownership question.

The last stretch taught the part no design post covers: **confidence is manufactured, not felt**. It is built out of unglamorous artifacts — a reconciliation ledger, a chaos matrix, a soak window you resist the urge to cut short, a smoke test you run even though you *know* it will pass. Every bug in this post lived in the seams between components that were each individually correct, which is exactly where the textbooks said the bugs would live, and exactly where I still didn't look until the evidence forced me to.

The code is at [github.com/DebanganThakuria/narad](https://github.com/DebanganThakuria/narad) and the docs — a client guide, an operator handbook, and internals that walk the real function names — are at [debanganthakuria.github.io/narad](https://debanganthakuria.github.io/narad/). It's one binary and one Helm chart, and the whole API fits on a screen. If you read the internals and find the next seam I didn't look in, I genuinely want to hear about it.

The crab is alive. It's missing a claw, it knows exactly which one, and it has the paperwork to prove the rest of it works.

## P.S. — the claw grew back, sort of

Hours after shipping, staring at the fan-out diagram, it clicked: a fan-out child *is* a full second copy of its parent's data — durably committed before the cursor advances. The only reason it wasn't replication is that the placement round-robin put a keyed record's copy on the *same node* as its original. A replica that shares a disk with the thing it's replicating survives nothing.

So v1.1.0 shipped the same day: create a topic with a `parent` field, and its partitions are deliberately placed on different nodes than the parent's — verified live, partition by partition, owner by owner. One API call, and a topic has an asynchronous full copy that survives its disk:

```bash
curl -u $AUTH -X POST $NARAD/v1/topics   -d '{"name": "orders-replica", "parent": "orders"}'
```

No replication subsystem was built. No quorums, no consistency protocol, none of the machinery I amputated the claw to avoid — just a placement rule on the fan-out path the soak had already hammered for days, honest fine print included (it's async DR, not transparent failover). It turns out the best feature I added all year came from refusing to build the feature and then noticing the system could already almost do it.

The crab regrew the claw out of parts it already had. Carcinization wins again — it just took the scenic route.
