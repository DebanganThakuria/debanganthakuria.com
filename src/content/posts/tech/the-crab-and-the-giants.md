---
title: "The crab and the giants"
description: "I finally benchmarked Narad against Kafka, RabbitMQ, NATS, Redis, and Pulsar on identical hardware, ran a Jepsen-style test against my own broker, stole a ten-year-old trick from RabbitMQ's source code, and shipped a 2× speedup that evaporated the moment it touched production hardware. A story about measurement, humility, and standing on shoulders."
date: 2026-08-26
tags: ["Tech"]
draft: false
---

Narad's comparison page had a dirty secret. It compared *features*: a tidy matrix of checkmarks showing where my crab had claws and where it didn't. Features are the easy column. The questions that actually decide whether anyone should run your message broker are the ones I'd been avoiding. How fast is it? How safe is it, really? What does it cost to keep alive?

So I spent a day answering them properly. It did not go the way I expected, which by now is the defining feature of this project.

## The hall of mirrors

Step one was reading everyone else's benchmarks, and step one taught me why nobody trusts benchmarks.

Confluent's famous 2020 run shows Kafka at 605 MB/s, twice Pulsar's 305. StreamNative's rebuttal shows them at parity. Both are telling the truth. The trick is a single configuration line: Kafka, by default, **does not fsync your message before acknowledging it**. Its durability comes from replication and the page cache; `log.flush.interval.messages` is set to `Long.MAX_VALUE`, which is a very formal way of writing "never." Pulsar fsyncs its journal before every ack. Confluent benchmarked Kafka-without-fsync against Pulsar-with-fsync and printed the ratio. When StreamNative forced both to the same promise, the gap nearly closed.

That asymmetry became the organizing principle of the whole comparison. Every throughput number is meaningless without the column next to it that says *what the ack meant*. NATS JetStream fsyncs on a **two-minute interval** by default; the December 2025 Jepsen analysis showed acked writes vanishing even with three-way replication, because the Raft quorum acks from memory. Redis loses up to a second on its default AOF policy. The systems that fsync before confirming, out of the box: Pulsar, RabbitMQ's quorum queues, and my crab. That's the whole list.

## Jepsen, at home

Speaking of Jepsen: the real thing is a consultancy I cannot afford, but the methodology is just engineering. So Narad's soak harness grew a history checker built on [porcupine](https://github.com/anishathalye/porcupine), the linearizability checker. Record every produce, delivery, and ack with timestamps, then check each message's little lifetime against the sequential model of a lease queue. Produce, deliver, redeliver if the lease lapses, ack once. After a confirmed ack, *silence, forever*. Porcupine's interval math does something subtle and lovely here: a successful ack proves its lease was alive at that moment, so an ack plus a later redelivery is a violation in **every** ordering the timestamps permit. The checker doesn't accuse; it proves.

Then I pointed it at the live cluster and started killing pods.

Sixteen minutes, a hundred messages a second across three delivery paths, two pod kills including the Raft leader. The verdict, over 250,680 message histories: zero lost messages, zero early deliveries, zero protocol violations, and 941 messages that came back *after* their acks. Every single one of the 941 sat inside the two crash windows. Not one in the quiet minutes.

Which is exactly what the documentation promises. Narad is at-least-once; a crash can resurrect acked state; consumers must be idempotent. But there is a difference between writing that sentence in your docs and watching a formal checker confirm that your system's duplicates happen *only* when the contract says they may. In steady state, exactly-once-after-ack held across a quarter million histories. The crab doesn't lie. It just occasionally repeats itself at funerals.

## Weighing the crab

For throughput, published numbers only get you so far. Different years, different hardware, different vendors' thumbs on different scales. So I did the thing the compare page could finally be honest about: ran *everyone* on identical compute. One broker at a time in Docker, two CPUs and two gigabytes each, same driver, same workload. Every produce waits for the system's per-message confirmation, then everything gets consumed and acked. Each system in its default durable configuration, asterisks printed in the open.

| system | produce msg/s | the ack means |
| ------ | ------------- | ------------- |
| NATS JetStream | 39,525 | no fsync (2-min interval) |
| Redis Streams | 31,643 | AOF buffer, ~1s window |
| Kafka | 14,728 | page cache, no fsync |
| RabbitMQ quorum | 13,014 | **fsynced** |
| Pulsar standalone | 7,632 | fsync disabled in standalone |
| Narad | 5,597 | **fsynced** |

