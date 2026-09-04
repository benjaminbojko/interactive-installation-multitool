import { useEffect, useState } from 'react';

export function getFrameloopState(hidden: boolean): 'demand' | 'never' {
  return hidden ? 'never' : 'demand';
}

export function useFrameloop(): 'demand' | 'never' {
  const [hidden, setHidden] = useState(() =>
    typeof document !== 'undefined' ? document.hidden : false,
  );

  useEffect(() => {
    function onVisibilityChange() {
      setHidden(document.hidden);
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  return getFrameloopState(hidden);
}
