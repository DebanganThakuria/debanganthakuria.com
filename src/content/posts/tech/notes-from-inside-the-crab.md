---
title: "Notes from inside the crab"
description: "A few weeks ago I wrote about how every distributed event streaming system converges on the same shape. This is about the lessons I learned standing inside that shape — the ones you can't get from a design sketch, only from the act of building."
date: 2026-05-10
tags: ["Tech"]
cover_image: ../../../assets/images/narad/brand_design.png
---

A few weeks ago I wrote about how trying to design a small message queue from scratch led, inevitably, to me sketching something that looked exactly like Kafka. The carcinization metaphor — that nature keeps reinventing the crab — turned out to map cleanly onto distributed systems. The constraints are real, the design space is narrow, and the existing systems aren't popular by accident.

That post was about the *shape* of these systems. This one is about the things I learned standing inside the shape, with a half-finished log on disk and a growing list of decisions to make. None of these are novel; all of them are written about in textbooks. The difference is that I had to feel the cost of each one before I understood why it mattered. That's the part you can't get by reading.

Here are the lessons I didn't expect.

## Storage is the floor

I started thinking about Narad the way I think most people start thinking about distributed systems: APIs first, networking second, replication third, and the disk somewhere at the bottom of the stack as an implementation detail.

That instinct is exactly backwards.

The very first thing I had to write was the writer that owns the partition's data, and the moment I started writing it, I realised I was no longer building a messaging system. I was building a storage engine. Recovery, fsync semantics, partial writes, index rebuilds, file rotation, corruption detection — all of it lives below the level where messaging concepts even apply. If the storage layer is wrong, replication just replicates corruption faithfully. If recovery is wrong, the cluster comes back in a state nobody can reason about.

The reframe, once it lands, is uncomfortable: distributed systems are *local persistence problems first*. The networking is the easy part. The data structure on the disk is where the truth lives, and the shape of that truth dictates everything above it.

## The log is sacred. Everything else is a cache.

Once I'd accepted that the log was the substrate, I started making indexes. A small map from offset to file position so reads didn't have to scan. Then a sparse index, because keeping every entry in memory was wasteful. Then a persisted version of the sparse index, so we didn't rebuild the whole thing on restart.

And every time I added a new structure, I caught myself trying to keep it consistent with the log on every write. Two writes, two fsyncs, complicated atomicity, the usual horror.

Then it clicked: the index is a *cache*. It is not the source of truth. The log is. If the index is wrong, you throw it away and rebuild it from the log, which is the only thing that's actually authoritative. That single change in framing simplified an unreasonable amount of code. Indexes became disposable. Recovery became "read the log, rebuild the auxiliary state." Crash safety became a property of one file, not five.

This is the real reason append-only logs win, by the way. Not because appends are fast (they are), and not because sequential IO is friendlier to the kernel (it is). It is because the log is a *single place to be honest*. Every other piece of state can be wrong and recoverable. The log can't be wrong.

There's a related lesson about data structures here that I almost missed. I started reaching for trees and balanced search structures the way you do when your brain has been recently trained on algorithms textbooks. They're the wrong shape. The workload is sequential and append-only; offsets are monotonic; reads are usually "give me everything from here onward." A slice with a sparse positional index beats a tree at every operation that matters. The lesson is that workload patterns matter more than asymptotic complexity, and the systems engineer's job is largely about noticing which patterns you're actually serving before reaching for the textbook structure.

## A queue is a log wearing makeup

I'd been calling Narad a queue because the API I want at the surface is queue-shaped: pull a message, ack it, move on. But the longer I worked on it, the more I noticed that a queue and a log are not the same animal at all.

A log is immutable, ordered, and oblivious to consumers. Once a record is written, it is there forever (or until retention deletes it), and nothing the consumer does changes it.

A queue is mutable per-consumer state pretending to be a thing. Visibility timeouts, in-flight messages, retry counts, dead-letter handling, ack/nack — none of that lives in the log. It lives in a side table that says, for each consumer of each message, *what's happening with it right now*. And that side table is potentially bigger and more contentious than the log itself, because it changes constantly while the log just grows.

The trap is to try to bake all of it into the log. You can't. The log is a record of what was *produced*. Consumer state is a record of what is being *consumed* — and those have fundamentally different lifetimes. The trick the real systems use is to track only the *interesting* consumer state: the inflight ones, the failing ones, the retried ones. The boring path — produced, consumed, acked, gone — leaves no trace beyond the consumer's offset.

Once you see this distinction, half the design questions answer themselves. You stop trying to make the log do queue things, and you stop trying to make the queue rederive log properties. Each layer does its job and only its job, and the seam between them is where the API lives.

## Distributed systems are an argument about ownership

The next thing I learned is that almost every "distributed" decision, when you trace it back, is really a question about *who is allowed to do what*.

