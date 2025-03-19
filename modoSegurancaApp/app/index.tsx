import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, View, Button } from 'react-native';
import * as Camera from 'expo-camera';

import SecuritySystem from '../components/SecuritySystem';

// Simple error boundary component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }> {
  state = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMessage: error.toString() };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>{this.state.errorMessage}</Text>
          <Button 
            title="Try Again" 
            onPress={() => this.setState({ hasError: false })} 
          />
        </View>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [permission, requestPermission] = Camera.useCameraPermissions();
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  
  useEffect(() => {
    (async () => {
      const { status } = await requestPermission();
      setCameraPermission(status === 'granted');
    })();
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerText}>Security System</Text>
        </View>
        
        {cameraPermission === null ? (
          <View style={styles.center}>
            <Text>Requesting camera permission...</Text>
          </View>
        ) : cameraPermission === false ? (
          <View style={styles.center}>
            <Text>Camera permission denied. Please enable it in settings.</Text>
          </View>
        ) : (
          <SecuritySystem />
        )}
        
        <StatusBar style="auto" />
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2196F3',
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  headerText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8d7da',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#721c24',
    marginBottom: 10,
  },
  errorMessage: {
    fontSize: 16,
    color: '#721c24',
    marginBottom: 20,
    textAlign: 'center',
  },
});