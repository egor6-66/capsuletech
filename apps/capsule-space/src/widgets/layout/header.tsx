const Header = Widget((Ui) => (
  <div class="h-full w-full flex items-center justify-between px-layout py-component border-b border-border gap-cell">
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
    </div>
  </div>
));

export default Header;
