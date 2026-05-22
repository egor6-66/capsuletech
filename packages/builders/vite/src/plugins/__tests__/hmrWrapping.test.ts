import { describe, expect, it } from 'vitest';
import { HMRWrappingPlugin } from '../hmrWrapping';
import type { Plugin } from 'vite';

/**
 * Tests for HMRWrappingPlugin AST transform.
 *
 * Key invariants:
 *  - RENDER wrappers (View/Widget/Page/Controller/Feature/Shape) are wrapped
 *    into arrow functions so Solid HMR can swap the component reference.
 *  - CONFIG wrappers (Entity) are intentionally NOT transformed.
 *    Entity(...) returns Object.freeze({schema, defaults}) — calling that
 *    result as a function would throw TypeError at runtime.
 */

function transform(code: string, id = 'test.tsx'): string | null {
  const plugin = HMRWrappingPlugin() as Plugin & {
    transform: (code: string, id: string) => { code: string } | null;
  };
  const result = plugin.transform(code, id);
  return result ? result.code : null;
}

// ---------------------------------------------------------------------------
// RENDER wrappers — must be transformed
// ---------------------------------------------------------------------------

describe('RENDER wrapper transforms', () => {
  const renderWrappers = ['View', 'Widget', 'Page', 'Controller', 'Feature', 'Shape'] as const;

  for (const wrapper of renderWrappers) {
    it(`transforms const X = ${wrapper}(...)`, () => {
      const code = `const Login = ${wrapper}((Ui) => <div />);`;
      const result = transform(code);

      expect(result).not.toBeNull();
      // Must contain the arrow-function wrapping pattern
      expect(result).toContain('props');
      expect(result).toContain(`${wrapper}(`);
      // The result is called with props: Wrapper(...)(props)
      expect(result).toMatch(/\(props\)\s*=>/);
    });
  }

  it('adds export default when absent', () => {
    const code = `const Hello = View((Ui) => <div />);`;
    const result = transform(code);

    expect(result).toContain('export default Hello');
  });

  it('does NOT add export default when already present', () => {
    const code = [
      `const Hello = View((Ui) => <div />);`,
      `export default Hello;`,
    ].join('\n');
    const result = transform(code);

    // Should still transform
    expect(result).not.toBeNull();
    // But should not duplicate the export
    const exportCount = (result ?? '').split('export default').length - 1;
    expect(exportCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// CONFIG wrappers — must NOT be transformed
// ---------------------------------------------------------------------------

describe('CONFIG wrapper skips', () => {
  it('does NOT transform const X = Entity(...)', () => {
    const code = `const Users = Entity((z) => ({ schema: z.object({}), defaults: [] }));`;
    const result = transform(code);

    // Plugin should return null (no modification) for Entity
    expect(result).toBeNull();
  });

  it('Entity result retains plain-object shape (no arrow wrapper)', () => {
    // Simulate: if it were mistakenly transformed, it would become
    // `(props) => Entity(...)(props)` — a function, not the frozen config.
    // We verify the original code is returned unchanged.
    const code = `const Users = Entity((z) => ({ schema: z.object({}), defaults: [] }));`;
    const result = transform(code);

    // null means the plugin did not touch the code — Vite will pass it through
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Non-.tsx/.ts files — plugin must be a no-op
// ---------------------------------------------------------------------------

describe('file filter', () => {
  it('ignores .css files', () => {
    const code = `const Page = Page((Ui) => <div />);`;
    const result = transform(code, 'styles.css');
    expect(result).toBeNull();
  });

  it('processes .ts files', () => {
    const code = `const Ctrl = Controller((services) => ({ initial: 'idle', states: {} }));`;
    const result = transform(code, 'ctrl.ts');
    expect(result).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Shape — must remain in render list
// ---------------------------------------------------------------------------

describe('Shape is a render wrapper', () => {
  it('transforms const X = Shape(...)', () => {
    const code = `const UserRow = Shape((z, ui) => ({ schema: z.object({}) }));`;
    const result = transform(code, 'userRow.tsx');

    expect(result).not.toBeNull();
    expect(result).toMatch(/\(props\)\s*=>/);
    expect(result).toContain('Shape(');
  });
});
