import buildUrl from 'build-url';
import { ComponentGetFailedError, ComponentIntegrityCheckFailed } from './errors';
import { StorageController } from './utils/StorageController';

export interface Mismatches {
  [dependency: string]: {
    host: string;
    component: string;
  };
}

export type Issues = {
  [component: string]: {
    mismatches: Mismatches;
    version: string;
  };
};

export enum FailedRegisterStrategy {
  UseCache = 'UseCache',
  Ignore = 'Ignore'
}

interface FailedRegisterPolicy {
  retries: number;
  retryRate: number;
  strategy: FailedRegisterStrategy;
}

export type CacheOptions = StorageController | Storage | { storage: Storage; prefix?: string };
export type Dependencies = {
  versions: Record<string, string>;
  resolvers: Record<string, any>;
};

export interface InitOptions {
  url: string;
  cache: CacheOptions;
  dependencies: Dependencies;
  fetcher?: WindowOrWorkerGlobalScope['fetch'];
  globals?: Record<string, any>;
  checkCodeIntegrity?: (code: string) => Promise<boolean>;
  failedRegisterPolicy?: FailedRegisterPolicy;
}

export interface Options {
  componentVersion?: string;
  getLatest?: boolean;
  globals?: Record<string, any>;
}

interface RegisterHostResponse {
  id: string;
  issues: Issues;
  index?: Record<string, string>;
}

const enum ReadyState {
  Initializing,
  Ready,
  OfflineWithCache,
  OfflineIgnore
}

export const filterDependencies = ({ resolvers, versions }: Dependencies): Dependencies => {
  const names = Object.keys(resolvers).filter(name => {
    if (versions[name]) {
      return true;
    }

    console.warn(`Missing version specifier for ${name}`);
    return false;
  });

  return {
    versions: names.reduce((sum, name) => ({ ...sum, [name]: versions[name] }), {}),
    resolvers: names.reduce((sum, name) => ({ ...sum, [name]: resolvers[name] }), {})
  };
};

export class DynamicoClient {
  id: string = '';
  url: string;
  dependencies: Dependencies;
  cache: StorageController;
  fetcher: WindowOrWorkerGlobalScope['fetch'];
  globals: Record<string, any>;
  index: Record<string, string> = {};
  checkCodeIntegrity?: (string) => Promise<boolean>;
  failedRegisterPolicy: FailedRegisterPolicy;
  private readyState: ReadyState = ReadyState.Initializing;
  private requestQueue: Function[] = [];

  constructor(options: InitOptions) {
    this.url = options.url;
    this.cache =
      options.cache instanceof StorageController
        ? options.cache
        : new StorageController(options.cache.prefix || '@dynamico', options.cache.storage || options.cache);
    this.dependencies = filterDependencies(options.dependencies);
    this.globals = options.globals || {};
    this.checkFetcher(options.fetcher);

    this.fetcher = options.fetcher || fetch.bind(window);
    this.checkCodeIntegrity = options.checkCodeIntegrity;
    this.failedRegisterPolicy = options.failedRegisterPolicy
      ? {
          ...options.failedRegisterPolicy,
          retries: Math.max(options.failedRegisterPolicy.retries, 0)
        }
      : { retries: 0, retryRate: 0, strategy: FailedRegisterStrategy.Ignore };
    this.initialize(this.failedRegisterPolicy);
  }

  private handleIssues(issues: Issues): void {
    Object.entries(issues).forEach(([comp, { version, mismatches }]) =>
      Object.entries(mismatches).forEach(([dependency, { host, component }]) =>
        console.warn(
          `${comp}@${version} requires ${dependency}@${component} but host provides ${host}. Please consider upgrade to version ${component}`
        )
      )
    );
  }

  private checkFetcher(fetcher?: WindowOrWorkerGlobalScope['fetch']) {
    if (!fetcher && typeof fetch === 'undefined') {
      let library: string = 'unfetch';

      if (typeof window === 'undefined') {
        library = 'node-fetch';
      }

      throw new Error(`
        fetch is not found globally and no fetcher passed, to fix pass a fetch for 
        your environment like https://www.npmjs.com/package/${library}.
      `);
    }
  }

  private async register(): Promise<RegisterHostResponse> {
    const url = buildUrl(this.url, {
      path: '/host/register'
    });

    return await this.fetcher(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(this.dependencies.versions)
    }).then((res: Response) => res.json());
  }

  private async isReady() {
    if (this.readyState === ReadyState.Initializing) {
      await new Promise(resolve => this.requestQueue.push(() => resolve()));
    }

    return true;
  }

  private async fetchJs(name: string, { getLatest, componentVersion }: Options): Promise<string> {
    componentVersion = componentVersion || this.index[name];

    if (!getLatest && componentVersion && this.cache.has(name, componentVersion)) {
      return (await this.cache.getItem(name, componentVersion)) as string;
    }

    const url = buildUrl(this.url, {
      path: name,
      queryParams: {
        hostId: this.id,
        ...(!getLatest ? { componentVersion } : {})
      }
    });

    const res = await this.fetcher(url);
    if (!res.ok) {
      throw new ComponentGetFailedError(res.statusText, res);
    }

    const code = await res.text();
    const version = componentVersion || (res.headers.get('dynamico-component-version') as string);

    if (this.checkCodeIntegrity && !(await this.checkCodeIntegrity(code))) {
      throw new ComponentIntegrityCheckFailed({ name, version });
    }

    await this.cache.setItem(name, version, code);

    return code;
  }

  private async initialize(policy: FailedRegisterPolicy) {
    try {
      const { id, issues, index }: RegisterHostResponse = await this.register();
      this.id = id;
      this.index = index || {};

      if (issues) {
        this.handleIssues(issues);
      }

      this.readyState = ReadyState.Ready;
    } catch {
      if (this.readyState === ReadyState.Initializing && policy.strategy === FailedRegisterStrategy.UseCache) {
        this.index = Object.keys(this.cache.componentTree).reduce(
          (acc, key) => ({
            ...acc,
            [key]: this.cache.getLatestVersion(key)
          }),
          {}
        );
      }

      console.warn("Couldn't get components index from the registry, working in offline mode");

      this.readyState =
        policy.strategy === FailedRegisterStrategy.UseCache ? ReadyState.OfflineWithCache : ReadyState.OfflineIgnore;

      if (policy.retries) {
        setTimeout(() => {
          this.initialize({
            ...policy,
            retries: policy.retries - 1
          });
        }, policy.retryRate);
      }
    }

    this.requestQueue.forEach(handler => handler());
    this.requestQueue = [];
  }

  async get(name: string, options: Options = {}) {
    await this.isReady();

    if (this.readyState === ReadyState.OfflineIgnore) {
      return;
    }

    const code = await this.fetchJs(name, options);

    const require = (dep: string) => this.dependencies.resolvers[dep];
    const module: any = {};
    const exports: any = {};
    const args = {
      module,
      exports,
      require,
      ...this.globals,
      ...options.globals
    };

    new Function(...Object.keys(args), code)(...Object.values(args));

    return module.exports || exports.default;
  }
}
