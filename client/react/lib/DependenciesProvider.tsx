import React, { FunctionComponent, useContext, useMemo } from 'react';
import { CacheOptions, DynamicoClient, filterDependencies } from '@dynamico/core';
import { DynamicoContext } from './DynamicoProvider';
import { DependencyOptions, hashDependencies, mergeDependencies } from './utils';

export interface DependenciesProviderProps extends DependencyOptions {
  cache?: CacheOptions;
}

export const DependenciesProvider: FunctionComponent<DependenciesProviderProps> = ({
  children,
  cache,
  globals,
  dependencies
}) => {
  const client = useContext(DynamicoContext);
  const overrideClient = useMemo(() => {
    if (!client) {
      return undefined;
    }
    const filteredDependencies = filterDependencies(dependencies);
    return (
      client &&
      new DynamicoClient({
        url: client.url,
        cache: cache || {
          storage: client.cache.storage,
          prefix: `${client.cache.prefix}-${hashDependencies(filteredDependencies)}`
        },
        fetcher: client.fetcher,
        checkCodeIntegrity: client.checkCodeIntegrity,
        failedRegisterPolicy: client.failedRegisterPolicy,
        ...mergeDependencies(client, { dependencies: filteredDependencies, globals })
      })
    );
  }, [client, dependencies, globals]);

  return <DynamicoContext.Provider value={overrideClient}>{children}</DynamicoContext.Provider>;
};
