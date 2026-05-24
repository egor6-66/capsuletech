const Header = Widget((Ui) => (
  <div class="w-full flex items-center justify-between px-layout py-tight border-b border-border gap-cell">
    {/* Brand */}
    <div class="flex items-center gap-cell-tight">
      <span class="text-lg font-semibold tracking-tight">CAPSULE SPACE</span>
    </div>

    {/* Navigation */}
    <Shapes.Navigation.Routes tags={['main']} />

    {/* Actions */}
    <div class="flex items-center gap-cell-tight">
      <Ui.ThemeSwitcher />
      <Ui.DarkModeToggle />
      <Widgets.Layout.WindowControls />
    </div>
  </div>
));

export default Header;