The ordering is mostly the durability column priced in milliseconds: the systems that don't flush per confirm top the chart. That's the trade, made visible. But one line in that table refused to let me sleep. RabbitMQ, making the **same promise** (fsync before the confirm), was producing 2.3× faster than me.

## Reading the giant's source

RabbitMQ is open source, which means when it beats you, you get to find out *why*. Its quorum queues sit on Ra, their Raft library, and the answer lives in one Erlang file: `ra_log_wal.erl`. One shared write-ahead log per node, group commit, batches of whatever arrived during the previous flush. Structurally it's the *same design* as Narad's ingress WAL, which was equal parts validating and humbling. The difference was one line of configuration: `sync_method: datasync`. RabbitMQ calls `fdatasync`. I was calling `fsync`.

The difference sounds like trivia and isn't. `fsync` durably writes your data *and* the file's metadata: timestamps, inode bookkeeping, a journal transaction on ext4, on every single group commit. `fdatasync` writes the data and only the metadata needed to read that data back. For an append-only log, that's the entire promise you're making. The metadata journaling is pure tax.

So Narad grew a tiny package with one function and a build tag per kernel family: `fdatasync(2)` on Linux and the BSDs and Solaris, `F_FULLFSYNC` on macOS (Darwin has no fdatasync, and its plain fsync famously doesn't force the drive cache; Apple gives you one honest primitive and it's the expensive one), `FlushFileBuffers` on Windows. Every file-data sync site in the broker converted; every *directory* fsync deliberately left alone, because a directory fsync's entire purpose is metadata. Tests, cross-compiles, PR, merge.

The CI benchmark (free GitHub runners, nightly, guarding a committed baseline, another of the day's additions) came back glowing: produce throughput **5,382 → 10,549 messages a second. Two times.** p99 produce latency fell from 52 milliseconds to 3.5. One syscall. I tagged v2.1.0, upgraded the cluster, bumped the brew formula, and got ready to write the victory post.

## The ocean shrugs

Then I benchmarked the production cluster. Before the upgrade: 4,327 msg/s. After: 4,273. The p50 didn't move by the width of its own noise.

Both machines run Linux. Both take the new fdatasync path. The difference is what lives *under* the syscall. The CI runner has a local SSD, where a flush costs microseconds; there, fsync's metadata journal was a second physical flush, and halving the flushes halved the time. The cluster's disks are EBS volumes, where a flush is a **network round trip to a replicated storage service**. I dropped a microbenchmark into the pod and measured it directly, interleaving the two syscalls call-by-call so neither could blame its position in the queue:

```
fsync      n=500  avg=2.995ms  p50=2.989ms
fdatasync  n=500  avg=3.005ms  p50=2.992ms
```

Three microseconds apart, on a three-millisecond operation. The metadata commit rides along inside the same round trip. On EBS, my beautiful optimization is a rounding error.

I'd be lying if I said that didn't sting. But the microbenchmark bought something the 2× never could: certainty about where the next win *isn't*. That three-millisecond flush is physics. No syscall, no buffer, no clever WAL rearrangement removes a network round trip to the storage layer. The only lever left is arithmetic: if the flush costs 3ms no matter what, put more messages inside each one. Narad's produce API is one message per HTTP request; a batch endpoint amortizes the round trip *and* the flush across fifty messages at a stroke. That's not a 2×. That's a regime change, and it's precisely how the giants win the workloads I lost in that table. Kafka and RabbitMQ don't have faster disks. They have fatter batches.

That's the next molt.

## Standing there, on the shoulders

The scorecard for the day: a comparison page that answers the hard questions with sourced numbers and honest asterisks. A Jepsen-style verdict that my broker's only sin is the one it confesses to in writing. A shootout table where the crab loses several fights fairly and the reader can see exactly what each winner paid. A release that doubles throughput for everyone running on real disks, does nothing for anyone on cloud volumes, and cost nothing either way. And a precise, bought-and-paid-for understanding of what to build next.

The fdatasync trick is a decade old. It was sitting in RabbitMQ's source the whole time, one `grep` away, in a file written by people who benchmarked their promising syscall changes long before I did and watched their own EBS volumes shrug. Standing on the shoulders of giants turns out to be less like a triumphant pose and more like climbing someone's back while they patiently explain which of your ideas they already tried in 2014.

The crab is still a crab. But it reads now.
