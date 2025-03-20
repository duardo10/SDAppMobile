// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in the test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:camera/camera.dart';

import 'package:appfluttersecurity_/main.dart';

void main() {
  testWidgets('Security app smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(SecurityApp(camera: CameraDescription(
      name: 'test',
      lensDirection: CameraLensDirection.back,
      sensorOrientation: 0,
    )));

    // Verify that our app shows the security system title
    expect(find.text('Sistema de Segurança'), findsOneWidget);

    // Verify that our counter starts at 0.
    expect(find.text('0'), findsOneWidget);
    expect(find.text('1'), findsNothing);

    // Tap the '+' icon and trigger a frame.
    await tester.tap(find.byIcon(Icons.add));
    await tester.pump();

    // Verify that our counter has incremented.
    expect(find.text('0'), findsNothing);
    expect(find.text('1'), findsOneWidget);
  });
}
