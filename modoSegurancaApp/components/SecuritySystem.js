import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal } from 'react-native';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import { FontAwesome } from '@expo/vector-icons';

import useProximitySensor from '../hooks/useProximitySensor';
import useCamera from '../hooks/useCamera';
import useServer from '../hooks/useServer';

export default function SecuritySystem() {
  const [securityMode, setSecurityMode] = useState(false);
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const [isServerAlarmActive, setIsServerAlarmActive] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [serverSettings, setServerSettings] = useState({ url: 'http://10.180.41.53:5000' });
  
  const { isProximityAvailable, proximityData, subscribe, unsubscribe } = useProximitySensor();
  const { hasPermission, cameraRef, type, takePhoto } = useCamera();
  const { 
    isConnected, 
    lastError, 
    connectionStatus, 
    testConnection, 
    sendAlert, 
    sendPhoto,
    stopServerAlarm,
    getAlarmStatus 
  } = useServer(serverSettings.url);
  
  const soundRef = useRef(null);
  
  // Check server connection
  useEffect(() => {
    testConnection();
    // Também verificar o status do alarme no servidor
    checkServerAlarmStatus();
  }, [serverSettings.url]);
  
  // Função para verificar o status do alarme no servidor
  const checkServerAlarmStatus = async () => {
    try {
      const status = await getAlarmStatus();
      if (status && typeof status.alarm_active === 'boolean') {
        setIsServerAlarmActive(status.alarm_active);
      }
    } catch (error) {
      console.error('Erro ao verificar status do alarme no servidor:', error);
    }
  };
  
  // Verificar o status do alarme no servidor a cada 3 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      if (connectionStatus === 'connected') {
        checkServerAlarmStatus();
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [connectionStatus]);
  
  // Cleanup function
  useEffect(() => {
    return () => {
      stopAlarm();
      unsubscribe();
    };
  }, []);
  
  // Setup proximity sensor when security mode changes
  useEffect(() => {
    if (securityMode) {
      if (isProximityAvailable) {
        subscribe(handleProximityChange);
        Alert.alert('Security Mode Activated', 'The system will detect intruders and trigger an alarm.');
      } else {
        Alert.alert(
          'Sensor não disponível', 
          'O sensor de proximidade não está disponível neste dispositivo. Use o botão de Teste de Alarme para simular detecção.',
          [{ text: 'OK' }]
        );
      }
    } else {
      unsubscribe();
      stopAlarm();
    }
  }, [securityMode]);
  
  const handleProximityChange = async (data) => {
    console.log('📊 Dados de proximidade recebidos:', data);
    // If proximity is close (typically less than 5cm or device-specific threshold)
    // Different devices may use different thresholds or values
    if (securityMode && data.distance < 5) {
      console.log('🔍 Detecção de proximidade: objeto próximo detectado!');
      await triggerSecurity();
    }
  };
  
  const triggerSecurity = async () => {
    console.log('🚨 INICIANDO PROCEDIMENTO DE SEGURANÇA 🚨');
    setShowCamera(true);
    
    try {
      // Enviar alerta para o servidor com dados do sensor
      console.log('⚠️ Enviando alerta com dados do sensor');
      const alertData = {
        sensorData: {
          proximityDistance: proximityData?.distance || 0,
          proximityAccuracy: proximityData?.accuracy || 0,
          manualTrigger: !isProximityAvailable
        }
      };
      
      console.log('📦 Dados do alerta:', alertData);
      
      // Enviando alerta em paralelo enquanto preparamos a câmera
      const alertPromise = sendAlert(alertData).catch(error => {
        console.error('❌ Erro ao enviar alerta:', error);
        // Continue mesmo se falhar o envio do alerta
        return { status: 'error', error: error.message };
      });
      
      // Tocar alarme local
      console.log('🔊 Iniciando alarme local');
      playAlarm();
      
      // Esperar um momento para a câmera inicializar
      console.log('⏳ Aguardando inicialização da câmera');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Capturar foto
      console.log('📸 Tentando capturar foto');
      const photo = await takePhoto();
      console.log(photo ? '✅ Foto capturada com sucesso' : '❌ Falha ao capturar foto');
      
      // Aguardar resultado do envio do alerta
      const alertResult = await alertPromise;
      console.log('📡 Resultado do envio de alerta:', alertResult);
      
      // Atualizar estado do alarme do servidor após enviar alerta
      await checkServerAlarmStatus();
      
      if (photo) {
        try {
          // Enviar foto para o servidor
          console.log('⬆️ Enviando foto para o servidor:', photo.uri);
          const photoResult = await sendPhoto(photo.uri);
          console.log('✅ Foto enviada com sucesso:', photoResult);
        } catch (photoError) {
          console.error('❌ Erro ao enviar foto:', photoError);
          // Não vamos lançar exceção aqui para permitir que o processo continue
        }
      }
      
      // Esconder câmera após um momento
      console.log('⏳ Ocultando câmera em 1 segundo');
      setTimeout(() => {
        setShowCamera(false);
        console.log('✅ Procedimento de segurança concluído');
      }, 1000);
      
    } catch (error) {
      console.error('❌ ERRO CRÍTICO no procedimento de segurança:', error);
      
      // Esconder câmera em caso de falha
      setTimeout(() => {
        setShowCamera(false);
        console.log('⚠️ Procedimento de segurança falhou');
        
        // Notificar o usuário sobre o erro
        Alert.alert(
          'Erro no sistema de segurança',
          `Ocorreu um erro ao acionar o alarme: ${error.message}`,
          [{ text: 'OK' }]
        );
      }, 1000);
    }
  };
  
  const playAlarm = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/alarm.mp3'),
        { isLooping: true, volume: 1.0 }
      );
      soundRef.current = sound;
      await sound.playAsync();
      setIsAlarmActive(true);
    } catch (error) {
      console.error('Error playing alarm:', error);
    }
  };
  
  const stopAlarm = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      setIsAlarmActive(false);
    }
  };
  
  const handleStopServerAlarm = async () => {
    try {
      console.log('🔇 Enviando solicitação para parar alarme no servidor');
      const result = await stopServerAlarm();
      console.log('✅ Alarme do servidor parado:', result);
      
      // Atualizar o estado local
      setIsServerAlarmActive(false);
      
      // Mostrar confirmação ao usuário
      Alert.alert('Sucesso', 'Alarme no servidor foi desligado com sucesso.');
    } catch (error) {
      console.error('❌ Erro ao parar alarme no servidor:', error);
      Alert.alert('Erro', `Falha ao desligar alarme no servidor: ${error.message}`);
    }
  };
  
  if (hasPermission === null) {
    return <View style={styles.container}><Text>Requesting permissions...</Text></View>;
  }
  
  if (hasPermission === false) {
    return <View style={styles.container}><Text>No access to camera or storage</Text></View>;
  }
  
  return (
    <View style={styles.container}>
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          Proximity Sensor: {isProximityAvailable ? 'Available' : 'Not Available'}
        </Text>
        <Text style={[
          styles.statusText,
          connectionStatus === 'connected' && styles.statusConnected,
          connectionStatus === 'connecting' && styles.statusConnecting,
          connectionStatus === 'error' && styles.statusError
        ]}>
          Server: {connectionStatus === 'connected' ? 'Connected' : 
                 connectionStatus === 'connecting' ? 'Connecting...' : 
                 connectionStatus === 'error' ? 'Connection Error' : 'Disconnected'}
        </Text>
        {lastError && (
          <Text style={styles.errorText}>
            Error: {lastError}
          </Text>
        )}
        <Text style={styles.statusText}>
          Security Mode: {securityMode ? 'Active' : 'Inactive'}
        </Text>
        <Text style={[styles.statusText, isServerAlarmActive ? styles.statusError : styles.statusText]}>
          Server Alarm: {isServerAlarmActive ? 'ACTIVE' : 'Inactive'}
        </Text>
      </View>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, securityMode ? styles.buttonActive : styles.buttonInactive]}
          onPress={() => setSecurityMode(!securityMode)}
        >
          <FontAwesome name={securityMode ? "lock" : "unlock"} size={24} color="white" />
          <Text style={styles.buttonText}>
            {securityMode ? 'Deactivate Security' : 'Activate Security'}
          </Text>
        </TouchableOpacity>
        
        {/* Botão de teste de alarme para quando o sensor não está disponível */}
        {securityMode && !isProximityAvailable && (
          <TouchableOpacity
            style={[styles.button, styles.testButton]}
            onPress={triggerSecurity}
          >
            <FontAwesome name="bell" size={24} color="white" />
            <Text style={styles.buttonText}>Teste de Alarme</Text>
          </TouchableOpacity>
        )}
        
        {isAlarmActive && (
          <TouchableOpacity
            style={[styles.button, styles.alarmButton]}
            onPress={stopAlarm}
          >
            <FontAwesome name="volume-off" size={24} color="white" />
            <Text style={styles.buttonText}>Stop Local Alarm</Text>
          </TouchableOpacity>
        )}
        
        {/* Botão para parar o alarme no servidor */}
        {isServerAlarmActive && (
          <TouchableOpacity
            style={[styles.button, styles.serverAlarmButton]}
            onPress={handleStopServerAlarm}
          >
            <FontAwesome name="bell-slash" size={24} color="white" />
            <Text style={styles.buttonText}>Stop Server Alarm</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Camera Modal */}
      <Modal
        visible={showCamera}
        transparent={false}
        animationType="slide"
      >
        <View style={styles.cameraContainer}>
          {showCamera && (
            <Camera 
              ref={cameraRef}
              style={styles.camera}
              type={type === Camera.Constants.Type.back ? Camera.Constants.Type.back : Camera.Constants.Type.front}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  statusContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  statusText: {
    fontSize: 16,
    marginBottom: 8,
  },
  buttonContainer: {
    alignItems: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginVertical: 10,
    width: '100%',
  },
  buttonActive: {
    backgroundColor: '#4CAF50',
  },
  buttonInactive: {
    backgroundColor: '#607D8B',
  },
  alarmButton: {
    backgroundColor: '#F44336',
  },
  serverAlarmButton: {
    backgroundColor: '#E91E63',
  },
  testButton: {
    backgroundColor: '#FFC107',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  statusConnected: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  statusConnecting: {
    color: '#FFA000',
    fontWeight: 'bold',
  },
  statusError: {
    color: '#F44336',
    fontWeight: 'bold',
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
    marginTop: 4,
  },
});