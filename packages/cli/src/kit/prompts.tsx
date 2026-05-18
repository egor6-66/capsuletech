/** @jsxImportSource react */
import { Box, render, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useState } from 'react';

export interface SelectOption<T> {
  value: T;
  label: string;
  hint?: string;
}

/**
 * TUI работает на ink, поэтому интерактивные промпты тоже на ink —
 * иначе @clack/prompts и ink дерутся за stdin и стрелки перестают
 * переключать пункты после возврата из меню.
 */

const SelectPrompt = <T,>({
  message,
  options,
  onResolve,
}: {
  message: string;
  options: SelectOption<T>[];
  onResolve: (value: T | null) => void;
}) => {
  const { exit } = useApp();
  const [idx, setIdx] = useState(0);

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === 'c')) {
      onResolve(null);
      exit();
      return;
    }
    if (key.return) {
      onResolve(options[idx]?.value ?? null);
      exit();
      return;
    }
    if (key.upArrow || input === 'k') {
      setIdx((i) => (i - 1 + options.length) % options.length);
      return;
    }
    if (key.downArrow || input === 'j') {
      setIdx((i) => (i + 1) % options.length);
      return;
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold>{message}</Text>
      {options.map((o, i) => {
        const sel = i === idx;
        return (
          <Box key={String(o.value)}>
            <Text color={sel ? 'cyan' : undefined}>
              {sel ? '❯ ' : '  '}
              {o.label}
            </Text>
            {o.hint ? <Text dimColor>{`  — ${o.hint}`}</Text> : null}
          </Box>
        );
      })}
    </Box>
  );
};

export const inkSelect = <T,>(message: string, options: SelectOption<T>[]): Promise<T | null> =>
  new Promise((resolve) => {
    let captured: T | null = null;
    const inst = render(
      <SelectPrompt<T>
        message={message}
        options={options}
        onResolve={(v) => {
          captured = v;
        }}
      />,
    );
    inst.waitUntilExit().then(() => {
      inst.clear();
      resolve(captured);
    });
  });

const InputPrompt = ({
  message,
  placeholder,
  validate,
  onResolve,
}: {
  message: string;
  placeholder?: string;
  validate?: (v: string) => string;
  onResolve: (value: string | null) => void;
}) => {
  const { exit } = useApp();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string>('');

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === 'c')) {
      onResolve(null);
      exit();
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold>{message}</Text>
      <Box>
        <Text color="cyan">❯ </Text>
        <TextInput
          value={value}
          placeholder={placeholder}
          onChange={(v) => {
            setValue(v);
            if (error) setError('');
          }}
          onSubmit={(v) => {
            const err = validate?.(v) ?? '';
            if (err) {
              setError(err);
              return;
            }
            onResolve(v);
            exit();
          }}
        />
      </Box>
      {error ? <Text color="red">{`  ${error}`}</Text> : null}
    </Box>
  );
};

export const inkInput = (
  message: string,
  placeholder?: string,
  validate?: (v: string) => string,
): Promise<string | null> =>
  new Promise((resolve) => {
    let captured: string | null = null;
    const inst = render(
      <InputPrompt
        message={message}
        placeholder={placeholder}
        validate={validate}
        onResolve={(v) => {
          captured = v;
        }}
      />,
    );
    inst.waitUntilExit().then(() => {
      inst.clear();
      resolve(captured);
    });
  });

const ConfirmPrompt = ({
  message,
  onResolve,
}: {
  message: string;
  onResolve: (value: boolean | null) => void;
}) => {
  const { exit } = useApp();
  const [yes, setYes] = useState(true);

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === 'c')) {
      onResolve(null);
      exit();
      return;
    }
    if (key.return) {
      onResolve(yes);
      exit();
      return;
    }
    if (input === 'y' || input === 'Y') {
      onResolve(true);
      exit();
      return;
    }
    if (input === 'n' || input === 'N') {
      onResolve(false);
      exit();
      return;
    }
    if (key.leftArrow || key.rightArrow || key.tab || input === 'h' || input === 'l') {
      setYes((v) => !v);
    }
  });

  return (
    <Box>
      <Text bold>{`${message} `}</Text>
      <Text color={yes ? 'cyan' : undefined}>{yes ? '● Да' : '○ Да'}</Text>
      <Text>{'  '}</Text>
      <Text color={!yes ? 'cyan' : undefined}>{!yes ? '● Нет' : '○ Нет'}</Text>
    </Box>
  );
};

export const inkConfirm = (message: string): Promise<boolean | null> =>
  new Promise((resolve) => {
    let captured: boolean | null = null;
    const inst = render(
      <ConfirmPrompt
        message={message}
        onResolve={(v) => {
          captured = v;
        }}
      />,
    );
    inst.waitUntilExit().then(() => {
      inst.clear();
      resolve(captured);
    });
  });
