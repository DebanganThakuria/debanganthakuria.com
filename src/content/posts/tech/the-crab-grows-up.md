---
title: "The crab grows up"
description: "Fast is nice. Trustworthy is the whole point of a message broker. This is the less flashy side of Narad 3: two audits that found over a hundred problems, an outage I caused with a 24-hour certificate, soak tests that ran for days, and the boring paperwork that makes a project safe to depend on."
date: 2026-10-09
tags: ["Tech"]
draft: false
---

My [last post](/posts/tech/the-crab-crosses-the-sea) was about the exciting parts of Narad 3: it got faster, and it learned to copy topics to other clusters.

This one is about the other parts. Nobody gets excited about these, but they're what decide whether you can actually trust a message broker with your data. Since August I've spent more time on them than on features: hunting bugs before users find them, running long tests, making mistakes and learning from them, and doing the paperwork that tells strangers the project is run properly.

## Two audits

A test suite only checks what you thought to test. To find what I hadn't thought of, I did two big audits: I went through the code area by area and wrote down everything that looked wrong.

The rule was strict. A suspected problem only counted once someone had tried hard to prove it **wasn't** a problem and failed. Plenty of suspicions fell apart at that step, which is the point. It keeps the list honest.

![Diagram: two audits. The busy path of sending, reading and acking had 75 suspected problems; 58 held up, plus 12 that might be real; all 70 were fixed, each with a test. The control plane of topics, users and moves had 84 suspected problems; 82 held up, which came down to 43 distinct bugs, 2 of them critical. The bugs were fixed in v3.1.0, and a few feature ideas were declined.](../../../assets/images/narad/narad-grows-up/audits.svg)

**The first audit** covered the busy path: sending, reading and acking messages. A few of the things it caught:

- A partition that was **forced to take over** after a failure could start with its "delivered up to here" marker past the end of its own data. Anything saved there afterwards would never be delivered. This was a real way to lose messages, and it had been there before the audit.
- If you **deleted a topic and created a new one with the same name**, messages meant for the old topic could end up in the new one.
- When two acks raced each other, the "done up to here" marker could **move backwards**, so a restart would hand out messages that were already acked.

All 70 problems (the 58 that held up and the 12 that might have been real) were fixed, each with a test that fails on the old code. The final review of that work also found a critical bug **that my own fixes had introduced**: after a power cut, one server could get permanently stuck. It was fixed before anything was merged. That's why the review comes last.

**The second audit** covered the control plane: creating topics, managing users, adding servers and moving partitions. It found 43 distinct bugs. Two were critical:

- A single secured server accepted **internal server-to-server calls without checking who was calling**.
- If a partition move finished in a confusing state, both copies of the partition could be deleted. **The data would be gone.**

Both were fixed first, and the rest followed in v3.1.0. A few suggestions from that audit weren't bugs but feature ideas, like having the broker shed load on its own when the disk fills up. I said no to those. More on why below.

## The 24-hour certificate

In September I took down the data side of our test cluster without touching it, and it took a couple of days to work out why.

Narad servers talk to each other over QUIC, which needs a TLS certificate. Each server made its own certificate when it started, valid for **24 hours**. Nothing ever renewed it.

A server that stayed up longer than a day still worked with the connections it already had. But no other server could open a **new** connection to it. As servers restarted at different times, they lost the ability to reach each other one by one.

![Diagram: a timeline from September 12 to 16. Raft, the control plane, has its own long-lived certificates and looks healthy the whole time. Three nodes each start with a valid certificate that expires 24 hours later. The first alarms come on September 14, and by September 16 all three certificates have expired, so no node can open a new connection to any other.](../../../assets/images/narad/narad-grows-up/cert-outage.svg)

The sneaky part: the control plane (Raft) uses its own, long-lived certificates, so it stayed perfectly healthy. The cluster had a leader, topics could be created, everything looked fine. Meanwhile every message that needed to hop between servers was failing.

The fix had two steps. First the certificate's lifetime went up to a year. Then I asked what that certificate was even for. It never proved who a server was; that's done by a shared cluster secret, checked on every connection. So the date check on it was protecting nothing, and I removed it. Now uptime can never cut a cluster in half again.

**What I learned:** if every request between servers suddenly fails with a crypto error, check how long the servers have been up before anything else.

## Soak tests: running it for days

Unit tests run for seconds. Some bugs only show up after hours, so I run soak tests: a program that sends, reads and acks messages nonstop for days and checks every single one off.

