import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

/// A lease deliberately starts invalid after process restart. Online renewal is
/// required because Android monotonic elapsed time cannot survive every reboot.
class OfflineLease {
  Stopwatch? _clock;
  Duration _duration = Duration.zero;
  DateTime? lastSync;
  void authorize(DateTime serverTime, Duration duration) {
    _duration = duration > const Duration(hours: 8)
        ? const Duration(hours: 8)
        : duration;
    lastSync = serverTime;
    _clock = Stopwatch()..start();
  }

  bool get valid => _clock != null && _clock!.elapsed < _duration;
  DateTime? get trustedNow => _clock == null || lastSync == null ? null : lastSync!.add(_clock!.elapsed);
  Duration get remaining => valid ? _duration - _clock!.elapsed : Duration.zero;
  void revoke() {
    _clock?.stop();
    _clock = null;
  }
}

class _Database extends GeneratedDatabase {
  _Database(super.executor);
  @override
  int get schemaVersion => 1;
  @override
  Iterable<TableInfo<Table, Object?>> get allTables => const [];
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => const [];
  @override
  MigrationStrategy get migration => MigrationStrategy(
    onCreate: (_) async {
      await customStatement(
        'CREATE TABLE IF NOT EXISTS cache (bucket TEXT PRIMARY KEY, payload TEXT NOT NULL)',
      );
      await customStatement(
        'CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY, payload TEXT NOT NULL, digest TEXT NOT NULL, status TEXT NOT NULL, error TEXT, created_at TEXT NOT NULL)',
      );
      await customStatement(
        'CREATE TABLE IF NOT EXISTS drafts (id TEXT PRIMARY KEY, payload TEXT NOT NULL)',
      );
    },
  );
}

class OfflineStore {
  OfflineStore._(
    this.accountId,
    this._cache,
    this._outbox,
    this._cacheFile,
    this._cacheKeyName,
  );
  static const _secure = FlutterSecureStorage();
  final String accountId;
  final _Database _cache;
  final _Database _outbox;
  final File _cacheFile;
  final String _cacheKeyName;
  final lease = OfflineLease();
  bool _revoked = false;
  bool _cacheClosed = false;
  bool get leaseValid => !_revoked && lease.valid;
  DateTime? get lastSync => lease.lastSync;
  DateTime? get trustedNow => lease.trustedNow;

  static Future<OfflineStore> open(
    String accountId, {
    required int policyEpoch,
    bool onlineAuthorized = false,
  }) async {
    final directory = await getApplicationSupportDirectory();
    final safeId = sha256.convert(utf8.encode(accountId)).toString();
    if (onlineAuthorized) await _secure.delete(key: '$safeId.revoked');
    if (await _secure.read(key: '$safeId.revoked') == 'true') {
      throw StateError(
        'Offline qoralamalar qulflangan. Operator orqali tiklash talab etiladi.',
      );
    }
    // A scope change starts a new encrypted partition. Work from older scopes
    // stays encrypted for operator recovery and is never loaded under the new scope.
    final partition = '$safeId.$policyEpoch';
    final cacheFile = File(p.join(directory.path, '$partition.cache.sqlite'));
    Future<_Database> database(String suffix, File file) async {
      final keyName = '$partition.$suffix.key';
      var key = await _secure.read(key: keyName);
      if (key == null) {
        final random = Random.secure();
        key = List.generate(
          32,
          (_) => random.nextInt(256).toRadixString(16).padLeft(2, '0'),
        ).join();
        await _secure.write(key: keyName, value: key);
      }
      final databaseKey = key;
      final db = _Database(
        NativeDatabase.createInBackground(
          file,
          setup: (native) {
            native.execute("PRAGMA cipher = 'sqlcipher'");
            final cipher = native.select('PRAGMA cipher');
            if (cipher.isEmpty) {
              throw StateError(
                'Shifrlash mavjud emas. Offline saqlash bloklandi.',
              );
            }
            native.execute("PRAGMA key = '$databaseKey'");
            native.execute('PRAGMA foreign_keys = ON');
          },
        ),
      );
      await db.customSelect('SELECT count(*) FROM sqlite_master').get();
      return db;
    }

    final cache = await database('cache', cacheFile);
    try {
      final outbox = await database(
        'outbox',
        File(p.join(directory.path, '$partition.outbox.sqlite')),
      );
      return OfflineStore._(
        accountId,
        cache,
        outbox,
        cacheFile,
        '$partition.cache.key',
      );
    } catch (_) {
      await cache.close();
      rethrow;
    }
  }

  void authorize(DateTime serverTime, Duration duration) {
    if (_revoked) throw StateError('Hisob ruxsati bekor qilingan');
    lease.authorize(serverTime, duration);
  }