Can two nodes both write to the same partition? No, because then offsets aren't sequential, and now you've signed up to implement Paxos before lunch. So one node owns each partition's writes. Now you have a leader.

Can followers ack to the client before they've written the data? No, because then a leader failure can lose acknowledged messages. So the leader waits. But waiting for *all* followers means one slow node freezes the system. So the leader waits for a quorum. Now you have a replication protocol with quorum semantics, which means you also have a definition of "committed," which means you have a definition of "durable," which is the contract everything above the storage layer relies on.

Can any node tell consumers where to find a partition? No, because two nodes might have stale views of the cluster, and a consumer that talks to the wrong leader can't make progress. So you need a metadata layer that is authoritative. Now you have a control plane, separate from the data plane, and a whole second set of leadership and replication problems for the metadata itself, one floor up.

The pattern is the same every time. *Who owns the truth about X?* If the answer is "everyone equally," you've got a coordination problem and you'll be reading about Raft for the rest of the afternoon. If the answer is "one node, with rules for handing the role over when things go wrong," you can ship something. The art is picking the right granularity of ownership — partition-level for data, cluster-level for metadata, message-level for consumer state — and being deliberate about each.

The hardest version of this I hit was a small thing I now think of as the negative-lookup problem. If a consumer asks node A for a partition that doesn't exist, node A doesn't know whether the partition is genuinely absent or whether A just hasn't heard about it yet. Absence locally doesn't imply absence globally. The only way out is for *something* to be authoritative about the global namespace, and the moment you accept that, you've accepted that you have a control plane, and the moment you have a control plane, you have a small distributed system inside your distributed system, with all the same problems one level up. It's turtles down to the metadata leader.

## The code is not where the bugs live

Here's the realisation that took the longest to land: most of the actual difficulty in this kind of system is *semantic*, not syntactic.

When I write `ack`, what does that mean? Does it mean the message was delivered? Processed? Persisted somewhere downstream? Removed from the queue? Each of those is a different contract, and the bugs almost always live in the gap between what the code does and what the operator thinks it does.

"Durable" is another loaded word. Durable when written to the leader's page cache? When fsynced on the leader? When replicated to a follower? When fsynced on a follower? When fsynced on a quorum? Every one of those is a defensible definition, and every one gives you a different system under failure. Most of the bad incidents I've seen in messaging systems aren't the code being wrong; they're *durability* meaning a slightly different thing in two places that needed to agree.

Once I noticed this, I started seeing it everywhere. "Replicated." "Committed." "Delivered." "Visible." "Owned." Every one of these is a contract, and the contract is the load-bearing structure. The Go is just an attempt to encode it without bugs.

This is the part of distributed systems I think gets underestimated the most. You can read every paper, copy every algorithm, and still end up with a system that breaks under load — not because the algorithm is wrong, but because two parts of your system quietly disagree about what a word means.

## Performance is mostly honesty about IO

I'd assumed, going in, that performance work would be about clever data structures and tight loops. Most of it isn't. Most of it is about being honest with yourself about the cost of the disk and the network, and not lying about either.

fsync is the boss. fsync is what makes durability real, and it's also the slowest thing in the path by an order of magnitude or two. Every meaningful throughput optimisation is, ultimately, an answer to one question: *how do I get more useful work into a single fsync?* Batch producers. Group commits. Compress before writing. Pipeline replication. Each of these is, at some level, the same trick — amortise the cost of the disk's honesty over many messages.

The protocol you use barely matters. The serialisation format barely matters. The language barely matters. (Go is fine; it's not the bottleneck.) What matters is the IO discipline. Get that wrong and no amount of clever code will save you. Get it right and the system will be embarrassingly fast on commodity hardware.

## What I'm actually learning

If I'm being honest, I started this project thinking I would learn Go infrastructure patterns and how Kafka works internally. I am, kind of. But the deeper thing is that I'm learning a way of seeing systems where storage, time, ownership, and trust are all tangled up, and where the words you use to describe the system are part of the system itself.

It's the same reframing, over and over, applied to different parts of the build. Don't think about the API; think about the contract. Don't think about the algorithm; think about who owns the state. Don't think about the code; think about what happens when half of the network blinks for a second. Most of the time, the answer comes back to: *the log is the source of truth, and someone has to own each part of it.*

Once you start thinking like that, every distributed system you've ever used starts making more sense — not because they're all the same, but because the constraints they're solving for are. The crab shape isn't a coincidence. It's the only shape that survives operational reality.

I'm still nowhere near finished with Narad. The single-node log behaves itself. The network layer is being built. Replication and the consumer protocol are still slightly intimidating words on a whiteboard. But the value isn't in the finished thing — it never was. It's in the slow accumulation of these reframings, until at some point, looking at any messaging system, you can squint and see the same handful of decisions sitting underneath, just dressed differently.

That, more than anything, is what I think I came here to learn.
