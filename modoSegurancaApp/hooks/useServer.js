import { useState, useEffect, useCallback } from 'react';

export default function useServer(serverUrl) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState(null);

  // Função para testar a conexão com o servidor
  const testConnection = useCallback(async () => {
    try {
      console.log(`Tentando conectar ao servidor: ${serverUrl}`);
      
      // Adiciona um timeout para a requisição
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${serverUrl}/ping`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log('Conexão com servidor bem-sucedida');
        setIsConnected(true);
        setLastError(null);
        return true;
      } else {
        const errorData = await response.json();
        console.error('Erro na conexão com servidor:', errorData);
        setIsConnected(false);
        setLastError(`Erro ${response.status}: ${errorData.message || 'Desconhecido'}`);
        return false;
      }
    } catch (error) {
      console.error('Erro ao tentar conectar ao servidor:', error.message);
      setIsConnected(false);
      setLastError(error.message);
      return false;
    }
  }, [serverUrl]);

  // Envia um alerta para o servidor
  const sendAlert = async () => {
    if (!isConnected) {
      console.log('Tentando reconectar ao servidor antes de enviar alerta...');
      const reconnected = await testConnection();
      if (!reconnected) {
        throw new Error('Não foi possível conectar ao servidor');
      }
    }

    try {
      const timestamp = new Date().toISOString();
      const response = await fetch(`${serverUrl}/alert`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ timestamp }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao enviar alerta');
      }

      return await response.json();
    } catch (error) {
      console.error('Erro ao enviar alerta:', error);
      throw error;
    }
  };

  // Envia uma foto para o servidor
  const sendPhoto = async (photoUri) => {
    if (!isConnected) {
      console.log('Tentando reconectar ao servidor antes de enviar foto...');
      const reconnected = await testConnection();
      if (!reconnected) {
        throw new Error('Não foi possível conectar ao servidor');
      }
    }

    try {
      const formData = new FormData();
      const timestamp = new Date().toISOString();
      
      // Cria o objeto de arquivo a partir do URI
      const fileType = photoUri.split('.').pop();
      const fileName = `photo_${timestamp}.${fileType}`;
      
      formData.append('photo', {
        uri: photoUri,
        name: fileName,
        type: `image/${fileType}`,
      });
      
      formData.append('timestamp', timestamp);

      const response = await fetch(`${serverUrl}/upload-photo`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao enviar foto');
      }

      return await response.json();
    } catch (error) {
      console.error('Erro ao enviar foto:', error);
      throw error;
    }
  };

  // Pára o alarme no servidor
  const stopAlarm = async () => {
    try {
      const response = await fetch(`${serverUrl}/stop-alarm`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao parar alarme');
      }

      return await response.json();
    } catch (error) {
      console.error('Erro ao parar alarme:', error);
      throw error;
    }
  };

  // Testa a conexão quando o componente é montado ou quando a URL muda
  useEffect(() => {
    testConnection();
    
    // Configurar polling para verificar a conexão periodicamente
    const intervalId = setInterval(testConnection, 30000); // 30 segundos
    
    return () => {
      clearInterval(intervalId);
    };
  }, [serverUrl, testConnection]);

  return {
    isConnected,
    lastError,
    testConnection,
    sendAlert,
    sendPhoto,
    stopAlarm,
  };
}