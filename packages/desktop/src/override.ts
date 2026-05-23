import type { IDesktopConfig } from './types';

interface OverrideDevInput {
  kind: 'dev';
  app: string;
  devUrl: string;
  desktop: IDesktopConfig;
  version: string;
}

interface OverrideBuildInput {
  kind: 'build';
  app: string;
  dist: string;
  desktop: IDesktopConfig;
  version: string;
}

export type OverrideInput = OverrideDevInput | OverrideBuildInput;

/**
 * Pure function — no I/O. Builds the JSON-ready object for `.tauri.<app>.json`
 * override that gets passed to `tauri dev|build --config <path>`.
 *
 * Migrated from scripts/desktop.mjs:74-110, extended with IDesktopConfig.window
 * and IDesktopConfig.icon support (new functionality per ADR 017).
 */
export function buildOverride(input: OverrideInput): Record<string, unknown> {
  const { desktop, version } = input;

  const windowWidth = desktop.window?.width ?? 1280;
  const windowHeight = desktop.window?.height ?? 800;
  const windowMinWidth = desktop.window?.minWidth ?? 800;
  const windowMinHeight = desktop.window?.minHeight ?? 600;
  const windowTitle = desktop.window?.title ?? desktop.productName;

  const override: Record<string, unknown> = {
    productName: desktop.productName,
    identifier: desktop.identifier,
    version,
    app: {
      windows: [
        {
          label: 'main',
          title: windowTitle,
          width: windowWidth,
          height: windowHeight,
          minWidth: windowMinWidth,
          minHeight: windowMinHeight,
        },
      ],
    },
  };

  if (input.kind === 'dev') {
    override.build = {
      devUrl: input.devUrl,
      // Must be empty — Tauri otherwise tries to run its own Vite.
      // Capsule controls Vite via @capsuletech/vite-builder (grabla #7).
      beforeDevCommand: '',
      beforeBuildCommand: '',
    };
  } else {
    override.build = {
      // Windows backslash → forward slash for Tauri (grabla from scripts/desktop.mjs:104)
      frontendDist: input.dist.replace(/\\/g, '/'),
      beforeBuildCommand: '',
      beforeDevCommand: '',
    };
    override.bundle = { active: true };
  }

  // Optional icon override — only set if caller provides a path.
  // If not set, the base tauri.conf.json icons remain in effect.
  if (desktop.icon !== undefined) {
    const existingBundle = override.bundle as Record<string, unknown> | undefined;
    override.bundle = {
      ...(existingBundle ?? {}),
      icon: [desktop.icon],
    };
  }

  return override;
}
