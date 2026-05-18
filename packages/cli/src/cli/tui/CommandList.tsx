/** @jsxImportSource react */
import { Box, Text } from 'ink';
import stringWidth from 'string-width';
import type { Command } from '../../commands';
import { ICONS } from './icons';
import { theme } from './theme';

interface CommandListProps {
  items: Command[];
  selectedIndex: number;
  width: number;
  viewportRows: number;
}

const padToWidth = (s: string, target: number): string => {
  const w = stringWidth(s);
  if (w >= target) return s;
  return s + ' '.repeat(target - w);
};

/** Сдвигаем окно так, чтобы активный item был по центру (если влезает). */
const computeWindow = (
  total: number,
  selected: number,
  capacity: number,
): { start: number; end: number } => {
  if (total <= capacity) return { start: 0, end: total };
  const half = Math.floor(capacity / 2);
  let start = selected - half;
  if (start < 0) start = 0;
  let end = start + capacity;
  if (end > total) {
    end = total;
    start = end - capacity;
  }
  return { start, end };
};

export const CommandList = ({ items, selectedIndex, width, viewportRows }: CommandListProps) => {
  // Внутри Box paddingX={1} — реальная ширина строки ровно `width - 2`.
  const innerWidth = Math.max(4, width - 2);
  const { start, end } = computeWindow(items.length, selectedIndex, viewportRows);
  const visible = items.slice(start, end);
  const hasAbove = start > 0;
  const hasBelow = end < items.length;

  return (
    <Box flexDirection="column" width={width} height={viewportRows} paddingX={1} paddingY={0}>
      {items.length === 0 ? (
        <Text color={theme.textDim} italic>
          {padToWidth('Пусто в этом контексте', innerWidth)}
        </Text>
      ) : (
        visible.map((cmd, idx) => {
          const absIdx = start + idx;
          const active = absIdx === selectedIndex;
          const isFirst = idx === 0 && hasAbove;
          const isLast = idx === visible.length - 1 && hasBelow;
          const prefix = active
            ? `${ICONS.pointerActive} `
            : isFirst
              ? `${ICONS.pointerUp} `
              : isLast
                ? `${ICONS.pointerDown} `
                : '  ';
          const raw = prefix + cmd.label;
          return (
            <Text key={cmd.id} color={active ? theme.brand : theme.textDim} bold={active}>
              {padToWidth(raw, innerWidth)}
            </Text>
          );
        })
      )}
    </Box>
  );
};
