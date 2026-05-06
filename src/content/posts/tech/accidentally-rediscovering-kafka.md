---
title: "I tried to build a simple message queue and accidentally rediscovered Kafka"
description: "I sat down to design a lightweight and durable message queue system from scratch, the way you do when you want to learn distributed systems properly. Every decision I made pushed me closer to the shape of Kafka. Turns out there's a perfectly good evolutionary metaphor for that."
date: 2026-05-06
tags: ["Tech"]
draft: false
cover_image: ../../../assets/images/narad/cover.jpg
---

There's a phenomenon in evolutionary biology called carcinization. It's the observation that, given enough time, a surprising number of unrelated species independently evolve into things that look like crabs. Different ancestors, different oceans, different starting points — and yet, over and over again, nature converges on a flat body, a hard shell, and a pair of claws.

Software has a version of this too. I figured it out the slow way.

## The naive plan

The brief I gave myself was modest. I wanted to build a small, durable, easy-to-operate message queue from scratch. Go for the implementation. JSON schemas with backward-compatible evolution, validated on every produce. A simple way to push to consumers. Minimal moving parts. Not Kafka. Definitely not Kafka.

The point wasn't to ship a competitor — there are already very good competitors and the world is not waiting on me. The point was to learn distributed systems properly. The system would *be* the project. I'd internalize how this stuff actually works by being forced to design every part of it.

That, at least, was the plan.

## Every question had a Kafka answer

Then I started reasoning through the design.

Could the storage layer be a shared filesystem, so any node can read any partition? No — the writer needs to own its data, and "shared filesystems" are either slow over the network or are themselves a distributed storage system, which is the same problem one floor down.

Could replication be leaderless? No, not for an ordered log. Concurrent writes mean two nodes both trying to assign offset 100, and now you've signed up to implement Paxos or Raft, which is a different side project.

Round-robin writes across brokers, then? No: round robin distributes *load*, not *order*. Distributed ordering is a coordination problem, not a load-balancing one. The way out is brutally simple — one leader per partition, all writes funnel through it, offsets fall out as a counter. Easy. Deterministic. Replayable.

What about durability if the entire system gets shut off for a month? The leader has to write to local disk. And the followers, because if the leader dies you need at least one node that already has the data and didn't lose it on a reboot. So now I have a leader per partition, followers per partition, all persisting to local disk, a replication protocol between them, and a small dance to elect a new leader when one of them goes down.

Should partition counts be dynamic, like Pulsar? In principle, sure — but that requires a metadata layer that tracks which broker owns which partition, a rebalancing protocol for when nodes join or leave, and a consumer-group protocol so consumers know which broker to talk to for which partition.

You can see where this is going. Each individual answer was reasonable. Each individual answer was also exactly what Kafka does.

## The crab

Halfway through, I stopped and looked at what I was sketching. Topics. Partitions. Per-partition leaders. Followers. Replication. Monotonic offsets. A schema registry. A durable on-disk log with index files for fast seeks. Recovery on restart.

This was Kafka. I was reinventing Kafka, badly, by hand.

That's when the crab meme came back to me. Every distributed event streaming system, given the same set of constraints — ordering, durability, fault tolerance, scalability — converges toward the same shape. There's no escaping it because the constraints aren't arbitrary; they're load-bearing. Pull on any one of them and the rest fall out the same way every time. You can call it Kafka, you can call it Pulsar, you can call it your weekend side project. It's still going to grow claws and a hard shell.

## So what's the point, then

That was the question worth sitting with. If the shape is fixed, what am I actually building?

The honest answer turned out to be: a different set of trade-offs at the edges, plus the act of building it.

Most teams I've seen don't need the full Kafka surface. They need a queue with durable storage and the ability to replay. SQS is too forgetful for some workloads — once a message is acked, it's gone, and you can't go back and re-process. Kafka is too much machinery for others — partitions, consumer groups, ZooKeeper-or-KRaft, ops complexity that scales faster than the team. There's a middle that's underserved.

The shape I want at the surface is SQS. Consumers attach to a queue, pull messages, ack them; a visibility timeout keeps an in-flight message from being handed to anyone else until it's acked or expires. No partitions to think about. No consumer-group ceremony. If you've used SQS, you've used it.

Fan-out collapses into the same primitive. Instead of bolting on a separate topic abstraction, one queue can subscribe to another. A producer writes to one queue, and any number of downstream queues subscribe to it — each with its own consumers, its own offsets, its own ack state. The pub/sub case becomes a wiring decision, not a different system.

Underneath, it's a durable log. The queue API is the friendly face; the log is the truth. Replay is just rewinding an offset. Schema validation lives at the produce path. The whole thing is one Go binary, small enough to run without hiring a platform team to babysit it.

The whole system, in one line: an opinionated queue with durable logs.

The other half — the act of building it — is the part that doesn't show up in benchmarks. I want to understand, at the level of muscle memory, *why* the design is the way it is. Why offsets are monotonic per partition. Why followers can't acknowledge a write before it hits disk. Why partition leadership has to be elected and can't just be assigned. The way to actually learn this is not to read about Kafka. It's to try to build something simpler and discover, line by line, that the simpler version isn't simpler at all.

## Narad

The working name is Narad — after Narad Muni, the wandering sage in Hindu mythology who carries messages between worlds. (He's also famous for occasionally stirring trouble, which feels about right for a piece of infrastructure.)

It's early. I have a single-node log that can append and read, with the offsets and the file format starting to settle into something I'm not embarrassed by. The network layer next, then replication, then the consumer protocol, then everything that follows that. The math on how long this is going to take is mildly demoralising if you stare at it directly, so I try not to.

But that was always the deal. The system is the project. The point isn't to ship; it's to learn the shape of the crab from the inside.

## The takeaway

If you sit down to design a distributed event streaming system from first principles, you will rediscover Kafka. This is not a failure mode — it's the entire point of doing it. The constraints are real, the design space is narrow, and the existing systems aren't popular by accident. They're popular because the convergent shape is a *good* shape.

What you get from doing it yourself isn't novelty. It's the ability to look at the existing systems and understand, without hand-waving, why they look the way they do — and, eventually, where you'd genuinely choose to make a different trade-off.

Now, on building that crab...