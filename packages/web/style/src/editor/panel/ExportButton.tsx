import { Check, Copy } from 'lucide-solid';
import { createSignal, Show } from 'solid-js';
import { copyTheme } from '../export';
import type { ITheme } from '../types';

interface IProps {
  theme: ITheme;
}

export const ExportButton = (props: IProps) => {
  const [copied, setCopied] = createSignal(false);

  const onCopy = async () => {
    await copyTheme(props.theme);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      class="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground text-sm font-medium px-3 py-2 shadow-sm hover:opacity-90 transition-opacity"
    >
      <Show when={copied()} fallback={<Copy size={14} />}>
        <Check size={14} />
      </Show>
      {copied() ? 'Скопировано' : 'Скопировать CSS'}
    </button>
  );
};
