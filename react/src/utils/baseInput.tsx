import React, { useState, useEffect, useRef } from 'react';

 /**
   * 受控 + 非受控公共组件的基础封装模板
   */

export interface BaseInputProps {
  /**
   * 受控值
   */
  value?: string;

  /**
   * 非受控初始值
   */
  defaultValue?: string;

  /**
   * 值变化时回调
   * @param value 最新值
   * @param event 原始事件
   */
  onChange?: (value: string, event: React.ChangeEvent<HTMLInputElement>) => void;

  /**
   * 其他透传给原生 input 的属性
   */
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const BaseInput: React.FC<BaseInputProps> = (props) => {
  const {
    value,
    defaultValue = '',
    onChange,
    ...restProps
  } = props;

  // 判断是否为受控模式
  const isControlled = 'value' in props;

  // 非受控模式内部维护的值
  const [innerValue, setInnerValue] = useState(defaultValue);

  // 存放受控/非受控模式初始值，用于检测切换
  const isControlledRef = useRef(isControlled);

  // 检测受控/非受控切换（开发环境提示）
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      if (isControlledRef.current !== isControlled) {
        console.warn(
          `BaseInput component changed from ${
            isControlledRef.current ? 'controlled' : 'uncontrolled'
          } to ${isControlled ? 'controlled' : 'uncontrolled'} mode. 
          This may cause unexpected behavior.`
        );
      }
    }
  }, [isControlled]);

  const mergedValue = isControlled ? value ?? '' : innerValue;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;

    if (!isControlled) {
      setInnerValue(newVal);
    }

    onChange?.(newVal, e);
  };

  return (
    <input
      {...restProps}
      value={mergedValue}
      onChange={handleChange}
    />
  );
};
