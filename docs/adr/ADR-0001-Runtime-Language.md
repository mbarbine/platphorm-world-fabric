# ADR-0001: Runtime Language and Ownership Boundaries

**Context**: Launch required in 128 days.
**Decision**: We proceed with Node.js/TypeScript for the reference runtime to consolidate the stack, maintain velocity, and prove the architecture before optimizing specific components in Go.
**Consequences**: The Node.js event loop requires strict fixed-step execution and worker thread distribution for horizontal scaling of sessions.
