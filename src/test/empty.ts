// Test stub for the `server-only` marker package. Vitest runs under Node
// without the react-server resolver condition, so `import "server-only"` would
// throw; this alias makes it a harmless no-op in tests. See vitest.config.ts.
export {};
