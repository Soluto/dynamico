import deepmerge from 'deepmerge';
import compareVersions from 'compare-versions';

export class StorageController {
  readonly separator = '/';

  readonly componentTree: Record<string, string[]> = {};

  constructor(public readonly prefix: string, public readonly storage: Storage) {
    this.componentTree = Object.keys(this.storage)
      .map(key => {
        const [, comp, componentVersion] = key.split(this.separator);

        return {
          [comp]: [componentVersion]
        };
      })
      .reduce((tree, key) => deepmerge(tree, key), {});
  }

  getStorageKey(name: string, componentVersion: string): string {
    return [this.prefix, name, componentVersion].join(this.separator);
  }

  getLatestVersion(name: string): string | undefined {
    if (!this.componentTree[name]) {
      return;
    }

    const [latestComponentVersion] = this.componentTree[name].sort((x: string, y: string) => compareVersions(y, x));

    return latestComponentVersion;
  }

  has(name: string, componentVersion: string): boolean {
    return !!(this.componentTree[name] && this.componentTree[name].includes(componentVersion));
  }

  async getItem(name: string, componentVersion: string): Promise<string | null> {
    return await this.storage.getItem(this.getStorageKey(name, componentVersion));
  }

  async setItem(name: string, componentVersion: string, code: string): Promise<void> {
    if (!this.componentTree[name]) {
      this.componentTree[name] = [];
    }

    if (!this.componentTree[name].includes(componentVersion)) {
      this.componentTree[name].push(componentVersion);
    }

    await this.storage.setItem(this.getStorageKey(name, componentVersion), code);
  }
}
