export { QueryClient, createQueryClient, getQueryClient, setQueryClient } from './client';
export { defaultFetcher } from './fetcher';
export type {
  Fetcher,
  FetchOptions,
  HttpMethod,
  MutateOptions,
  QueryClientOptions,
  QueryKey,
  QueryState,
  RequestConfig,
  RequestInterceptor,
  ResponseInterceptor,
  ErrorInterceptor,
} from './types';

export {
  ApiError,
  HttpError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ServerError,
  NetworkError,
  TimeoutError,
  ValidationError,
} from './errors';

export { defineEndpoint } from './endpoint';
export type { Endpoint, EndpointConfig, InferInput, InferOutput } from './endpoint';

export { compose } from './pipeline';
export type { ApiContext, Middleware } from './pipeline';

export { createApi, setApiClient, getApiClient } from './createApi';
export type {
  ApiConfig,
  ApiConfigInput,
  EndpointsRegistry,
  InferApi,
  MwToolbox,
  RegistryNode,
} from './createApi';

export * as mw from './middleware';