After the certificate fix, the September soak sent **44,781,267 messages**. Not one was left undelivered. 32 came back a second time after they'd been acked. That's allowed (Narad promises *at least* once, not exactly once), and those repeats lined up with servers that had been restarted during the run. Later I found the likely cause: a server that crashes at the wrong moment can end up saving the same message twice.

That soak had to stop because it was taking too much of a shared cluster. In October I started a new one that's meant to run for **months**. It uses the Go client and tests five things side by side: plain queues, batches, delayed messages, fan-out, and replaying old messages. It kept running through the v3.2.2 upgrade without losing anything.

It's already taught me something. It flagged five messages as possibly lost. They weren't. Narad had handed each one to a waiting reader a few milliseconds **before** the sender got its "202, saved". The soak only started tracking a message once it heard back from the send, so it saw a delivery for a message it didn't know about yet. The fix was in the soak: track a message before sending it.

## Twice fooled by the same thing

The most useful lesson of the autumn came from a false alarm.

After an outage, a test reported about **5,000 messages undelivered.** My first thought was that the newest change had broken something. Before digging in, I ran the exact same test against the code from **before** that change. It did exactly the same thing. So it wasn't the change.

The real cause wasn't a bug at all. A reader had died while holding a message. That one message held its partition's "done up to here" marker in place until its 30-second lease ran out. Then the backlog came through all at once. Given a bit more time, every message was delivered exactly once.

Two weeks later, the same thing fooled my nightly benchmark, as I described in the [last post](/posts/tech/the-crab-crosses-the-sea). Now I check the old code first, every time. It's the cheapest way to find out whether you're chasing a new bug or an old behaviour.

## Checking correctness, not just counting

Counting lost messages is easy. The harder question is whether every message went through its life in a legal order: sent, handed out, maybe handed out again if a lease ran out, acked, and then **never seen again**.

For that I use a linearizability checker built on [Porcupine](https://github.com/anishathalye/porcupine). It records every send, delivery and ack with timestamps and checks the whole history against those rules. The key idea: a message coming back after its ack is only allowed if a server was being killed at that moment. If nothing explains it, that's a bug.

On a three-node cluster:

- With **8 server kills** during the run: 35,314 messages, 27 came back after an ack, and **all 27** happened during a kill. Zero lost.
- With **no faults**: 22,389 messages, each one sent, delivered and acked **exactly once**.

Every pull request also runs a three-node cluster through a load test and a restart test, and fails on any lost or misdelivered message.

## The boring parts that matter

None of these will make the front page, but they're what people check before they rely on a project:

- **A docs site that's actually good.** I redesigned it with 47 diagrams, a [delivery contract](https://debanganthakuria.github.io/narad/understand/delivery-contract/) page that says exactly what Narad promises, and an [OpenAPI spec](https://debanganthakuria.github.io/narad/reference/openapi.yaml) that CI checks against the real code, so the two can't drift apart.
- **Security scanning.** Code scanning runs on every change. When remote children opened up new alerts, I fixed them before the next release.
- **OpenSSF Best Practices badge: passing.** It's a long checklist covering how a project handles security reports, testing, releases and more. Narad meets it ([project 15297](https://www.bestpractices.dev/projects/15297)).
- **Independent.** Narad is my own project, and its MAINTAINERS file says so.
- **GitHub Sponsors** is open, if you'd like to support the work.
- **Releases you can install.** Every release ships a container image and a Homebrew formula, and comes with notes that say exactly how to upgrade and how to roll back.

## Saying no

The last thing I worked on is easy to miss: deciding what Narad will **not** do.

People ask for a lot: a built-in dead-letter queue, message headers, duplicate detection, automatic load shedding, more kinds of login. Each one is reasonable on its own. Together they'd turn Narad into a smaller, buggier Kafka.

So I wrote the rule down: **keep Narad simple, like SQS, but always correct, and when something fails, fail gracefully.** Every failure should end in a clear outcome, like an error you can act on, a metric, or a log line. Never a silent hang, and never lost data. Anything the broker doesn't need to decide for you belongs in your code, where you can see it and change it. The [feature tour](/posts/tech/everything-the-crab-can-do) shows how far you can get with that.

That rule turned out to be the most useful thing I wrote all autumn. It made the audits faster (is this a bug, or a feature request?), it kept the code small, and it's why a project with one maintainer can keep up with a hundred findings.
