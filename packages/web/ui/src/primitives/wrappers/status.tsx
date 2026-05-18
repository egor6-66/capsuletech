import { type ComponentStatus, STATUS_VARIABLES } from '@capsuletech/web-style';
import { children, type JSX } from 'solid-js';

interface StatusProps {
  status?: ComponentStatus;
  children: JSX.Element;
}

export const Status = (props: StatusProps) => {
  // Получаем реактивный доступ к детям
  const resolved = children(() => props.children);

  return (
    // Мы оборачиваем в span (или div) с display: contents,
    // чтобы он не влиял на верстку, но передавал CSS-переменную
    <div
      style={STATUS_VARIABLES[props.status || 'idle'] as JSX.CSSProperties}
      class="contents"
      data-slot="status-wrapper"
    >
      {resolved()}
    </div>
  );
};
