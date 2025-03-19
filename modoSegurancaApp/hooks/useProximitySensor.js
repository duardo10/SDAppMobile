import { useEffect, useState } from 'react';
import * as Sensors from 'expo-sensors';

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
    try {
      // Verificar se o ProximitySensor existe no objeto Sensors
      if (Sensors.ProximitySensor) {
        const isAvailable = await Sensors.ProximitySensor.isAvailableAsync();
        setIsProximityAvailable(isAvailable);
      } else {
        console.log('ProximitySensor não está disponível nesta plataforma');
        setIsProximityAvailable(false);
      }
    } catch (error) {
      console.error('Error checking proximity availability:', error);
      setIsProximityAvailable(false);
    }
  };
  
  const subscribe = (callback) => {
    unsubscribe();
    try {
      // Verificar se o ProximitySensor existe antes de usar
      if (Sensors.ProximitySensor) {
        const newSubscription = Sensors.ProximitySensor.addListener(data => {
          setProximityData(data);
          if (callback) callback(data);
        });
        setSubscription(newSubscription);
      }
    } catch (error) {
      console.error('Error subscribing to proximity sensor:', error);
    }
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