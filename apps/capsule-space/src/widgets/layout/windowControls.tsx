/**
 * Widget: WindowControls
 * ----------------------
 * Кастомные кнопки titlebar'а — minimize / maximize / close.
 * Композиция Controller (route events) + Feature (Tauri side effects).
 *
 * Layout: 3 ghost-button'а side-by-side. Используются в Header (actions zone).
 * При decorations: false в Tauri config — заменяют native titlebar buttons.
 */
const WindowControls = Widget((Ui) => (
  <Controllers.WindowControls>
    <Features.Desktop>
      <div class="flex items-center gap-cell-tight">
        <Ui.Button meta={{ tags: ['minimize'] }} variant="ghost" size="sm" aria-label="Minimize">
          −
        </Ui.Button>
        <Ui.Button meta={{ tags: ['maximize'] }} variant="ghost" size="sm" aria-label="Maximize">
          □
        </Ui.Button>
        <Ui.Button meta={{ tags: ['close'] }} variant="ghost" size="sm" aria-label="Close">
          ×
        </Ui.Button>
      </div>
    </Features.Desktop>
  </Controllers.WindowControls>
));

export default WindowControls;
