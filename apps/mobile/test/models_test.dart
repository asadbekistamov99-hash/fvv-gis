import 'package:flutter_test/flutter_test.dart';
import 'package:fvv_gis_uzbekistan/core/models.dart';

void main() {
  group('Server-provided account classification', () {
    Account account(String role, String? status) => Account(
      id: 'synthetic-account',
      phone: '+998901234567',
      role: role,
      employeeStatus: status,
    );

    test('citizens and pending employees retain citizen navigation', () {
      expect(account('citizen', 'none').isEmployee, isFalse);
      expect(
        account('pending_employee', 'pending_verification').isEmployee,
        isFalse,
      );
      expect(
        account('verified_employee', 'pending_verification').isEmployee,
        isFalse,
      );
    });

    test('unknown roles or unverified statuses do not enable employee UI', () {
      expect(account('unrecognized_role', 'verified').isEmployee, isFalse);
      expect(account('verified_employee', null).isEmployee, isFalse);
      expect(account('verified_employee', 'suspended').isEmployee, isFalse);
    });

    test(
      'each supported verified employee role receives employee navigation',
      () {
        for (final role in [
          'verified_employee',
          'regional_supervisor',
          'infrastructure_inspector',
          'data_reviewer',
          'system_administrator',
          'super_administrator',
        ]) {
          expect(account(role, 'verified').isEmployee, isTrue, reason: role);
        }
      },
    );
  });

  test('passport JSON preserves unknown measurements and explicit zero', () {
    final input = <String, dynamic>{
      'id': 'synthetic-object',
      'name': 'SINTETIK DEMO',
      'category_id': 'fire_hydrants',
      'region_id': 'UZ-TO',
      'geometry': {
        'type': 'Point',
        'coordinates': [69.2, 41.3],
      },
      'operational_status': 'faulty',
      'version': 4,
      'accuracy_m': null,
      'passport': {
        'measured_pressure_kpa': null,
        'flow_lps': 0,
        'measurement_date': '2026-11-07T06:00:00Z',
      },
      'is_synthetic': true,
    };
    final record = InfrastructureRecord.fromJson(input);
    expect(record.accuracyM, isNull);
    expect(record.passport['measured_pressure_kpa'], isNull);
    expect(record.passport['flow_lps'], 0);
    expect(record.operationalStatus, 'faulty');
    final json = record.toJson();
    expect(json['passport'], input['passport']);
    expect(json['version'], 4);
    expect(json['is_synthetic'], isTrue);
    expect(record.copyWith(name: 'Changed synthetic name').version, 4);
  });
}
