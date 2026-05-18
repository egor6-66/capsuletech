import { Tabs } from '@kobalte/core/tabs';
import { For, createSignal } from 'solid-js';
import { CustomPanel } from './panels/custom';
import { ErrorsPanel } from './panels/errors';
import { NetworkPanel } from './panels/network';
import { RuntimePanel } from './panels/runtime';
import { VitalsPanel } from './panels/vitals';
import { persistTab, readPersistedTab, ProfilerWindow } from './primitives/window';

type TabKey = 'vitals' | 'runtime' | 'network' | 'errors' | 'custom';

interface ITab {
  key: TabKey;
  label: string;
  Panel: () => ReturnType<typeof VitalsPanel>;
}

const TABS: readonly ITab[] = [
  { key: 'vitals', label: 'Vitals', Panel: VitalsPanel },
  { key: 'runtime', label: 'Runtime', Panel: RuntimePanel },
  { key: 'network', label: 'Network', Panel: NetworkPanel },
  { key: 'errors', label: 'Errors', Panel: ErrorsPanel },
  { key: 'custom', label: 'Custom', Panel: CustomPanel },
];

export function ProfilerDashboard() {
  const initialTab = (readPersistedTab() as TabKey | undefined) ?? 'vitals';
  const [activeTab, setActiveTab] = createSignal<TabKey>(initialTab);

  const onTabChange = (value: string) => {
    setActiveTab(value as TabKey);
    persistTab(value);
  };

  return (
    <ProfilerWindow tabKey={activeTab()} title="🚀 PROFILER">
      <Tabs value={activeTab()} onChange={onTabChange}>
        <Tabs.List
          style={{
            display: 'flex',
            gap: '4px',
            'margin-bottom': '10px',
            'border-bottom': '1px solid #333',
            'padding-bottom': '6px',
          }}
        >
          <For each={TABS}>
            {(tab) => (
              <Tabs.Trigger
                value={tab.key}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: activeTab() === tab.key ? '#00d4ff' : '#aaa',
                  'font-weight': activeTab() === tab.key ? 'bold' : 'normal',
                  'font-family': 'inherit',
                  'font-size': '10px',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  'border-radius': '4px',
                  'border-bottom':
                    activeTab() === tab.key ? '2px solid #00d4ff' : '2px solid transparent',
                }}
              >
                {tab.label}
              </Tabs.Trigger>
            )}
          </For>
        </Tabs.List>
        <For each={TABS}>
          {(tab) => (
            <Tabs.Content value={tab.key}>
              <tab.Panel />
            </Tabs.Content>
          )}
        </For>
      </Tabs>
    </ProfilerWindow>
  );
}
