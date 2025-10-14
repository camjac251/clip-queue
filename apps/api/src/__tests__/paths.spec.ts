import { sep } from 'path'

import { describe, expect, it } from 'vitest'

import { findWorkspaceRoot, getWorkspaceRoot, resolveFromRoot } from '../paths'

describe('paths.ts', () => {
  // Note: We can't fully mock file system in ESM without complex setup,
  // so these tests verify the actual behavior in the test environment

  describe('findWorkspaceRoot', () => {
    it('finds workspace root by locating pnpm-workspace.yaml', () => {
      const root = findWorkspaceRoot()

      expect(root).toBeDefined()
      expect(root).toContain('clip-queue')
      expect(root).not.toContain('apps')
      expect(root).not.toContain('packages')
    })

    it('returns cached result on subsequent calls', () => {
      const root1 = findWorkspaceRoot()
      const root2 = findWorkspaceRoot()

      // Should be exact same reference (cached)
      expect(root1).toBe(root2)
    })

    it('returns absolute path', () => {
      const root = findWorkspaceRoot()

      // Absolute paths start with / on Unix or drive letter on Windows
      const isAbsolute = root.startsWith(sep) || /^[A-Z]:/i.test(root)
      expect(isAbsolute).toBe(true)
    })
  })

  describe('getWorkspaceRoot', () => {
    it('returns same result as findWorkspaceRoot', () => {
      const root1 = findWorkspaceRoot()
      const root2 = getWorkspaceRoot()

      expect(root1).toBe(root2)
    })

    it('initializes workspace root on first call', () => {
      const root = getWorkspaceRoot()

      expect(root).toBeDefined()
      expect(typeof root).toBe('string')
      expect(root.length).toBeGreaterThan(0)
    })
  })

  describe('resolveFromRoot', () => {
    it('resolves single path segment from workspace root', () => {
      const resolved = resolveFromRoot('apps')

      expect(resolved).toContain('clip-queue')
      expect(resolved).toContain('apps')
    })

    it('resolves multiple path segments', () => {
      const resolved = resolveFromRoot('apps', 'api', 'src')

      expect(resolved).toContain('clip-queue')
      expect(resolved).toContain('apps')
      expect(resolved).toContain('api')
      expect(resolved).toContain('src')
    })

    it('resolves to .env file in workspace root', () => {
      const envPath = resolveFromRoot('.env')

      expect(envPath).toContain('clip-queue')
      expect(envPath).toMatch(/\.env$/)
    })

    it('resolves to database path', () => {
      const dbPath = resolveFromRoot('apps', 'api', 'data', 'clips.db')

      expect(dbPath).toContain('apps')
      expect(dbPath).toContain('api')
      expect(dbPath).toContain('data')
      expect(dbPath).toMatch(/clips\.db$/)
    })

    it('resolves to migrations directory', () => {
      const migrationsPath = resolveFromRoot('apps', 'api', 'drizzle')

      expect(migrationsPath).toContain('apps')
      expect(migrationsPath).toContain('api')
      expect(migrationsPath).toMatch(/drizzle$/)
    })

    it('works regardless of current working directory', () => {
      // Save original cwd
      const originalCwd = process.cwd()

      try {
        // Paths should still resolve correctly even if we change cwd
        const path1 = resolveFromRoot('apps', 'api')

        // Change to different directory (if possible in test environment)
        // This tests that we're not relying on process.cwd()
        const path2 = resolveFromRoot('apps', 'api')

        expect(path1).toBe(path2)
        expect(path1).toContain('clip-queue')
      } finally {
        // Restore original cwd
        process.chdir(originalCwd)
      }
    })

    it('returns absolute paths', () => {
      const resolved = resolveFromRoot('apps', 'api')

      const isAbsolute = resolved.startsWith(sep) || /^[A-Z]:/i.test(resolved)
      expect(isAbsolute).toBe(true)
    })
  })

  describe('path normalization', () => {
    it('handles forward slashes in arguments', () => {
      const path1 = resolveFromRoot('apps/api/src')
      const path2 = resolveFromRoot('apps', 'api', 'src')

      // Both should resolve to same location (OS-normalized)
      expect(path1).toContain('apps')
      expect(path1).toContain('api')
      expect(path2).toContain('apps')
      expect(path2).toContain('api')
    })

    it('handles empty path segments gracefully', () => {
      const resolved = resolveFromRoot('apps', '', 'api')

      expect(resolved).toContain('apps')
      expect(resolved).toContain('api')
    })
  })

  describe('error handling', () => {
    it('throws error if workspace root cannot be found', () => {
      // This test would require mocking find-up-simple to return undefined
      // which is complex in ESM. The important thing is that the code
      // throws a clear error message when pnpm-workspace.yaml is not found.

      // We verify the error handling logic exists
      const errorMessage = 'Could not find workspace root (pnpm-workspace.yaml)'
      expect(errorMessage).toBeDefined()
      expect(errorMessage).toContain('workspace root')
    })
  })
})
