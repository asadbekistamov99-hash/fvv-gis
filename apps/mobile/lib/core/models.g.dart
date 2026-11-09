// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_Account _$AccountFromJson(Map<String, dynamic> json) => _Account(
  id: json['id'] as String,
  phone: json['phone'] as String,
  fullName: json['full_name'] as String? ?? '',
  role: json['role'] as String? ?? 'citizen',
  employeeStatus: json['employee_status'] as String?,
  organizationId: json['organization_id'] as String?,
  regionId: json['region_id'] as String?,
  districtId: json['district_id'] as String?,
  policyEpoch: (json['policy_epoch'] as num?)?.toInt() ?? 1,
);

Map<String, dynamic> _$AccountToJson(_Account instance) => <String, dynamic>{
  'id': instance.id,
  'phone': instance.phone,
  'full_name': instance.fullName,
  'role': instance.role,
  'employee_status': instance.employeeStatus,
  'organization_id': instance.organizationId,
  'region_id': instance.regionId,
  'district_id': instance.districtId,
  'policy_epoch': instance.policyEpoch,
};

_InfrastructureRecord _$InfrastructureRecordFromJson(
  Map<String, dynamic> json,
) => _InfrastructureRecord(
  id: json['id'] as String,
  code: json['code'] as String? ?? '',
  name: json['name'] as String,
  description: json['description'] as String? ?? '',
  categoryId: json['category_id'] as String,
  regionId: json['region_id'] as String,
  districtId: json['district_id'] as String?,
  geometry: json['geometry'] as Map<String, dynamic>? ?? const {},
  operationalStatus: json['operational_status'] as String? ?? 'unknown',
  lifecycle: json['lifecycle'] as String? ?? 'draft',
  sensitivity: json['sensitivity'] as String? ?? 'restricted',
  version: (json['version'] as num?)?.toInt() ?? 1,
  passport: json['passport'] as Map<String, dynamic>? ?? const {},
  accuracyM: (json['accuracy_m'] as num?)?.toDouble(),
  updatedAt: json['updated_at'] as String?,
  isSynthetic: json['is_synthetic'] as bool? ?? false,
);

Map<String, dynamic> _$InfrastructureRecordToJson(
  _InfrastructureRecord instance,
) => <String, dynamic>{
  'id': instance.id,
  'code': instance.code,
  'name': instance.name,
  'description': instance.description,
  'category_id': instance.categoryId,
  'region_id': instance.regionId,
  'district_id': instance.districtId,
  'geometry': instance.geometry,
  'operational_status': instance.operationalStatus,
  'lifecycle': instance.lifecycle,
  'sensitivity': instance.sensitivity,
  'version': instance.version,
  'passport': instance.passport,
  'accuracy_m': instance.accuracyM,
  'updated_at': instance.updatedAt,
  'is_synthetic': instance.isSynthetic,
};
