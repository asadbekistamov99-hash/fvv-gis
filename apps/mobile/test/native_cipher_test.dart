import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:sqlite3/sqlite3.dart';

void main() {
  test('offline SQLite files require the account encryption key', () {
    final directory = Directory.systemTemp.createTempSync('fvv-cipher-test-');
    final file = File('${directory.path}/cache.sqlite');
    const key = 'synthetic-test-key-do-not-use-for-production';
    const value = 'synthetic-sensitive-coordinate';
    try {
      final database = sqlite3.open(file.path);
      database.execute("PRAGMA cipher = 'sqlcipher'");
      expect(database.select('PRAGMA cipher'), isNotEmpty);
      database.execute("PRAGMA key = '$key'");
      database.execute('CREATE TABLE test_cache (value TEXT, pressure REAL)');
      database.execute('INSERT INTO test_cache VALUES (?, NULL)', [value]);
      database.close();

      expect(
        file.readAsBytesSync().take(16).toList(),
        isNot('SQLite format 3\u0000'.codeUnits),
      );
      final unkeyed = sqlite3.open(file.path);
      expect(
        () => unkeyed.select('SELECT * FROM test_cache'),
        throwsA(isA<SqliteException>()),
      );
      unkeyed.close();

      final restored = sqlite3.open(file.path);
      restored.execute("PRAGMA cipher = 'sqlcipher'");
      restored.execute("PRAGMA key = '$key'");
      final row = restored.select('SELECT * FROM test_cache').single;
      expect(row['value'], value);
      expect(row['pressure'], isNull);
      restored.close();
    } finally {
      directory.deleteSync(recursive: true);
    }
  });
}
