import 'package:freezed_annotation/freezed_annotation.dart';

part 'models.freezed.dart';
part 'models.g.dart';

@freezed
abstract class Account with _$Account {
  const Account._();
  const factory Account({
    required String id,
    required String phone,
    @JsonKey(name: 'full_name') @Default('') String fullName,
    @Default('citizen') String role,
    @JsonKey(name: 'employee_status') String? employeeStatus,
    @JsonKey(name: 'organization_id') String? organizationId,
    @JsonKey(name: 'region_id') String? regionId,
    @JsonKey(name: 'district_id') String? districtId,
    @JsonKey(name: 'policy_epoch') @Default(1) int policyEpoch,
  }) = _Account;
  factory Account.fromJson(Map<String, dynamic> json) =>
      _$AccountFromJson(json);
  bool get isEmployee =>
      const {
        'verified_employee',
        'regional_supervisor',
        'infrastructure_inspector',
        'data_reviewer',
        'system_administrator',
        'super_administrator',
      }.contains(role) &&
      employeeStatus == 'verified';
}

@freezed
abstract class InfrastructureRecord with _$InfrastructureRecord {
  const InfrastructureRecord._();
  const factory InfrastructureRecord({
    required String id,
    @Default('') String code,
    required String name,
    @Default('') String description,
    @JsonKey(name: 'category_id') required String categoryId,
    @JsonKey(name: 'region_id') required String regionId,
    @JsonKey(name: 'district_id') String? districtId,
    @Default({}) Map<String, dynamic> geometry,
    @JsonKey(name: 'operational_status')
    @Default('unknown')
    String operationalStatus,
    @Default('draft') String lifecycle,
    @Default('restricted') String sensitivity,
    @Default(1) int version,
    @Default({}) Map<String, dynamic> passport,
    @JsonKey(name: 'accuracy_m') double? accuracyM,
    @JsonKey(name: 'updated_at') String? updatedAt,
    @JsonKey(name: 'is_synthetic') @Default(false) bool isSynthetic,
  }) = _InfrastructureRecord;
  factory InfrastructureRecord.fromJson(Map<String, dynamic> json) =>
      _$InfrastructureRecordFromJson(json);
}
