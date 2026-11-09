import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api.dart';
import 'models.dart';
import 'offline_store.dart';

final apiProvider = Provider<ApiClient>((ref) => ApiClient());
final appProvider = NotifierProvider<AppController, AppState>(
  AppController.new,
);

class AppState {
  const AppState({
    this.account,
    this.initializing = true,
    this.locale = 'uz',
    this.dark = true,
    this.offline = false,
    this.syncing = false,
    this.offlineGrantValid = false,
    this.message,
  });
  final Account? account;
  final bool initializing, dark, offline, syncing, offlineGrantValid;
  final String locale;
  final String? message;
  AppState copyWith({
    Account? account,
    bool clearAccount = false,
    bool? initializing,
    String? locale,
    bool? dark,
    bool? offline,
    bool? syncing,
    bool? offlineGrantValid,
    String? message,
    bool clearMessage = false,
  }) => AppState(
    account: clearAccount ? null : account ?? this.account,
    initializing: initializing ?? this.initializing,
    locale: locale ?? this.locale,
    dark: dark ?? this.dark,
    offline: offline ?? this.offline,
    syncing: syncing ?? this.syncing,
    offlineGrantValid: offlineGrantValid ?? this.offlineGrantValid,
    message: clearMessage ? null : message ?? this.message,
  );
}

