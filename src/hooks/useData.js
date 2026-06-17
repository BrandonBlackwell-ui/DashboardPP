import { useState, useEffect, useCallback } from 'react';

export function useData() {
  const [data, setData] = useState(null);
  const [calData, setCalData] = useState(null);

  // Call this after mutating window.PA_DATA to force React to re-render with new data
  const refreshData = useCallback(() => {
    if (window.PA_DATA) setData({ ...window.PA_DATA, themes: { ...window.PA_DATA.themes } });
    if (window.CALENDAR_DATA) setCalData({ ...window.CALENDAR_DATA });
  }, []);

  useEffect(() => {
    function tryLoad() {
      if (window.PA_DATA && window.CALENDAR_DATA) {
        setData(window.PA_DATA);
        setCalData(window.CALENDAR_DATA);
      } else {
        setTimeout(tryLoad, 50);
      }
    }
    // Inject scripts dynamically
    if (!document.querySelector('script[data-pa]')) {
      const s1 = document.createElement('script');
      s1.src = '/pa_data_full.js';
      s1.setAttribute('data-pa','1');
      document.head.appendChild(s1);
    }
    if (!document.querySelector('script[data-cal]')) {
      const s2 = document.createElement('script');
      s2.src = '/calendar_data.js';
      s2.setAttribute('data-cal','1');
      document.head.appendChild(s2);
    }
    tryLoad();
  }, []);

  return { data, calData, refreshData };
}
