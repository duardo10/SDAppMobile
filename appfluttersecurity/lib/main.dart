import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:proximity_sensor/proximity_sensor.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Solicitar permissões necessárias ao iniciar o aplicativo
  await [
    Permission.camera,
    Permission.sensors,
    Permission.storage,
    Permission.mediaLibrary,
  ].request();
  
  // Inicializar as câmeras disponíveis
  final cameras = await availableCameras();
  final firstCamera = cameras.first;
  
  runApp(SecurityApp(camera: firstCamera));
}

class SecurityApp extends StatelessWidget {
  final CameraDescription camera;
  
  const SecurityApp({super.key, required this.camera});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Security System',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.red),
        useMaterial3: true,
      ),
      home: SecurityHomePage(camera: camera),
    );
  }
}

class SecurityHomePage extends StatefulWidget {
  final CameraDescription camera;
  
  const SecurityHomePage({super.key, required this.camera});

  @override
  State<SecurityHomePage> createState() => _SecurityHomePageState();
}

class _SecurityHomePageState extends State<SecurityHomePage> with WidgetsBindingObserver {
  bool _isSecurityModeActive = false;
  bool _isAlarming = false;
  bool _isServerConnected = false;
  String _serverAddress = '10.0.0.102:5000'; // Endereço padrão, altere conforme necessário
  String _statusMessage = 'Sistema desativado';
  