class AppController extends Notifier<AppState> {
  OfflineStore? store;
  Timer? _leaseTimer;
  StreamSubscription<String>? _pushTokens;
  StreamSubscription<RemoteMessage>? _pushMessages;
  ApiClient get api => ref.read(apiProvider);
  @override
  AppState build() {
    api.onRevoked = () {
      logout(revoked: true);
    };
    Future.microtask(restore);
    _leaseTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (state.offlineGrantValid && store?.leaseValid != true) {
        state = state.copyWith(offlineGrantValid: false);
        ref.invalidate(infrastructureProvider);
      }
    });
    ref.onDispose(() {
      _leaseTimer?.cancel();
      _pushTokens?.cancel();
      _pushMessages?.cancel();
      store?.close();
    });
    return const AppState();
  }

  Future<void> restore() async {
    final saved = await api.credentials.read(key: 'account');
    final locale = await api.credentials.read(key: 'locale') ?? 'uz';
    final dark = await api.credentials.read(key: 'dark') != 'false';
    if (saved != null) {
      try {
        final account = Account.fromJson(
          Map<String, dynamic>.from(jsonDecode(saved) as Map),
        );
        state = state.copyWith(account: account, locale: locale, dark: dark);
        await _openStore(account);
        await refreshAccount();
      } catch (error) {
        state = state.copyWith(message: readableError(error), offline: true);
      }
    }
    state = state.copyWith(initializing: false, locale: locale, dark: dark);
  }

  Future<void> _openStore(
    Account account, {
    bool onlineAuthorized = false,
  }) async {
    try {
      store = await OfflineStore.open(
        account.id,
        policyEpoch: account.policyEpoch,
        onlineAuthorized: onlineAuthorized,
      );
    } catch (error) {
      state = state.copyWith(message: readableError(error));
    }
  }

  Future<void> acceptSession(Map<String, dynamic> response) async {
    await api.saveSession(response);
    await _stopPush();
    await store?.close();
    store = null;
    final account = Account.fromJson(
      Map<String, dynamic>.from(response['user'] as Map),
    );
    state = state.copyWith(
      account: account,
      initializing: false,
      offline: false,
      offlineGrantValid: false,
      clearMessage: true,
    );
    await _openStore(account, onlineAuthorized: true);
    if (account.isEmployee) {
      await renewLease();
    }
    await _configurePush(account);
  }

  bool _sameAccount(Account? account, int revision) =>
      account?.id == state.account?.id &&
      account?.policyEpoch == state.account?.policyEpoch &&
      revision == api.sessionRevision;

  Future<void> _stopPush() async {
    await _pushTokens?.cancel();
    await _pushMessages?.cancel();
    _pushTokens = null;
    _pushMessages = null;
  }

  Future<void> _configurePush(Account account) async {
    if (!const bool.fromEnvironment('ENABLE_FCM')) {
      return;
    }
    final revision = api.sessionRevision;
    try {
      final permission = await FirebaseMessaging.instance.requestPermission();
      if (permission.authorizationStatus != AuthorizationStatus.authorized ||
          !_sameAccount(account, revision)) {
        return;
      }
      Future<void> registerToken(String token) async {
        final id = await api.deviceId;
        if (!_sameAccount(account, revision)) {
          return;
        }
        await api.post('/notifications/devices', {
          'token': token,
          'platform': 'android',
          'device_id': id,
        });
      }

      // The backend uses FCM HTTP v1 registration tokens. Firebase17's new
      // onRegistered stream exposes FIDs, which have a different contract.
      // ignore: deprecated_member_use
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) {
        await registerToken(token);
      }
      // ignore: deprecated_member_use
      _pushTokens = FirebaseMessaging.instance.onTokenRefresh.listen((token) {
        unawaited(registerToken(token).catchError((Object _) {}));
      });
      _pushMessages = FirebaseMessaging.onMessage.listen((_) {
        if (_sameAccount(account, revision)) {
          ref.invalidate(notificationsProvider);
        }
      });
    } catch (_) {
      if (_sameAccount(account, revision)) {
        state = state.copyWith(
          message: 'Push sozlanmagan. Bildirishnomalar ilova ichida ko‘rinadi.',
        );
      }
    }
  }

  Future<void> refreshAccount() async {
    final previous = state.account;
    final revision = api.sessionRevision;
    final data = Map<String, dynamic>.from(await api.get('/users/me') as Map);
    if (!_sameAccount(previous, revision)) {
      return;
    }
    final account = Account.fromJson(data);
    if (previous != null && previous.policyEpoch != account.policyEpoch) {
      state = state.copyWith(offlineGrantValid: false);
      await store?.invalidateCache();
      await store?.close();
      store = null;
      await _openStore(account, onlineAuthorized: true);
    }
    await api.credentials.write(key: 'account', value: jsonEncode(data));
    if (revision != api.sessionRevision) {
      return;
    }
    state = state.copyWith(account: account, offline: false);
    if (account.isEmployee) {
      await renewLease();
    }
  }

  Future<void> renewLease() async {
    if (state.account?.isEmployee != true) {
      return;
    }
    final account = state.account;
    final revision = api.sessionRevision;
    final activeStore = store;
    final grant = Map<String, dynamic>.from(
      await api.post('/sync/grant') as Map,
    );
    if (!_sameAccount(account, revision) || !identical(store, activeStore)) {
      return;
    }
    if (grant['policy_epoch'] != account!.policyEpoch) {
      state = state.copyWith(offlineGrantValid: false);
      throw StateError('Ruxsatlar o‘zgardi. Hisob ma’lumotlarini yangilang.');
    }
    final now = DateTime.parse(grant['server_time'] as String);
    final expiry = DateTime.parse(grant['expires_at'] as String);
    activeStore?.authorize(now, expiry.difference(now));
    state = state.copyWith(
      offline: false,
      offlineGrantValid: activeStore?.leaseValid == true,
    );
  }

  Future<List<Map<String, dynamic>>> loadRecords([
    Map<String, dynamic>? query,
  ]) async {
    final account = state.account;
    final revision = api.sessionRevision;
    final activeStore = store;
    if (account?.isEmployee != true || !state.offlineGrantValid) {
      throw StateError(
        'Operativ ma’lumot uchun amaldagi ruxsat talab qilinadi.',
      );
    }
    try {
      final records = await api.list('/infrastructure', query);
      if (!_sameAccount(account, revision) || !identical(store, activeStore)) {
        throw StateError('Hisob yoki ruxsatlar o‘zgardi.');
      }
      state = state.copyWith(offline: false);
      if (query == null && activeStore?.leaseValid == true) {
        await activeStore!.putCache('infrastructure', records);
      }
      return records;
    } catch (error) {
      if (error is! DioException ||
          error.response != null ||
          !_sameAccount(account, revision) ||
          !identical(store, activeStore)) {
        rethrow;
      }
      state = state.copyWith(offline: true);
      final cached = await activeStore?.readCache('infrastructure');
      if (!_sameAccount(account, revision)) {
        rethrow;
      }
      if (cached != null) {
        return cached;
      }
      rethrow;
    }
  }

  Future<void> synchronize() async {
    if (store == null || state.account?.isEmployee != true || state.syncing) {
      return;
    }
    state = state.copyWith(syncing: true, clearMessage: true);
    try {
      await refreshAccount();
      final operations = await store!.pending();
      if (operations.isNotEmpty) {
        final clean = operations
            .map(
              (e) => Map<String, dynamic>.fromEntries(
                e.entries.where((entry) => !entry.key.startsWith('_')),
              ),
            )
            .toList();
        final response = await api.post('/sync/batch', {
          'policy_epoch': state.account!.policyEpoch,
          'operations': clean,
        }) as Map;
        for (final raw in response['results'] as List) {
          final result = raw as Map;
          final id = result['operation_id'] as String;
          if (result['status'] == 'success') {
            try {
              final operation = operations.firstWhere(
                (e) => e['operation_id'] == id,
              );
              for (final raw in operation['_attachments'] as List? ?? []) {
                final attachment = raw as Map;
                final objectId =
                    (result['data'] as Map?)?['id'] ?? operation['object_id'];
                await api.post(
                  '/attachments',
                  FormData.fromMap({
                    'object_id': objectId,
                    'file': MultipartFile.fromBytes(
                      base64Decode(attachment['bytes'] as String),
                      filename: attachment['name'] as String,
                    ),
                  }),
                );
              }
              await store!.settle(id);
            } catch (error) {
              await store!.settle(id, conflict: readableError(error));
            }
          } else {
            await store!.settle(
              id,
              conflict:
                  '${result['status']}: ${result['error'] ?? 'Amal rad etildi'}',
            );
          }
        }
      }
      await loadRecords();
      state = state.copyWith(
        offline: false,
        message:
            'Sinxronlash yakunlandi. Konfliktlar bo‘lsa, navbatni tekshiring.',
      );
    } catch (error) {
      state = state.copyWith(offline: true, message: readableError(error));
    } finally {
      state = state.copyWith(syncing: false);
    }
  }

  Future<void> logout({bool revoked = false}) async {
    final token = await api.credentials.read(key: 'access_token');
    final oldStore = store;
    store = null;
    final clearingCredentials = api.clearSession();
    state = state.copyWith(
      clearAccount: true,
      offlineGrantValid: false,
      offline: false,
      message: revoked ? 'Sessiya bekor qilingan. Qayta kiring.' : null,
    );
    await _stopPush();
    await clearingCredentials;
    ref.invalidate(infrastructureProvider);
    ref.invalidate(reportsProvider);
    ref.invalidate(notificationsProvider);
    if (revoked) {
      await oldStore?.revoke();
    } else {
      await oldStore?.invalidateCache();
    }
    await oldStore?.close();
    if (!revoked && token != null) {
      try {
        // This detached request keeps the old credential even if another user
        // signs in while server-side logout is in flight.
        await Dio(
          BaseOptions(
            baseUrl: api.dio.options.baseUrl,
            connectTimeout: const Duration(seconds: 15),
            receiveTimeout: const Duration(seconds: 30),
            headers: {'Authorization': 'Bearer $token'},
          ),
        ).post<dynamic>('/auth/logout');
      } catch (_) {}
    }
  }

  Future<void> preferences({String? locale, bool? dark}) async {
    if (locale != null) {
      await api.credentials.write(key: 'locale', value: locale);
    }
    if (dark != null) await api.credentials.write(key: 'dark', value: '$dark');
    state = state.copyWith(locale: locale, dark: dark);
  }
}

