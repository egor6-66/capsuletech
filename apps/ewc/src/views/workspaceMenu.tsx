/**
 * WorkspaceMenu — dropdown в правой части header workspace.
 *
 * Состав:
 *   - Account / Logout — Dropdown.Item с tag 'logout'. Click перехватывает
 *     UiProxy → Feature `Workspace.onClick` → clear token + redirect /login.
 *   - Layout — `Ui.LayoutModeToggle` (toggle button).
 *   - Theme — `Ui.DarkModeToggle` (☀/☾) + `Ui.ThemePicker mode="sub"`
 *     (nested submenu со списком всех тем; ✓ маркер на текущей).
 *
 * `mode="sub"` на ThemePicker даёт `Dropdown.Sub`-рендер вместо own root —
 * корректно встраивается в parent menu без конфликта focus / outside-click.
 * Toggle'ы (Layout/Dark) — не оборачиваем в Dropdown.Item, иначе click
 * закроет parent menu.
 */
const WorkspaceMenu = View((Ui) => (
  <Ui.Dropdown modal={false}>
    <Ui.Dropdown.Trigger>Menu</Ui.Dropdown.Trigger>
    <Ui.Dropdown.Content>
      <Ui.Dropdown.Group>
        <Ui.Dropdown.Label>Account</Ui.Dropdown.Label>
        <Ui.Dropdown.Item meta={{ tags: ['logout'] }}>Logout</Ui.Dropdown.Item>
      </Ui.Dropdown.Group>
      <Ui.Dropdown.Separator />
      <Ui.Dropdown.Group>
        <Ui.Dropdown.Label>Layout</Ui.Dropdown.Label>
        <div class="px-2 py-1.5">
          <Ui.LayoutModeToggle />
        </div>
      </Ui.Dropdown.Group>
      <Ui.Dropdown.Separator />
      <Ui.Dropdown.Group>
        <Ui.Dropdown.Label>Theme</Ui.Dropdown.Label>
        <div class="px-2 py-1.5">
          <Ui.DarkModeToggle />
        </div>
        <Ui.ThemePicker mode="sub" />
      </Ui.Dropdown.Group>
    </Ui.Dropdown.Content>
  </Ui.Dropdown>
));

export default WorkspaceMenu;
