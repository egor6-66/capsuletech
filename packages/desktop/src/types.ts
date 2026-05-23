export interface IDesktopConfig {
  productName: string;
  identifier: string;
  icon?: string;
  window?: {
    width?: number;
    height?: number;
    minWidth?: number;
    minHeight?: number;
    title?: string;
  };
}

export interface RunDevOptions {
  app: string;
  devUrl: string;
  desktop: IDesktopConfig;
  cwd?: string;
}

export interface RunBuildOptions {
  app: string;
  dist: string;
  desktop: IDesktopConfig;
  version: string;
  cwd?: string;
}
