import { useState, useCallback } from 'react';
import * as FileSystem from 'expo-file-system';

export default function useServer(serverUrl) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [lastError, setLastError] = useState(null);
  
  const logRequest = (method, url, body = null) => {
    console.log(`🌐 REQUEST: ${method} ${url}`);
    if (body) {
      console.log(`📦 REQUEST BODY:`, body);
    }
  };
  
  const logResponse = (status, data) => {
    console.log(`✅ RESPONSE: Status ${status}`);
    console.log(`📄 RESPONSE DATA:`, data);
  };
  
  const logError = (method, url, error) => {
    console.error(`❌ ERROR in ${method} ${url}:`, error);
    setLastError(error.message || 'Erro desconhecido na conexão');
  };
  
  const testConnection = useCallback(async () => {
    setConnectionStatus('connecting');
    setLastError(null);
    
    try {
      const url = `${serverUrl}/ping`;
      logRequest('GET', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      logResponse(response.status, data);
      
      if (response.ok && data.status === 'ok') {
        setIsConnected(true);
        setConnectionStatus('connected');
        return true;
      } else {
        throw new Error(data.message || 'Resposta do servidor inválida');
      }
    } catch (error) {
      logError('GET', `${serverUrl}/ping`, error);
      setIsConnected(false);
      setConnectionStatus('error');
      return false;
    }
  }, [serverUrl]);
  
  const sendAlert = useCallback(async (extraData = {}) => {
    try {
      const url = `${serverUrl}/alert`;
      const body = {
        timestamp: new Date().toISOString(),
        deviceInfo: {
          platform: Platform.OS,
          version: Platform.Version
        },
        ...extraData
      };
      
      logRequest('POST', url, body);
      
      console.log('⚠️ Enviando alerta para o servidor');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      logResponse(response.status, data);
      
      if (!response.ok) {
        console.warn('⚠️ Servidor retornou erro ao enviar alerta:', data.message);
        throw new Error(data.message || 'Falha ao enviar alerta');
      }
      
      console.log('✅ Alerta enviado com sucesso');
      return data;
    } catch (error) {
      logError('POST', `${serverUrl}/alert`, error);
      throw error;
    }
  }, [serverUrl]);
  
  const sendPhoto = useCallback(async (photoUri) => {
    try {
      const url = `${serverUrl}/upload-photo`;
      
      console.log('📸 Preparando para enviar foto:', photoUri);
      logRequest('POST', url, { photoUri: photoUri });
      
      // Criar form data para upload do arquivo
      const formData = new FormData();
      formData.append('photo', {
        uri: photoUri,
        name: 'photo.jpg',
        type: 'image/jpeg'
      });
      formData.append('timestamp', new Date().toISOString());
      
      console.log('⬆️ Iniciando upload da foto');
      
      // Para requisições com arquivos, usamos XMLHttpRequest para monitorar o progresso
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.onreadystatechange = function() {
          if (xhr.readyState !== XMLHttpRequest.DONE) return;
          
          console.log(`📊 Resposta do upload (status ${xhr.status})`);
          
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              logResponse(xhr.status, response);
              console.log('✅ Foto enviada com sucesso');
              resolve(response);
            } catch (e) {
              console.error('❌ Erro ao processar resposta do servidor:', e);
              reject(new Error('Erro ao processar resposta do servidor'));
            }
          } else {
            console.error('❌ Erro no upload da foto:', xhr.status, xhr.responseText);
            try {
              const errorData = JSON.parse(xhr.responseText);
              reject(new Error(errorData.message || 'Falha ao enviar foto'));
            } catch (e) {
              reject(new Error(`Erro HTTP ${xhr.status}`));
            }
          }
        };
        
        xhr.upload.onprogress = function(e) {
          if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            console.log(`📤 Progresso do upload: ${percentComplete.toFixed(2)}%`);
          }
        };
        
        xhr.open('POST', url);
        xhr.send(formData);
      });
    } catch (error) {
      logError('POST', `${serverUrl}/upload-photo`, error);
      throw error;
    }
  }, [serverUrl]);
  
  return {
    isConnected,
    connectionStatus,
    lastError,
    testConnection,
    sendAlert,
    sendPhoto
  };
}