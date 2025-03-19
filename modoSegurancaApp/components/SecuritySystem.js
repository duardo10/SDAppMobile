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
  const [serverSettings, setServerSettings] = useState({ url: 'http://10.0.0.102:5000' });
  
  const { isProximityAvailable, proximityData, subscribe, unsubscribe } = useProximitySensor();
  const { hasPermission, cameraRef, type, takePhoto } = useCamera();
  const { isConnected, testConnection, sendAlert, sendPhoto } = useServer(serverSettings.url);
  
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
  
  const triggerSecurity = async () => {
    try {
      // Show camera view briefly
      setShowCamera(true);
      
      // Send alert to server
      await sendAlert();
      
      // Play alarm
      playAlarm();
      
      // Take photo after a short delay
      setTimeout(async () => {
        const photo = await takePhoto();
        if (photo) {
          // Send photo to server
          await sendPhoto(photo.uri);
        }
        
        // Hide camera after capturing
        setTimeout(() => {
          setShowCamera(false);
        }, 1000);
      }, 500);
    } catch (error) {
      console.error('Error triggering security:', error);
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
        <Text style={styles.statusText}>
          Server: {isConnected ? 'Connected' : 'Disconnected'}
        </Text>
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
});