# ADR-0004: Authority and Consistency Model

**Context**: Need strict rules on how game state mutations occur.
**Decision**: 
- Clients send Intent (Inputs) ONLY.
- Server is the Single-Writer authority for Game State.
- Ownership bounded by Fencing Tokens.
**Consequences**: Eliminates peer-to-peer trust. Increases server CPU overhead.
