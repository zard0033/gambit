# Source Directory

When writing or editing game code in this directory, follow these standards.

## Coding Standards

- Gameplay values must be **data-driven** (external config files), never hardcoded
- Every new system needs a corresponding ADR in `docs/architecture/`
- Commits must reference the relevant story ID or design document

## Tests

Tests live in `tests/` — not in `src/`.
Every gameplay system should have unit tests covering its formulas and edge cases.

## Verification-Driven Development

Write tests first when adding gameplay systems.
For UI changes, verify with screenshots.
Compare expected output to actual output before marking work complete.
