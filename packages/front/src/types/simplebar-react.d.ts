declare module 'simplebar-react' {
  import { ComponentType, HTMLAttributes } from 'react';
  
  interface SimpleBarProps extends HTMLAttributes<HTMLDivElement> {
    scrollableNodeProps?: Record<string, unknown>;
    autoHide?: boolean;
    forceVisible?: boolean | 'x' | 'y';
    classNames?: Record<string, string>;
    style?: React.CSSProperties;
  }
  
  const SimpleBar: ComponentType<SimpleBarProps>;
  export default SimpleBar;
} 