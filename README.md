# SDAppMobile

# Modo Segurança App

Este projeto é um aplicativo Android criado com React Native e Expo, que utiliza o sensor de proximidade para ativar um modo de segurança. Quando o sensor detecta movimento, o aplicativo captura uma foto e envia a imagem para um servidor Python, que a armazena para consulta posterior.

## Requisitos

- Node.js
- Expo CLI
- Python 3.x
- Flask (para o servidor Python)

## Instalação

### 1. Instalar dependências do React Native com Expo

Certifique-se de que o Node.js está instalado e, em seguida, instale o Expo CLI:

```bash
npm install -g expo-cli

```bash
npx create-expo-app modoSegurancaApp

cd modoSegurancaApp

npx expo install expo-sensors expo-camera axios

npx expo start



