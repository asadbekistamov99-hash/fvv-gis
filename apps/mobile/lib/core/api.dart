import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

const apiBase = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:8000/api/v1',
);

class ApiClient {
  ApiClient({Dio? client, FlutterSecureStorage? credentials})
    : dio =
          client ??
          Dio(
            BaseOptions(
              baseUrl: apiBase,
              connectTimeout: const Duration(seconds: 15),
              receiveTimeout: const Duration(seconds: 30),
            ),
          ),
      credentials = credentials ?? const FlutterSecureStorage() {
    if (kReleaseMode && Uri.parse(dio.options.baseUrl).scheme != 'https') {
      throw StateError('Release API manzili HTTPS bo‘lishi shart.');
    }
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          options.extra['sessionRevision'] ??= _sessionRevision;
          final token = await this.credentials.read(key: 'access_token');
          if (token != null) options.headers['Authorization'] = 'Bearer $token';
          handler.next(options);
        },
        onError: (error, handler) async {
          if (error.response?.statusCode == 401 &&
              error.requestOptions.extra['sessionRevision'] ==
                  _sessionRevision &&
              error.requestOptions.extra['retried'] != true &&
              !error.requestOptions.path.startsWith('/auth/')) {
            try {
              _refreshing ??= _refresh();
              await _refreshing;
              _refreshing = null;
              error.requestOptions.extra['retried'] = true;
              final token = await this.credentials.read(key: 'access_token');
              error.requestOptions.headers['Authorization'] = 'Bearer $token';
              handler.resolve(await dio.fetch<dynamic>(error.requestOptions));
              return;
            } catch (refreshError) {
              _refreshing = null;
              if (refreshError is! _SessionChanged &&
                  (refreshError is! DioException ||
                      [401, 403].contains(refreshError.response?.statusCode))) {
                await clearSession();
                onRevoked?.call();
              }
            }
          }
          handler.next(error);
        },
      ),
    );
  }
  final Dio dio;
  final FlutterSecureStorage credentials;
  Future<void>? _refreshing;
  Future<String>? _deviceId;
  Future<void> _sessionWrites = Future<void>.value();
  int _sessionRevision = 0;
  int get sessionRevision => _sessionRevision;
  Future<String> get deviceId => _deviceId ??= _loadDeviceId();
  void Function()? onRevoked;

  Future<String> _loadDeviceId() async {
    final existing = await credentials.read(key: 'device_id');
    if (existing != null) {
      return existing;
    }
    final id = const Uuid().v4();
    await credentials.write(key: 'device_id', value: id);
    return id;
  }

  Future<void> _writeSession(Future<void> Function() write) {
    final next = _sessionWrites.catchError((Object _) {}).then((_) => write());
    _sessionWrites = next;
    return next;
  }

  Future<dynamic> get(String path, [Map<String, dynamic>? query]) async =>
      (await dio.get<dynamic>(path, queryParameters: query)).data;
  Future<dynamic> post(String path, [dynamic data]) async =>
      (await dio.post<dynamic>(path, data: data)).data;
  Future<dynamic> patch(String path, Map<String, dynamic> data) async =>
      (await dio.patch<dynamic>(path, data: data)).data;
  Future<dynamic> delete(String path) async =>
      (await dio.delete<dynamic>(path)).data;

  Future<void> saveSession(
    Map<String, dynamic> response, {
    int? expectedRevision,
  }) {
    if (response['access_token'] == null || response['refresh_token'] == null) {
      throw StateError('MFA verification is required');
    }
    if (expectedRevision == null) {
      _sessionRevision++;
    }
    return _writeSession(() async {
      if (expectedRevision != null && expectedRevision != _sessionRevision) {
        throw const _SessionChanged();
      }
      await credentials.write(
        key: 'access_token',
        value: response['access_token'] as String,
      );
      await credentials.write(
        key: 'refresh_token',
        value: response['refresh_token'] as String,
      );
      if (response['user'] != null) {
        await credentials.write(
          key: 'account',
          value: jsonEncode(response['user']),
        );
      }
    });
  }

  Future<void> _refresh() async {
    final revision = _sessionRevision;
    final token = await credentials.read(key: 'refresh_token');
    if (revision != _sessionRevision) {
      throw const _SessionChanged();
    }
    if (token == null) {
      throw StateError('Session expired');
    }
    final response =
        await Dio(
          BaseOptions(
            baseUrl: dio.options.baseUrl,
            connectTimeout: const Duration(seconds: 15),
            receiveTimeout: const Duration(seconds: 30),
          ),
        ).post<Map<String, dynamic>>(
          '/auth/refresh',
          data: {'refresh_token': token},
        );
    await saveSession(response.data!, expectedRevision: revision);
  }

  Future<void> clearSession() {
    _sessionRevision++;
    return _writeSession(() async {
      for (final key in ['access_token', 'refresh_token', 'account']) {
        await credentials.delete(key: key);
      }
    });
  }

  Future<List<Map<String, dynamic>>> list(
    String path, [
    Map<String, dynamic>? query,
  ]) async {
    final result = await get(path, query);
    final values = result is List
        ? result
        : (result as Map<String, dynamic>)['items'] as List? ?? [];
    return values
        .map((value) => Map<String, dynamic>.from(value as Map))
        .toList();
  }
}

class _SessionChanged implements Exception {
  const _SessionChanged();
}

String readableError(Object error) {
  if (error is DioException) {
    if (error.response == null) {
      return 'Serverga ulanish imkoni yo‘q. Internet va server manzilini tekshiring.';
    }
    final data = error.response?.data;
    if (data is Map) {
      final detail = data['detail'] ?? data['error'];
      if (detail is String) return detail;
      if (detail is Map) {
        return (detail['message'] ?? detail['code'] ?? 'So‘rov bajarilmadi')
            .toString();
      }
    }
    if (error.response?.statusCode == 409) {
      return 'Yozuv o‘zgartirilgan. Tahriringiz saqlandi; yangi versiyani ko‘rib chiqing.';
    }
    if (error.response?.statusCode == 403) return 'Bu amal uchun ruxsat yo‘q.';
    return 'So‘rov bajarilmadi (${error.response?.statusCode}).';
  }
  return error
      .toString()
      .replaceFirst('Exception: ', '')
      .replaceFirst('Bad state: ', '');
}
