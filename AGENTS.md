# Coding Rules

This document outlines the coding standards, guidelines, and behavioral rules for developers and AI agents working on this project.

## 1. Comments and Documentation
- **Always write comments and documentation in English.**
- Keep comments concise and focus on explaining the *why* rather than the *what*, unless the code is particularly complex.
- Document public APIs, structures, functions, and any non-trivial logic.

## 2. Code Quality and Style
- **Consistency**: Match the style and patterns of the existing codebase.
- **Simplicity**: Write simple, self-explanatory, and maintainable code. Refactor complex functions into smaller, modular ones.
- **Modern Standards**: Use modern syntax and language features.

## 3. Language-Specific Guidelines
### TypeScript / JavaScript (Frontend)
- Use TypeScript for all new files to ensure type safety.
- Avoid using `any` whenever possible. Define proper interfaces or types.
- Keep components small, reusable, and focused on a single responsibility.
- Follow Biome standards and run `npm run check` (or `npx biome check --write .`) to format, sort imports, and lint frontend code.

### Rust (Backend / Tauri)
- Follow standard Rust idiomatic style and run `cargo fmt` to format code.
- Avoid using `unwrap()` or `expect()` in production code. Handle errors gracefully using pattern matching, the `?` operator, or custom error handling.
- Ensure there are no compilation warnings, and follow recommendations from Clippy.

## 4. Workflows and Git
- **Commit Messages**: Write commit messages in English. Keep them clear, concise, and descriptive.
- Keep pull requests and changesets focused on a single logical change.

## 5. Verification and Testing
- **Verification**: Test changes manually or write automated tests to verify new features or bug fixes.
- **Builds**: Ensure the project compiles and builds successfully before finishing any task.
