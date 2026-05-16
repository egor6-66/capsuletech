import type { IResizableSlotConfig } from './interfaces';

/**
 * Identity-helper для object-формы слота. Нужен только ради автокомплита TS:
 * inline-форма `{ children, resizable, ... }` лежит в union с `JSX.Element`, и
 * TS внутри пустого `{}` не подсказывает поля `IResizableSlotConfig`.
 *
 * @example
 * ```tsx
 * <Ui.Layout
 *   variant="dashboard"
 *   slots={{
 *     sidebar: Ui.Layout.slot({ children: <Sidebar />, resizable: true, initialSize: 0.2 }),
 *     main:    Ui.Layout.slot({ children: <Main />,    resizable: true }),
 *   }}
 * />
 * ```
 */
export const slot = <T extends IResizableSlotConfig>(config: T): T => config;
