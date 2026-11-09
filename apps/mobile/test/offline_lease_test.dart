import 'package:flutter_test/flutter_test.dart';
import 'package:fvv_gis_uzbekistan/core/offline_store.dart';

void main() {
  group('Offline access lease', () {
    test('starts invalid and cannot survive a new process instance', () {
      final current = OfflineLease();
      expect(current.valid, isFalse);
      expect(current.remaining, Duration.zero);
      current.authorize(DateTime.utc(2026, 11, 7), const Duration(hours: 8));
      expect(current.valid, isTrue);
      expect(OfflineLease().valid, isFalse);
    });

    test('caps server grants at eight hours', () {
      final lease = OfflineLease();
      final serverTime = DateTime.utc(2026, 11, 7, 6);
      lease.authorize(serverTime, const Duration(days: 3));
      expect(lease.remaining, lessThanOrEqualTo(const Duration(hours: 8)));
      expect(
        lease.remaining,
        greaterThan(const Duration(hours: 7, minutes: 59)),
      );
      expect(lease.lastSync, serverTime);
    });

    test('zero and expired grants never grant offline access', () {
      final lease = OfflineLease();
      lease.authorize(DateTime.utc(2026), Duration.zero);
      expect(lease.valid, isFalse);
      lease.authorize(DateTime.utc(2026), const Duration(seconds: -1));
      expect(lease.valid, isFalse);
      expect(lease.remaining, Duration.zero);
    });

    test('expires using elapsed time', () async {
      final lease = OfflineLease();
      lease.authorize(DateTime.utc(2026), const Duration(milliseconds: 5));
      await Future<void>.delayed(const Duration(milliseconds: 25));
      expect(lease.valid, isFalse);
      expect(lease.remaining, Duration.zero);
    });

    test('revocation removes access immediately', () {
      final lease = OfflineLease();
      lease.authorize(DateTime.utc(2026), const Duration(hours: 8));
      lease.revoke();
      expect(lease.valid, isFalse);
      expect(lease.remaining, Duration.zero);
    });
  });
}
