import { useState, useEffect } from "react";
import { shallow } from "zustand/shallow";

export type StoreWithInitializer = {
  initializeState: (state: Partial<any>) => void;
};

type StoreSelector<TState, T> = (state: TState) => T;

type HydratedResult<T> = {
  /**
   * 是否已经水合
   */
  hydrated: boolean,
  /**
   * 水合后的 Store State
   */
  state: T
}

/**
 * 创建 SSR 水合 Store Helper 函数 
 * @param store 传入的 Store 必须包含 initializeState 方法，用于水合时初始化 CSR Store 数据
 * @returns 
 */
export function createHydratedStoreHelper<TState extends object & StoreWithInitializer>(store: (selector: any, equals?: any) => any) {
  // 闭包缓存数据
  let initStoreState: Partial<TState> | null = {};
  // 防止重复初始化
  let initialized = false;

  /**
   * 初始化 Store Stat
   * @param initState 
   */
  function setInitStoreState(initState: Partial<TState>) {
    initStoreState = initState;
  }

  /**
   * 使用水合函数
   * @param selector 
   * @param equals 
   * @returns 
   */
  function useHydrated<T>(selector: StoreSelector<TState, T>, equals = shallow): HydratedResult<T> {
    const [hydrated, setHydrated] = useState(false);

    const initializeState = store((state: any) => state.initializeState);
    const csrState = store(selector, equals);

    // SSR 的回退值（仅在还未水合时使用）
    const ssrState = initStoreState ? selector(initStoreState as TState) : undefined;

    if (process.env.NODE_ENV === 'development' && typeof initializeState !== 'function') {
      throw new TypeError('[createHydratedStoreHelper]: Store 中必须存在 initializeState 函数！')
    }

    useEffect(() => {
      if (!initialized && initStoreState) {
        initializeState?.(initStoreState);
        initialized = true;
        // 释放内存占用
        initStoreState = null;
      }
      setHydrated(true);
    }, []);

    return {
      hydrated,
      state: hydrated ? csrState : (ssrState as T)
    };
  }

  return { setInitStoreState, useHydrated };
}
