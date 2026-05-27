import { For, Show, splitProps } from 'solid-js';
import { DISCOVERED_THEMES, setTheme, useTheme } from '@capsuletech/web-style';

import { Dropdown } from '../../primitives/dropdown';
import type { IThemePickerProps } from './interfaces';

/**
 * Dropdown-based theme picker composite.
 *
 * Uses `Dropdown` primitive (Kobalte) for accessible open/close behaviour with
 * keyboard navigation. Theme state lives in the module-level signal from
 * web-style — no local signal needed.
 *
 * The active theme is marked with a checkmark (✓) inside the dropdown list.
 *
 * @example
 * ```tsx
 * // Standalone — own dropdown root (default):
 * <ThemePicker />
 * <ThemePicker themes={['black', 'zen']} onChange={(t) => console.log(t)} />
 *
 * // Sub mode — inside a parent Dropdown.Content:
 * <Dropdown>
 *   <Dropdown.Trigger>Menu</Dropdown.Trigger>
 *   <Dropdown.Content>
 *     <Dropdown.Item>Some action</Dropdown.Item>
 *     <ThemePicker mode="sub" />
 *   </Dropdown.Content>
 * </Dropdown>
 * ```
 */
export const ThemePicker = (props: IThemePickerProps) => {
  const [local] = splitProps(props, ['themes', 'target', 'onChange', 'triggerLabel', 'class', 'mode']);
  const current = useTheme();
  const themes = () => local.themes ?? DISCOVERED_THEMES;
  const mode = () => local.mode ?? 'standalone';

  // Shared item list — reused in both render branches.
  const renderItems = () => (
    <For each={themes()}>
      {(name) => (
        <Dropdown.Item
          onSelect={() => {
            setTheme(name, local.target);
            local.onChange?.(name);
          }}
        >
          <span class="inline-block w-4 text-primary">
            <Show when={current() === name}>&#x2713;</Show>
          </span>
          <span>{name}</span>
        </Dropdown.Item>
      )}
    </For>
  );

  // Standalone — own Dropdown root (original behaviour, default).
  if (mode() === 'standalone') {
    return (
      <Dropdown>
        <Dropdown.Trigger
          class={`inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring ${local.class ?? ''}`}
        >
          <Show
            when={local.triggerLabel !== undefined}
            fallback={
              <>
                <span class="text-muted-foreground">Theme:</span>
                <span>{current()}</span>
              </>
            }
          >
            {local.triggerLabel}
          </Show>
          <span class="text-muted-foreground" aria-hidden="true">
            &#9662;
          </span>
        </Dropdown.Trigger>
        <Dropdown.Content>{renderItems()}</Dropdown.Content>
      </Dropdown>
    );
  }

  // Sub mode — plugs into parent Dropdown via Sub API (no conflict with parent open state).
  return (
    <Dropdown.Sub>
      <Dropdown.SubTrigger class={local.class}>
        <Show
          when={local.triggerLabel !== undefined}
          fallback={
            <>
              <span class="text-muted-foreground">Theme:</span>
              <span class="ml-1.5">{current()}</span>
            </>
          }
        >
          {local.triggerLabel}
        </Show>
        <span class="ml-auto text-muted-foreground" aria-hidden="true">
          &#9658;
        </span>
      </Dropdown.SubTrigger>
      <Dropdown.SubContent>{renderItems()}</Dropdown.SubContent>
    </Dropdown.Sub>
  );
};
