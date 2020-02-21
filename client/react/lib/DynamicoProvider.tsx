import React, { FunctionComponent } from 'react';
import { DevOptions, DynamicoClient } from '@dynamico/core';

export const DynamicoContext = React.createContext<DynamicoClient | undefined>(undefined);

export const DynamicoDevContext = React.createContext<Partial<DevOptions> | undefined>(undefined);

export interface DynamicoProviderProps {
  client: DynamicoClient;
  devMode?: boolean | Partial<DevOptions>;
}

const emptyDevMode = {};

export const DynamicoProvider: FunctionComponent<DynamicoProviderProps> = ({ client, devMode, children }) => (
  <DynamicoContext.Provider value={client}>
    <DynamicoDevContext.Provider value={typeof devMode === 'object' ? devMode : devMode ? emptyDevMode : undefined}>
      {children}
    </DynamicoDevContext.Provider>
  </DynamicoContext.Provider>
);
