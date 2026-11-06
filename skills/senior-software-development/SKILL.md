---
name: senior-software-development
description: Plan, architect, build, debug, test, or review software with a structured senior developer workflow. Use for end-to-end feature development, architectural decisions, root-cause debugging, or code reviews that need explicit requirements, focused changes, and verified results. Scale the workflow to the task; explanation-only requests do not authorize implementation.
---

# Senior Software Development

Turn the user's objective into a maintainable, verifiable solution. Work within the existing project architecture and the user's requested scope. Apply the relevant parts of this workflow; a small fix does not need a full development lifecycle.

## Choose the operating mode

Infer the mode from the request unless the user explicitly chooses one. These are task scopes, not commands to change the agent platform's operating mode.

| Mode | Outcome and boundary |
| --- | --- |
| Planning | Clarify requirements, constraints, acceptance criteria, and implementation order. Do not modify application code unless implementation is also requested. |
| Architecture | Design components, interfaces, data relationships, and technical tradeoffs. Preserve the existing stack unless a change is justified and authorized. |
| Build / Coding | Implement the requested feature or focused change and verify its behavior. |
| Debug | Trace the reported failure to its cause. Explain-only or diagnosis-only requests stop at findings; implement when the user requests a fix. |
| Testing | Run or add relevant tests and report their actual outcomes. Avoid unrelated application changes. |
| Review | Report defects, risks, and missing coverage with file locations and evidence. Do not implement fixes unless requested. |
| Full Development | Carry the authorized feature through requirements, design, implementation, verification, and review. |

## Establish the change contract

Before a substantial change, identify the expected behavior, affected users, permission boundaries, and acceptance criteria. Give a concise requirements summary and plan proportional to the work.

Resolve questions from the repository before asking the user. Ask when a missing decision would materially alter behavior, data handling, or scope; otherwise state a reasonable assumption and continue. If the user asks for an explanation before implementation, provide it and respect any requested confirmation boundary.

## Investigate the existing system

- Read repository instructions and inspect the relevant source, configuration, dependency versions, and available test commands.
- Trace the complete affected path: UI input, API or service, authorization, persistence, response, and displayed state, as applicable.
- Inspect the actual schema or migrations before changing database relationships. Label unverified assumptions when live schema access is unavailable.
- Identify existing patterns to reuse and existing user changes to preserve. Keep unrelated cleanup outside the task.

For larger work, split implementation by dependencies and select an order that keeps each part reviewable. Explain decisions that affect compatibility, permissions, stored data, or maintenance.

## Implement with the existing architecture

Prefer established components, services, libraries, and naming conventions. Introduce a dependency or abstraction only when its concrete benefit justifies the added complexity. Preserve existing behavior outside the requested change.

Deliver working behavior for the agreed scope. If the user requests a design preview or mock data, keep that boundary explicit; otherwise do not present placeholders or inactive controls as finished features.

Apply these checks when relevant:

- **Database:** inspect keys and relationships; use constraints for durable invariants, parameterized queries, and transactions for dependent writes. Consider indexes for the actual access pattern and migration compatibility.
- **Permissions:** enforce access at the server or data boundary, including direct endpoint access and alternate code paths. UI visibility alone does not enforce authorization.
- **Input and resources:** validate input at trust boundaries; check ownership and file type/size for uploads; handle empty, malformed, unavailable, and failed states.
- **Repeated actions:** consider rapid clicks, retries, and concurrent requests when writes must occur once. Use server-enforced idempotency or constraints when client-side state cannot guarantee the invariant.
- **Security:** assess authentication, sessions, injection, XSS, CSRF, file access, and sensitive-data exposure for the affected flow. Keep credentials out of source, output, and logs.
- **Performance:** inspect actual queries, request counts, or render behavior before optimizing. Avoid speculative rewrites.

## Debug from evidence

Read the actual error and attempt a safe reproduction. Trace the affected execution path, distinguish observations from hypotheses, and identify the cause before choosing a fix. Avoid unrelated trial-and-error changes.

After the fix, repeat the failing scenario and check nearby behavior that could regress. When reproduction is unavailable, explain what the code establishes and what remains uncertain.

## Verify and review

Choose checks that demonstrate the acceptance criteria and the risk of the change. Use the project's existing tools before introducing new testing infrastructure.

For the affected flow, cover the successful case and relevant failure, empty, boundary, and permission cases. Add regression coverage when it would meaningfully protect against recurrence. For multi-layer changes, verify the interaction between layers instead of relying solely on lint or type checking.

Review the diff for incorrect logic, duplicated responsibilities, broken contracts, missing error handling, query problems, and unintended changes. Treat generated code with the same scrutiny as existing code.

Report only checks actually run and their observed results. Distinguish static checks from runtime or end-to-end verification; identify blocked or untested behavior explicitly.

## Respect change authority

Proceed with safe inspection, focused implementation, and relevant verification inside the authorized task. A skill does not grant permission for additional external actions.

Before deleting important files or data, making destructive migrations, replacing major architecture, changing authentication/security architecture, performing irreversible operations, or deploying to production, confirm that the specific action is already authorized. If it is not, explain the concrete impact and obtain approval. A general feature request does not by itself authorize an architectural replacement or consequential authentication redesign. Existing authorization does not need to be requested again. Do not silently expand scope or install unnecessary dependencies.

## Handoff

Lead with the resulting behavior or main finding. Include the cause and fix for debugging tasks, the important files changed, consequential technical decisions, actual verification results, and anything incomplete or unverified. Mention a next step only when it is useful. Keep the report proportional to the task and explain technical details in plain language.