  CameraController? _cameraController;
  StreamSubscription<dynamic>? _proximitySubscription;
  Timer? _debounceTimer;
  final TextEditingController _serverAddressController = TextEditingController();
  
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _serverAddressController.text = _serverAddress;
    _checkServerConnection();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _stopProximitySensor();
    _cameraController?.dispose();
    _debounceTimer?.cancel();
    _proximitySubscription?.cancel();
    _serverAddressController.dispose();
    super.dispose();
  }
  
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Gerenciar recursos quando o app entra em segundo plano
    if (_cameraController == null || !_cameraController!.value.isInitialized) {
      return;
    }

    if (state == AppLifecycleState.inactive) {
      _cameraController!.dispose();
      _stopProximitySensor();
    } else if (state == AppLifecycleState.resumed && _isSecurityModeActive) {
      _initCamera();
      _startProximitySensor();
    }
  }

  Future<void> _initCamera() async {
    if (_cameraController != null) {
      await _cameraController!.dispose();
    }
    
    _cameraController = CameraController(
      widget.camera,
      ResolutionPreset.medium,
      enableAudio: false,
    );

    try {
      await _cameraController!.initialize();
      if (mounted) {
        setState(() {});
      }
    } catch (e) {
      _updateStatus('Erro ao inicializar câmera: $e');
    }
  }
  
  void _toggleSecurityMode() async {
    if (_isSecurityModeActive) {
      await _deactivateSecurityMode();
    } else {
      await _activateSecurityMode();
    }
  }

  Future<void> _activateSecurityMode() async {
    if (!_isServerConnected) {
      _showError('Servidor não conectado. Verifique o endereço e tente novamente.');
      return;
    }
    
    await _initCamera();
    
    setState(() {
      _isSecurityModeActive = true;
      _statusMessage = 'Sistema ativado - monitorando';
    });
    
    _startProximitySensor();
    
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Modo de segurança ativado')),
    );
  }

  Future<void> _deactivateSecurityMode() async {
    await _stopAlarm(); // Certifica-se de parar o alarme se estiver tocando
    _stopProximitySensor();
    
    setState(() {
      _isSecurityModeActive = false;
      _statusMessage = 'Sistema desativado';
    });
    
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Modo de segurança desativado')),
    );
  }
  
  void _startProximitySensor() {
    _proximitySubscription = ProximitySensor.events.listen((event) {
      if (event is bool && (event as bool) && _isSecurityModeActive) {
        // Usa um debounce para evitar múltiplos alertas em sequência
        if (_debounceTimer?.isActive ?? false) return;
        
        _debounceTimer = Timer(const Duration(seconds: 3), () {
          _handleIntrusion();
        });
      }
    });
  }
  
  void _stopProximitySensor() {
    _proximitySubscription?.cancel();
    _proximitySubscription = null;
    _debounceTimer?.cancel();
    _debounceTimer = null;
  }
  
  Future<void> _handleIntrusion() async {
    setState(() {
      _statusMessage = 'INTRUSO DETECTADO! Enviando alerta...';
    });
    
    // 1. Enviar sinal de alerta ao servidor
    await _sendAlertToServer();
    
    // 2. Capturar e enviar a foto
    await _captureAndSendPhoto();
  }
  
  Future<void> _sendAlertToServer() async {
    try {
      final response = await http.post(
        Uri.parse('http://$_serverAddress/alert'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'timestamp': DateTime.now().toIso8601String(),
          'sensorData': {'proximity': true},
          'deviceInfo': 'Flutter Security App',
        }),
      );
      
      final data = jsonDecode(response.body);
      
      if (response.statusCode == 200 && data['status'] == 'ok') {
        setState(() {
          _isAlarming = true;
          _statusMessage = 'Alerta enviado! Alarme ativado!';
        });
      } else {
        _updateStatus('Erro ao enviar alerta: ${data['message']}');
      }
    } catch (e) {
      _updateStatus('Falha ao comunicar com servidor: $e');
    }
  }
  
  Future<void> _captureAndSendPhoto() async {
    if (_cameraController == null || !_cameraController!.value.isInitialized) {
      _updateStatus('Câmera não inicializada');
      return;
    }
    
    try {
      final XFile photo = await _cameraController!.takePicture();
      final timestamp = DateTime.now().toIso8601String();
      
      // Salvar localmente
      final directory = await getApplicationDocumentsDirectory();
      final localPath = '${directory.path}/security_images';
      await Directory(localPath).create(recursive: true);
      
      final fileName = 'intruso_$timestamp.jpg';
      final localFile = File('$localPath/$fileName');
      await localFile.writeAsBytes(await File(photo.path).readAsBytes());
      
      _updateStatus('Foto salva localmente: $fileName');
      
      // Enviar ao servidor
      await _sendPhotoToServer(photo.path, timestamp);
    } catch (e) {
      _updateStatus('Erro ao capturar/enviar foto: $e');
    }
  }
  
  Future<void> _sendPhotoToServer(String photoPath, String timestamp) async {
    try {
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('http://$_serverAddress/upload-photo'),
      );
      
      request.fields['timestamp'] = timestamp;
      request.files.add(await http.MultipartFile.fromPath(
        'photo',
        photoPath,
      ));
      
      final response = await request.send();
      final responseData = await response.stream.bytesToString();
      final data = jsonDecode(responseData);
      
      if (response.statusCode == 200 && data['status'] == 'ok') {
        _updateStatus('Foto enviada com sucesso: ${data['filename']}');
      } else {
        _updateStatus('Erro ao enviar foto: ${data['message']}');
      }
    } catch (e) {
      _updateStatus('Falha ao enviar foto: $e');
    }
  }
  
  Future<void> _stopAlarm() async {
    if (!_isAlarming) return;
    
    try {
      final response = await http.post(
        Uri.parse('http://$_serverAddress/stop-alarm'),
        headers: {'Content-Type': 'application/json'},
      );
      
      final data = jsonDecode(response.body);
      
      if (response.statusCode == 200 && data['status'] == 'ok') {
        setState(() {
          _isAlarming = false;
          _statusMessage = _isSecurityModeActive ? 'Sistema ativado - monitorando' : 'Sistema desativado';
        });
      } else {
        _updateStatus('Erro ao parar alarme: ${data['message']}');
      }
    } catch (e) {
      _updateStatus('Falha ao comunicar com servidor: $e');
    }
  }
  
  Future<void> _checkServerConnection() async {
    setState(() {
      _isServerConnected = false;
    });
    
    try {
      final response = await http.get(
        Uri.parse('http://$_serverAddress/ping'),
      ).timeout(const Duration(seconds: 5));
      
      final data = jsonDecode(response.body);
      
      setState(() {
        _isServerConnected = response.statusCode == 200 && data['status'] == 'ok';
      });
      
      if (_isServerConnected) {
        _checkAlarmStatus();
      }
    } catch (e) {
      setState(() {
        _isServerConnected = false;
        _statusMessage = 'Servidor não encontrado';
      });
    }
  }
  
  Future<void> _checkAlarmStatus() async {
    try {
      final response = await http.get(
        Uri.parse('http://$_serverAddress/get-alarm-status'),
      );
      
      final data = jsonDecode(response.body);
      
      if (response.statusCode == 200 && data['status'] == 'ok') {
        setState(() {
          _isAlarming = data['alarm_active'];
          if (_isAlarming) {
            _statusMessage = 'Alarme ativo!';
          }
        });
      }
    } catch (e) {
      // Ignora erros aqui, já que é uma verificação secundária
    }
  }
  
  void _updateStatus(String message) {
    if (mounted) {
      setState(() {
        _statusMessage = message;
      });
    }
    
    debugPrint(message);
  }
  
  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red),
    );
  }

  void _openServerSettingsDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Configurações do Servidor'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _serverAddressController,
              decoration: const InputDecoration(
                labelText: 'Endereço do Servidor',
                hintText: 'exemplo: 192.168.1.100:5000',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () {
              setState(() {
                _serverAddress = _serverAddressController.text;
              });
              Navigator.pop(context);
              _checkServerConnection();
            },
            child: const Text('Salvar'),
          ),
        ],
      ),
    );
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Sistema de Segurança'),
        backgroundColor: _isSecurityModeActive ? Colors.red : null,
        actions: [
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: _openServerSettingsDialog,
          ),
        ],
      ),
      body: Column(
        children: [
          _buildStatusCard(),
          const SizedBox(height: 20),
          Expanded(child: _buildCameraPreview()),
          const SizedBox(height: 20),
          _buildControls(),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
  
  Widget _buildStatusCard() {
    return Card(
      color: _getStatusColor(),
      margin: const EdgeInsets.all(16),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  _getStatusIcon(),
                  color: Colors.white,
                  size: 36,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    _statusMessage,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  _isServerConnected ? Icons.cloud_done : Icons.cloud_off,
                  color: Colors.white,
                ),
                const SizedBox(width: 5),
                Text(
                  _isServerConnected ? 'Servidor conectado' : 'Servidor desconectado',
                  style: const TextStyle(color: Colors.white),
                ),
                IconButton(
                  icon: const Icon(Icons.refresh, color: Colors.white),
                  onPressed: _checkServerConnection,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
  
  Color _getStatusColor() {
    if (_isAlarming) return Colors.red;
    if (_isSecurityModeActive) return Colors.orange;
    return Colors.blue;
  }
  
  IconData _getStatusIcon() {
    if (_isAlarming) return Icons.warning;
    if (_isSecurityModeActive) return Icons.security;
    return Icons.security_outlined;
  }
  
  Widget _buildCameraPreview() {
    if (_cameraController == null || !_cameraController!.value.isInitialized) {
      return Container(
        margin: const EdgeInsets.symmetric(horizontal: 16),
        decoration: BoxDecoration(
          color: Colors.black,
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Center(
          child: Text(
            'Câmera não inicializada',
            style: TextStyle(color: Colors.white),
          ),
        ),
      );
    }
    
    return ClipRRect(
      borderRadius: BorderRadius.circular(12.0),
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 16),
        child: CameraPreview(_cameraController!),
      ),
    );
  }
  
  Widget _buildControls() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        children: [
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _isServerConnected ? _toggleSecurityMode : null,
              icon: Icon(_isSecurityModeActive ? Icons.security_outlined : Icons.security),
              label: Text(_isSecurityModeActive ? 'Desativar Segurança' : 'Ativar Segurança'),
              style: ElevatedButton.styleFrom(
                backgroundColor: _isSecurityModeActive ? Colors.grey : Colors.green,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _isAlarming ? _stopAlarm : null,
              icon: const Icon(Icons.alarm_off),
              label: const Text('Desativar Alarme'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
            ),
          ),
        ],
      ),
    );
  }
}