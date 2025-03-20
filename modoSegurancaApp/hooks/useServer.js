import { useState, useCallback } from 'react';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';

export default function useServer(serverUrl) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'disconnected', 'connecting', 'connected', 'error'

  const testConnection = useCallback(async () => {
    setConnectionStatus('connecting');
    setLastError(null);
    
    try {
      console.log(`Testando conexão com: ${serverUrl}/ping`);
      const response = await axios.get(`${serverUrl}/ping`, { timeout: 5000 });
      
      if (response.data && response.data.status === 'ok') {
        console.log('✅ Conexão com servidor estabelecida!');
        setIsConnected(true);
        setConnectionStatus('connected');
        return true;
      } else {
        throw new Error('Resposta inesperada do servidor');
      }
    } catch (error) {
      console.error('❌ Erro de conexão:', error.message);
      setIsConnected(false);
      setLastError(error.message);
      setConnectionStatus('error');
      return false;
    }
  }, [serverUrl]);

  const sendAlert = useCallback(async (alertData = {}) => {
    if (!isConnected) {
      console.warn('⚠️ Tentando enviar alerta sem conexão estabelecida');
    }
    
    try {
      console.log(`Enviando alerta para: ${serverUrl}/alert`);
      
      // Adicionar timestamp se não existir
      if (!alertData.timestamp) {
        alertData.timestamp = new Date().toISOString();
      }
      
      const response = await axios.post(`${serverUrl}/alert`, alertData, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });
      
      console.log('📡 Resposta do servidor ao alerta:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao enviar alerta:', error.message);
      setLastError(`Falha ao enviar alerta: ${error.message}`);
      throw error;
    }
  }, [serverUrl, isConnected]);

  const sendPhoto = useCallback(async (photoUri) => {
    if (!isConnected) {
      console.warn('⚠️ Tentando enviar foto sem conexão estabelecida');
    }
    
    try {
      console.log(`Enviando foto para: ${serverUrl}/upload-photo`);
      
      // Criar FormData para envio de arquivo
      const formData = new FormData();
      formData.append('timestamp', new Date().toISOString());
      
      // Adicionar arquivo de foto
      const fileInfo = await FileSystem.getInfoAsync(photoUri);
      
      if (!fileInfo.exists) {
        throw new Error(`Arquivo não encontrado: ${photoUri}`);
      }
      
      // Extrair nome do arquivo da URI
      const fileName = photoUri.split('/').pop();
      
      formData.append('photo', {
        uri: photoUri,
        name: fileName || 'photo.jpg',
        type: 'image/jpeg',
      });
      
      const response = await axios.post(`${serverUrl}/upload-photo`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000, // Timeout maior para upload de arquivos
      });
      
      console.log('📡 Resposta do servidor ao upload de foto:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao enviar foto:', error.message);
      setLastError(`Falha ao enviar foto: ${error.message}`);
      throw error;
    }
  }, [serverUrl, isConnected]);

  // Nova função para parar o alarme no servidor
  const stopServerAlarm = useCallback(async () => {
    if (!isConnected) {
      console.warn('⚠️ Tentando parar alarme sem conexão estabelecida');
    }
    
    try {
      console.log(`Enviando comando para parar alarme: ${serverUrl}/stop-alarm`);
      
      const response = await axios.post(`${serverUrl}/stop-alarm`, {}, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      });
      
      console.log('📡 Resposta do servidor ao parar alarme:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao parar alarme no servidor:', error.message);
      setLastError(`Falha ao parar alarme: ${error.message}`);
      throw error;
    }
  }, [serverUrl, isConnected]);

  // Nova função para verificar o status do alarme no servidor
  const getAlarmStatus = useCallback(async () => {
    if (!isConnected) {
      console.warn('⚠️ Tentando verificar status do alarme sem conexão estabelecida');
      return null;
    }
    
    try {
      console.log(`Verificando status do alarme: ${serverUrl}/get-alarm-status`);
      
      const response = await axios.get(`${serverUrl}/get-alarm-status`, {
        timeout: 5000,
      });
      
      console.log('📡 Status do alarme no servidor:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao verificar status do alarme:', error.message);
      // Não definimos lastError aqui para não poluir a interface
      return null;
    }
  }, [serverUrl, isConnected]);

  return {
    isConnected,
    lastError,
    connectionStatus,
    testConnection,
    sendAlert,
    sendPhoto,
    stopServerAlarm,  // Nova função
    getAlarmStatus    // Nova função
  };
}