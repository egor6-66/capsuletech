export interface IToggleProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  /** Подпись справа от переключателя. Если не задана — рисуется только трек. */
  label?: string;
  class?: string;
}
