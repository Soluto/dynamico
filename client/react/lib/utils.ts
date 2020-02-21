import { Dependencies } from '@dynamico/core';

export interface DependencyOptions {
  dependencies: Dependencies;
  globals?: Record<string, any>;
}

export const mergeDependencies = (a: DependencyOptions, ...options: Partial<DependencyOptions>[]): DependencyOptions =>
  options.reduce(
    (a: DependencyOptions, b) => ({
      dependencies: {
        versions: { ...a.dependencies.versions, ...b.dependencies?.versions },
        resolvers: { ...a.dependencies.resolvers, ...b.dependencies?.resolvers }
      },
      globals: { ...a.globals, ...b.globals }
    }),
    a
  );

// https://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
const getHashCode = (str: string) => {
  let hash = 0;
  if (str.length == 0) return hash;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
};

export const hashDependencies = ({ versions }: Dependencies) => {
  return getHashCode(
    Object.keys(versions)
      .sort()
      .map(name => `${name}:${versions[name]}`)
      .join(';')
  );
};
