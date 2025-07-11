'use client';

import React, { useEffect, useState } from 'react';
import { useSpring, a } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';

interface AppDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const AppDrawer: React.FC<AppDrawerProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  const [windowHeight, setWindowHeight] = useState(0);

  useEffect(() => {
    setWindowHeight(window.innerHeight);
  }, []);

  const [{ y }, api] = useSpring(() => ({
    y: windowHeight,
    config: { tension: 300, friction: 30 },
  }));

  const openDrawer = () => {
    api.start({
      y: 0,
      immediate: false,
    });
  };

  const closeDrawer = (velocity = 0) => {
    api.start({
      y: windowHeight,
      immediate: false,
      config: { tension: 300, friction: 30, velocity },
      onResolve: onClose,
    });
  };

  useEffect(() => {
    if (windowHeight > 0) {
        api.start({ y: isOpen ? 0 : windowHeight, immediate: !isOpen });
    }
  }, [isOpen, windowHeight]);

  const bind = useDrag(
    ({ last, velocity: [, vy], movement: [, my], cancel, canceled }) => {
      if (my > windowHeight * 0.5 || (vy > 0.5 && my > windowHeight * 0.2)) {
        cancel();
      }

      if (last && !canceled) {
        closeDrawer(vy);
      } else {
        api.start({ y: my, immediate: true });
      }
    },
    {
      from: () => [0, y.get()],
      filterTaps: true,
      bounds: { top: 0 },
      rubberband: true,
    }
  );

  if (windowHeight === 0) {
    return null;
  }

  return (
    <a.div
      className="pb-16 bottom-0 left-0 right-0 bg-[#1a202c] rounded-t-[10px] h-[calc(100%-124px)] flex flex-col pointer-events-auto"
      style={{
        y,
        position: 'absolute',
        width: '100%',
        touchAction: 'none',
      }}
      {...bind()}
    >
      <div
        {...bind()}
        className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-gray-700 my-2 cursor-grab active:cursor-grabbing"
      />
      <div
        className="p-4 rounded-t-[10px] flex-1 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center pb-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button
            onClick={() => closeDrawer()}
            className="text-gray-400 hover:text-white"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="flex-grow overflow-y-auto mt-4">{children}</div>
      </div>
    </a.div>
  );
}; 