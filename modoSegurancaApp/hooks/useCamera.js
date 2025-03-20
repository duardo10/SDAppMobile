import { useState, useRef, useEffect } from 'react';
import { Camera } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';

export default function useCamera() {
  const [hasPermission, setHasPermission] = useState(null);
  const [type, setType] = useState(Platform.OS === 'web' ? 'back' : Camera.Constants.Type.back);
  const cameraRef = useRef(null);
  
  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
        const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
        setHasPermission(cameraStatus === 'granted' && mediaStatus === 'granted');
        
        // Create directory for storing photos if it doesn't exist
        const securityDir = `${FileSystem.documentDirectory}security/`;
        const dirInfo = await FileSystem.getInfoAsync(securityDir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(securityDir, { intermediates: true });
        }
      } else {
        // For web, we'll just set permission as granted
        setHasPermission(true);
      }
    })();
  }, []);
  
  const takePhoto = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
        
        if (Platform.OS !== 'web') {
          const timestamp = new Date().getTime();
          const newUri = `${FileSystem.documentDirectory}security/intruder_${timestamp}.jpg`;
          
          await FileSystem.moveAsync({
            from: photo.uri,
            to: newUri
          });
          
          await MediaLibrary.saveToLibraryAsync(newUri);
          
          return { uri: newUri, timestamp };
        } else {
          // For web, just return the photo URI
          return { uri: photo.uri, timestamp: new Date().getTime() };
        }
      } catch (error) {
        console.error('Error taking photo:', error);
        return null;
      }
    }
    return null;
  };
  
  return {
    hasPermission,
    type,
    setType,
    cameraRef,
    takePhoto
  };
}