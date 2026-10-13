import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export function useOffline() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const subscription = NetInfo.addEventListener((state) => {
      setOffline(state.isConnected === false);
    });
    return () => subscription();
  }, []);

  return offline;
}
