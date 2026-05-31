---
title: "Code Is a Liability"
description: "Over the years, especially while working on payments systems, I have become much more cautious about code itself. Writing it is cheap. Owning it is not."
date: 2026-05-31
tags: ["Tech"]
draft: false
---

When I first got into software engineering, I thought the job was mostly about writing code.

That probably sounds obvious, but I mean it in a very specific way. I thought the better engineer was the one who could build more things, write more code, design more sophisticated systems, and move faster than everyone else. More abstractions felt like maturity. More services felt like scale. Rewriting something messy felt like ambition.

I do not think that anymore.

After a few years of working on backend systems — especially in payments — I have become much more cautious about code itself.

Not because code is bad. Obviously, code is the thing we use to solve problems. But I no longer see it as value by default.

I see it as a cost. Or more accurately, a liability.

Every line of code we add becomes one more thing someone has to understand later, one more thing that can break in production, one more thing that needs to be monitored, migrated, debugged, tested, reviewed, secured, and explained to the next engineer who inherits it.

The value is not in the code. The value is in the problem it solves.

That sounds obvious when written down, but I do not think most engineering teams actually behave as if they believe it.

## Complexity arrives long before scale does

A lot of engineering discussions use “scale” as the justification for complexity.

We might need more services later. We might need this abstraction later. We might outgrow this design later.

Sometimes that is true. But a lot of the time, complexity shows up much earlier than the scale it was supposedly preparing for.

I have seen systems with very high traffic that were still fairly understandable. I have also seen systems at much smaller scale that felt fragile, not because the load was extreme, but because there were too many moving parts and too many assumptions spread across too many places.

That kind of complexity hurts in a very specific way. It makes debugging slower. It makes onboarding slower. It makes changes scarier. It makes incidents harder, because the problem is no longer just “what failed?” but “who even fully understands how this works?”

Some of the worst production issues I have seen were not caused by lack of technology. They were caused by the system becoming too hard for humans to reason about safely.

That is usually the real limit.

## Working on money makes you less interested in cleverness

I think payments changed how I think about engineering more than anything else.

When software is close to money, correctness becomes very concrete, very quickly.

A duplicated event is not just an interesting distributed systems bug. It can become a duplicate payout.

A race condition is not just an annoying edge case. It can become inconsistent financial state.

A migration is not just a deployment risk. It can affect merchants who did nothing wrong and now have to wait for engineers to untangle the problem.

Once you work in systems like that for a while, your taste changes.

You become less impressed by clever designs and more interested in designs that continue behaving predictably when things are going wrong.

You start liking boring systems more.

You start asking questions like:

- Can someone unfamiliar debug this at 3 AM?
- If one dependency slows down, does the system fail in a way we understand?
- If this job runs twice, what happens?
- If a message is delayed, retried, or replayed, is the result still correct?

Those questions are usually more useful than “is this elegant?”

I still appreciate elegant systems. But if I had to choose between elegant and predictable, I would take predictable every time.

## Rewrites feel cleaner than they really are

I think almost every engineer has had the same thought at some point: this system is messy, we should just rewrite it properly.

I have had that thought many times.

Sometimes rewrites are necessary. Some systems really are too awkward, too brittle, or too constrained by old decisions to keep extending comfortably.

But I also think engineers, especially younger engineers, often underestimate how much knowledge is hiding inside an ugly system.

Not just business logic. Operational knowledge too. All the strange edge cases. All the weird failure handling. All the ugly-looking checks that exist because something broke two years ago and nobody wanted to learn that lesson twice.

A mature system often looks worse than it is, because part of its shape comes from surviving reality.

A rewrite, on the other hand, often looks better than it is, because it has not met reality yet.

That does not mean “never rewrite.” It just means rewrites are not automatically the brave or correct choice. A lot of the time, the less exciting path — improving something piece by piece — is the safer and smarter one.

## AI made this lesson sharper for me

AI tools have made writing code much easier.

I use them a lot. They are useful. They help me move faster, especially when I already know roughly what I want and just want to get through the mechanical part faster.

But they have also made one thing much clearer to me.

Writing code was never the expensive part. Owning it is.

That gap matters even more now.

If code can be generated quickly, then the real skill is not producing more of it. The real skill is deciding what should exist, what should stay simple, what should be deleted, and what should never be built in the first place.

AI lowers the cost of typing.

It does not lower the cost of complexity.

If anything, it makes discipline more important, because now it is much easier to create a lot of code before you have fully earned the need for it.

## What I believe now

I used to think good engineering meant building powerful systems.

Now I think it more often means building systems that are easy to live with: easy to understand, easy to change, easy to operate, easy to trust.

There is a Dijkstra quote I keep coming back to:

> “If in physics there's something you don't understand, you can always hide behind the uncharted depths of nature. You can always blame God. You didn't make it so complex yourself. But if your program doesn't work, there is no one to hide behind. You cannot hide behind an obstinate nature. If it doesn't work, you've messed up.”

That feels a bit harsh, but I think there is something important in it.

A lot of software complexity is not inevitable. We create it. Sometimes because the problem is genuinely hard. Sometimes because we overdesigned. Sometimes because we kept adding without removing. Sometimes because we confused “more software” with “more progress.”

That is why I have become more suspicious of code over time.

Not because writing code is unimportant. It obviously is.

But because every new piece of code becomes something we now have to carry.

And the older I get, the more I think the job is not to write as much software as possible.

It is to solve the problem with as little software as we can get away with — while still being correct, clear, and reliable.

That, to me, feels closer to real engineering than anything I believed when I started.
