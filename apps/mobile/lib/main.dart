import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (const bool.fromEnvironment('ENABLE_FCM')) {
    const apiKey = String.fromEnvironment('FIREBASE_API_KEY');
    const appId = String.fromEnvironment('FIREBASE_APP_ID');
    const senderId = String.fromEnvironment('FIREBASE_MESSAGING_SENDER_ID');
    const projectId = String.fromEnvironment('FIREBASE_PROJECT_ID');
    try {
      if ([
        apiKey,
        appId,
        senderId,
        projectId,
      ].every((value) => value.isNotEmpty)) {
        await Firebase.initializeApp(
          options: const FirebaseOptions(
            apiKey: apiKey,
            appId: appId,
            messagingSenderId: senderId,
            projectId: projectId,
          ),
        );
      } else {
        await Firebase.initializeApp();
      }
    } catch (_) {
      // Optional push setup must not prevent in-app notifications or login.
      // Provider credentials and configuration values are never printed.
      debugPrint(
        'Push configuration is unavailable; in-app notifications remain enabled.',
      );
    }
  }
  runApp(const ProviderScope(child: FvvApp()));
}
