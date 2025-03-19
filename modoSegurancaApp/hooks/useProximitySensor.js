import { useState, useEffect } from 'react';
import { Sensors } from 'expo-sensors';

export default function useProximitySensor() {
  const [isProximityAvailable, setIsProximityAvailable] = useState(false);
  const [proximityData, setProximityData] = useState({ distance: 0, accuracy: 0 });
  const [subscription, setSubscription] = useState(null);
  
  useEffect(() => {
    checkAvailability();
    return () => {
      unsubscribe();
    };
  }, []);
  
  const checkAvailability = async () => {
    const isAvailable = await Sensors.Proximity.isAvailableAsync();
    setIsProximityAvailable(isAvailable);
  };
  
  const subscribe = (callback) => {
    unsubscribe();
    const newSubscription = Sensors.Proximity.addListener(data => {
      setProximityData(data);
      if (callback) callback(data);
    });
    setSubscription(newSubscription);
  };
  
  const unsubscribe = () => {
    if (subscription) {
      subscription.remove();
      setSubscription(null);
    }
  };
  
  return {
    isProximityAvailable,
    proximityData,
    subscribe,
    unsubscribe
  };
}