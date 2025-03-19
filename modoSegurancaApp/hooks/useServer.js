import { useState } from 'react';

export default function useServer(serverUrl = 'http://192.168.1.100:5000') {
  const [isConnected, setIsConnected] = useState(false);
  const [lastResponse, setLastResponse] = useState(null);
  
  const testConnection = async () => {
    try {
      const response = await fetch(`${serverUrl}/ping`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const success = response.status === 200;
      setIsConnected(success);
      return success;
    } catch (error) {
      console.error('Server connection error:', error);
      setIsConnected(false);
      return false;
    }
  };
  
  const sendAlert = async () => {
    try {
      const response = await fetch(`${serverUrl}/alert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          type: 'proximity_alert'
        }),
      });
      
      const result = await response.json();
      setLastResponse(result);
      return result;
    } catch (error) {
      console.error('Error sending alert:', error);
      return { success: false, error: error.message };
    }
  };
  
  const sendPhoto = async (photoUri) => {
    try {
      const formData = new FormData();
      
      formData.append('photo', {
        uri: photoUri,
        type: 'image/jpeg',
        name: 'intruder.jpg',
      });
      
      formData.append('timestamp', new Date().toISOString());
      
      const response = await fetch(`${serverUrl}/upload-photo`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      const result = await response.json();
      setLastResponse(result);
      return result;
    } catch (error) {
      console.error('Error sending photo:', error);
      return { success: false, error: error.message };
    }
  };
  
  return {
    isConnected,
    lastResponse,
    testConnection,
    sendAlert,
    sendPhoto
  };
}