  Future<void> putCache(String bucket, List<Map<String, dynamic>> items) async {
    if (!leaseValid) throw StateError('Offline ruxsat yangilanishi kerak');
    await _cache.customStatement(
      'INSERT OR REPLACE INTO cache (bucket,payload) VALUES (?,?)',
      [bucket, jsonEncode(items)],
    );
  }

  Future<List<Map<String, dynamic>>> readCache(String bucket) async {
    if (!leaseValid) {
      throw StateError('Offline ruxsat muddati tugagan. Internetga ulaning.');
    }
    final rows = await _cache
        .customSelect(
          'SELECT payload FROM cache WHERE bucket=?',
          variables: [Variable(bucket)],
        )
        .get();
    if (rows.isEmpty) return [];
    return (jsonDecode(rows.first.read<String>('payload')) as List)
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }

  Future<String> queue(Map<String, dynamic> operation) async {
    if (_revoked) {
      throw StateError('Hisob ruxsati bekor qilingan. Qoralamalar qulflangan.');
    }
    final id = operation['operation_id'] as String? ?? const Uuid().v4();
    final payload = jsonEncode({...operation, 'operation_id': id});
    await _outbox.customStatement(
      'INSERT INTO outbox (id,payload,digest,status,created_at) VALUES (?,?,?,?,?)',
      [
        id,
        payload,
        sha256.convert(utf8.encode(payload)).toString(),
        'pending',
        DateTime.now().toUtc().toIso8601String(),
      ],
    );
    return id;
  }

  Future<void> saveDraft(String id, Map<String, dynamic> data) async {
    if (_revoked) throw StateError('Qoralamalar qulflangan.');
    await _outbox.customStatement(
      'INSERT OR REPLACE INTO drafts(id,payload) VALUES (?,?)',
      [id, jsonEncode(data)],
    );
  }

  Future<Map<String, dynamic>?> readDraft(String id) async {
    if (_revoked) throw StateError('Qoralamalar qulflangan.');
    final rows = await _outbox
        .customSelect(
          'SELECT payload FROM drafts WHERE id=?',
          variables: [Variable(id)],
        )
        .get();
    return rows.isEmpty
        ? null
        : Map<String, dynamic>.from(
            jsonDecode(rows.first.read<String>('payload')) as Map,
          );
  }

  Future<void> deleteDraft(String id) async =>
      _outbox.customStatement('DELETE FROM drafts WHERE id=?', [id]);

  Future<List<Map<String, dynamic>>> pending({
    bool includeConflicts = false,
  }) async {
    if (_revoked) {
      throw StateError('Qoralamalar ruxsat tiklanguncha qulflangan.');
    }
    final rows = await _outbox
        .customSelect(
          includeConflicts ? 'SELECT * FROM outbox ORDER BY created_at' : "SELECT * FROM outbox WHERE status='pending' ORDER BY created_at",
        )
        .get();
    return rows
        .map(
          (row) => {
            ...Map<String, dynamic>.from(
              jsonDecode(row.read<String>('payload')) as Map,
            ),
            '_status': row.read<String>('status'),
            '_error': row.readNullable<String>('error'),
          },
        )
        .toList();
  }

  Future<void> settle(String id, {String? conflict}) async {
    if (conflict == null) {
      await _outbox.customStatement('DELETE FROM outbox WHERE id=?', [id]);
    } else {
      await _outbox.customStatement(
        "UPDATE outbox SET status='conflict',error=? WHERE id=?",
        [conflict, id],
      );
    }
  }

  Future<void> retry(String id) async {
    if (_revoked) throw StateError('Qoralamalar qulflangan.');
    await _outbox.customStatement(
      "UPDATE outbox SET status='pending',error=NULL WHERE id=?",
      [id],
    );
  }

  Future<void> revoke() async {
    _revoked = true;
    lease.revoke();
    final safeId = sha256.convert(utf8.encode(accountId)).toString();
    await _secure.write(key: '$safeId.revoked', value: 'true');
    await invalidateCache();
    // Pending work is encrypted separately and remains locked until the server
    // authorizes a new session with the same permission epoch, or operator recovery.
  }

  Future<void> invalidateCache() async {
    lease.revoke();
    if (!_cacheClosed) await _cache.close();
    _cacheClosed = true;
    await _secure.delete(key: _cacheKeyName);
    for (final suffix in ['', '-wal', '-shm']) {
      final file = File('${_cacheFile.path}$suffix');
      if (await file.exists()) await file.delete();
    }
  }

  Future<void> close() async {
    if (!_cacheClosed) await _cache.close();
    await _outbox.close();
    lease.revoke();
  }
}