final categoriesProvider = FutureProvider<List<Map<String, dynamic>>>(
  (ref) => ref.read(apiProvider).list('/categories'),
);
final regionsProvider = FutureProvider<List<Map<String, dynamic>>>(
  (ref) => ref.read(apiProvider).list('/gis/regions'),
);
final infrastructureProvider = FutureProvider<List<Map<String, dynamic>>>(
  (ref) => ref.read(appProvider.notifier).loadRecords(),
);
final reportsProvider = FutureProvider<List<Map<String, dynamic>>>(
  (ref) => ref.read(apiProvider).list('/reports/my'),
);
final notificationsProvider = FutureProvider<List<Map<String, dynamic>>>(
  (ref) => ref.read(apiProvider).list('/notifications'),
);

ThemeData appTheme(bool dark) {
  final scheme = ColorScheme.fromSeed(
    seedColor: const Color(0xff08a5bc),
    brightness: dark ? Brightness.dark : Brightness.light,
  );
  return ThemeData(
    useMaterial3: true,
    brightness: dark ? Brightness.dark : Brightness.light,
    fontFamily: 'NotoSans',
    colorScheme: scheme.copyWith(
      primary: dark ? const Color(0xff5de6f5) : const Color(0xff006879),
      surface: dark ? const Color(0xff102136) : Colors.white,
      onSurface: dark ? const Color(0xfff5f9ff) : const Color(0xff102136),
    ),
    scaffoldBackgroundColor: dark
        ? const Color(0xff081320)
        : const Color(0xfff0f4f8),
    textTheme: ThemeData(brightness: dark ? Brightness.dark : Brightness.light)
        .textTheme
        .apply(fontFamily: 'NotoSans', fontSizeFactor: 1.1)
        .copyWith(
          bodyLarge: const TextStyle(fontFamily: 'NotoSans', fontSize: 18),
          bodyMedium: const TextStyle(fontFamily: 'NotoSans', fontSize: 18),
          bodySmall: const TextStyle(fontFamily: 'NotoSans', fontSize: 16),
        ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      contentPadding: const EdgeInsets.all(18),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
      labelStyle: const TextStyle(fontSize: 17),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(56, 56),
        textStyle: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(56, 56),
        textStyle: const TextStyle(fontSize: 17),
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(minimumSize: const Size(56, 56)),
    ),
    navigationBarTheme: const NavigationBarThemeData(
      height: 88,
      labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
    ),
    dividerTheme: DividerThemeData(
      color: dark ? const Color(0xff39516b) : const Color(0xffa5b4c4),
    ),
  );
}
