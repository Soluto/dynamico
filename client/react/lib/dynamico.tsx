import React, { useState, useEffect, useContext, FunctionComponent } from 'react';
import { DynamicoClient, DynamicoDevClient, Options, DevOptions } from '@dynamico/core';
import { Omit } from 'type-fest';
import { isElement } from 'react-is';
import { DynamicoContext, DynamicoDevContext } from './DynamicoProvider';
import { mergeDependencies } from './utils';

const enum ComponentStatus {
  Loading = 'loading',
  Error = 'error'
}

interface Status {
  currentStatus: ComponentStatus;
  error?: Error;
}

interface setStatus {
  (status: Status): void;
}

export interface DynamicoStatus {
  dynamicoStatus: Status;
}

interface Component {
  view?: FunctionComponent;
}

interface setComponent {
  (component: Component): void;
}

type FallbackType<T> = JSX.Element | React.ComponentType<T & DynamicoStatus> | null;

interface ComponentOptions<T> extends Options {
  devMode?: boolean | Partial<DevOptions>;
  fallback?: FallbackType<T>;
}

interface FallbackBuilderProps<T> {
  fallback: FallbackType<T> | null;
  status: Status;
  [propName: string]: any;
}

const FallbackBuilder = <T extends {}>({ fallback, status, ...props }: FallbackBuilderProps<T>) => {
  if (!fallback || isElement(fallback)) {
    return fallback;
  }
  const FallbackComponent = fallback as React.ComponentType<any>;
  return <FallbackComponent dynamicoStatus={status} {...props} />;
};

export const dynamico = function<T = any>(
  name: string,
  { fallback = null, devMode, ...options }: ComponentOptions<T> = {}
): FunctionComponent<T> {
  return (props: T) => {
    const [Component, setComponent]: [Component, setComponent] = useState({});
    const [status, setStatus]: [Status, setStatus] = useState<Status>({ currentStatus: ComponentStatus.Loading });
    const dynamicoClient = useContext(DynamicoContext);
    const globalDevMode = useContext(DynamicoDevContext);

    useEffect(() => {
      const setError = (error: Error) => setStatus({ currentStatus: ComponentStatus.Error, error });

      if (!dynamicoClient) {
        setError(new Error("Couldn't find dynamico client in the context, make sure you use DynamicoProvider"));
        return;
      }

      const getComponent = () => dynamicoClient.get(name, options).then(view => setComponent({ view }), setError);

      if (devMode === false || (!devMode && !globalDevMode)) {
        getComponent();
        return;
      }

      if (typeof devMode !== 'object') {
        devMode = {};
      }

      const devClient = new DynamicoDevClient({
        ...globalDevMode,
        ...devMode,
        ...mergeDependencies(dynamicoClient, globalDevMode || {}, devMode)
      });

      let usingFallbackComponent = false;

      return devClient.get(name, {
        ...options,
        callback: (err, view: any) => {
          if (!err) {
            usingFallbackComponent = false;
            return setComponent({ view });
          }

          console.warn(`failed getting component ${name} from dev server`, err);

          if (devMode) {
            return setError(err);
          }

          if (usingFallbackComponent) {
            return;
          }
          usingFallbackComponent = true;
          getComponent();
        }
      });
    }, []);

    return Component.view ? (
      <Component.view {...props} />
    ) : (
      <FallbackBuilder fallback={fallback} status={status} {...props} />
    );
  };
};
