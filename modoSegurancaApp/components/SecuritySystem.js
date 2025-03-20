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
  const [showCamera, setShowCamera] = useState(false);
  const [serverSettings, setServerSettings] = useState({ url: 'http://10.180.41.53:5000' });
  
  const { isProximityAvailable, proximityData, subscribe, unsubscribe } = useProximitySensor();
  const { hasPermission, cameraRef, type, takePhoto } = useCamera();
  const { isConnected, lastError, connectionStatus, testConnection, sendAlert, sendPhoto } = useServer(serverSettings.url);
  
  const soundRef = useRef(null);
  
  // Check server connection
  useEffect(() => {
    testConnection();
  }, [serverSettings.url]);
  
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
      subscribe(handleProximityChange);
      Alert.alert('Security Mode Activated', 'The system will detect intruders and trigger an alarm.');
    } else {
      unsubscribe();
      stopAlarm();
    }
  }, [securityMode]);
  
  const handleProximityChange = async (data) => {
    // If proximity is close (typically less than 5cm or device-specific threshold)
    // Different devices may use different thresholds or values
    if (securityMode && data.distance < 5) {
      await triggerSecurity();
    }
  };
  
  // Função triggerSecurity melhorada para o componente SecuritySystem
  const triggerSecurity = async () => {
    console.log('🚨 INICIANDO PROCEDIMENTO DE SEGURANÇA 🚨');
    setShowCamera(true);
    
    try {
      // Enviar alerta para o servidor com dados do sensor
      console.log('⚠️ Enviando alerta com dados do sensor');
      const alertData = {
        sensorData: {
          proximityDistance: proximityData.distance,
          proximityAccuracy: proximityData.accuracy
        }
      };
      
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
        
        {isAlarmActive && (
          <TouchableOpacity
            style={[styles.button, styles.alarmButton]}
            onPress={stopAlarm}
          >
            <FontAwesome name="volume-off" size={24} color="white" />
            <Text style={styles.buttonText}>Stop Alarm</Text>
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
          {/* Modificar esta parte do código */}
          {showCamera && (
            <View style={styles.cameraContainer}>
              {cameraRef ? (
                <Camera 
                  ref={cameraRef}
                  style={styles.camera}
                  type={type || Camera.Constants.Type.back}
                />
              ) : (
                <View style={styles.camera}>
                  <Text>Camera não disponível</Text>
                </View>
              )}
            </View>
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