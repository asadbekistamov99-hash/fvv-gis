// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$Account {

 String get id; String get phone;@JsonKey(name: 'full_name') String get fullName; String get role;@JsonKey(name: 'employee_status') String? get employeeStatus;@JsonKey(name: 'organization_id') String? get organizationId;@JsonKey(name: 'region_id') String? get regionId;@JsonKey(name: 'district_id') String? get districtId;@JsonKey(name: 'policy_epoch') int get policyEpoch;
/// Create a copy of Account
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AccountCopyWith<Account> get copyWith => _$AccountCopyWithImpl<Account>(this as Account, _$identity);

  /// Serializes this Account to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as Account;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Account&&(identical(other.id, _this.id) || other.id == _this.id)&&(identical(other.phone, _this.phone) || other.phone == _this.phone)&&(identical(other.fullName, _this.fullName) || other.fullName == _this.fullName)&&(identical(other.role, _this.role) || other.role == _this.role)&&(identical(other.employeeStatus, _this.employeeStatus) || other.employeeStatus == _this.employeeStatus)&&(identical(other.organizationId, _this.organizationId) || other.organizationId == _this.organizationId)&&(identical(other.regionId, _this.regionId) || other.regionId == _this.regionId)&&(identical(other.districtId, _this.districtId) || other.districtId == _this.districtId)&&(identical(other.policyEpoch, _this.policyEpoch) || other.policyEpoch == _this.policyEpoch));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as Account;
  return Object.hash(runtimeType,_this.id,_this.phone,_this.fullName,_this.role,_this.employeeStatus,_this.organizationId,_this.regionId,_this.districtId,_this.policyEpoch);
}

@override
String toString() {
  final _this = this as Account;
  return 'Account(id: ${_this.id}, phone: ${_this.phone}, fullName: ${_this.fullName}, role: ${_this.role}, employeeStatus: ${_this.employeeStatus}, organizationId: ${_this.organizationId}, regionId: ${_this.regionId}, districtId: ${_this.districtId}, policyEpoch: ${_this.policyEpoch})';
}


}

/// @nodoc
abstract mixin class $AccountCopyWith<$Res>  {
  factory $AccountCopyWith(Account value, $Res Function(Account) _then) = _$AccountCopyWithImpl;
@useResult
$Res call({
 String id, String phone,@JsonKey(name: 'full_name') String fullName, String role,@JsonKey(name: 'employee_status') String? employeeStatus,@JsonKey(name: 'organization_id') String? organizationId,@JsonKey(name: 'region_id') String? regionId,@JsonKey(name: 'district_id') String? districtId,@JsonKey(name: 'policy_epoch') int policyEpoch
});




}
/// @nodoc
class _$AccountCopyWithImpl<$Res>
    implements $AccountCopyWith<$Res> {
  _$AccountCopyWithImpl(this._self, this._then);

  final Account _self;
  final $Res Function(Account) _then;

/// Create a copy of Account
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? phone = null,Object? fullName = null,Object? role = null,Object? employeeStatus = freezed,Object? organizationId = freezed,Object? regionId = freezed,Object? districtId = freezed,Object? policyEpoch = null,}) {
  return _then(Account(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,phone: null == phone ? _self.phone : phone // ignore: cast_nullable_to_non_nullable
as String,fullName: null == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String,role: null == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as String,employeeStatus: freezed == employeeStatus ? _self.employeeStatus : employeeStatus // ignore: cast_nullable_to_non_nullable
as String?,organizationId: freezed == organizationId ? _self.organizationId : organizationId // ignore: cast_nullable_to_non_nullable
as String?,regionId: freezed == regionId ? _self.regionId : regionId // ignore: cast_nullable_to_non_nullable
as String?,districtId: freezed == districtId ? _self.districtId : districtId // ignore: cast_nullable_to_non_nullable
as String?,policyEpoch: null == policyEpoch ? _self.policyEpoch : policyEpoch // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [Account].
extension AccountPatterns on Account {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Account value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Account() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Account value)  $default,){
final _that = this;
switch (_that) {
case _Account():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Account value)?  $default,){
final _that = this;
switch (_that) {
case _Account() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String phone, @JsonKey(name: 'full_name')  String fullName,  String role, @JsonKey(name: 'employee_status')  String? employeeStatus, @JsonKey(name: 'organization_id')  String? organizationId, @JsonKey(name: 'region_id')  String? regionId, @JsonKey(name: 'district_id')  String? districtId, @JsonKey(name: 'policy_epoch')  int policyEpoch)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _Account() when $default != null:
return $default(_that.id,_that.phone,_that.fullName,_that.role,_that.employeeStatus,_that.organizationId,_that.regionId,_that.districtId,_that.policyEpoch);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String phone, @JsonKey(name: 'full_name')  String fullName,  String role, @JsonKey(name: 'employee_status')  String? employeeStatus, @JsonKey(name: 'organization_id')  String? organizationId, @JsonKey(name: 'region_id')  String? regionId, @JsonKey(name: 'district_id')  String? districtId, @JsonKey(name: 'policy_epoch')  int policyEpoch)  $default,) {final _that = this;
switch (_that) {
case _Account():
return $default(_that.id,_that.phone,_that.fullName,_that.role,_that.employeeStatus,_that.organizationId,_that.regionId,_that.districtId,_that.policyEpoch);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String phone, @JsonKey(name: 'full_name')  String fullName,  String role, @JsonKey(name: 'employee_status')  String? employeeStatus, @JsonKey(name: 'organization_id')  String? organizationId, @JsonKey(name: 'region_id')  String? regionId, @JsonKey(name: 'district_id')  String? districtId, @JsonKey(name: 'policy_epoch')  int policyEpoch)?  $default,) {final _that = this;
switch (_that) {
case _Account() when $default != null:
return $default(_that.id,_that.phone,_that.fullName,_that.role,_that.employeeStatus,_that.organizationId,_that.regionId,_that.districtId,_that.policyEpoch);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _Account extends Account {
  const _Account({required this.id, required this.phone, @JsonKey(name: 'full_name') this.fullName = '', this.role = 'citizen', @JsonKey(name: 'employee_status') this.employeeStatus, @JsonKey(name: 'organization_id') this.organizationId, @JsonKey(name: 'region_id') this.regionId, @JsonKey(name: 'district_id') this.districtId, @JsonKey(name: 'policy_epoch') this.policyEpoch = 1}): super._();
  factory _Account.fromJson(Map<String, dynamic> json) => _$AccountFromJson(json);

@override final  String id;
@override final  String phone;
@override@JsonKey(name: 'full_name') final  String fullName;
@override@JsonKey() final  String role;
@override@JsonKey(name: 'employee_status') final  String? employeeStatus;
@override@JsonKey(name: 'organization_id') final  String? organizationId;
@override@JsonKey(name: 'region_id') final  String? regionId;
@override@JsonKey(name: 'district_id') final  String? districtId;
@override@JsonKey(name: 'policy_epoch') final  int policyEpoch;

/// Create a copy of Account
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AccountCopyWith<_Account> get copyWith => __$AccountCopyWithImpl<_Account>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AccountToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _Account&&(identical(other.id, id) || other.id == id)&&(identical(other.phone, phone) || other.phone == phone)&&(identical(other.fullName, fullName) || other.fullName == fullName)&&(identical(other.role, role) || other.role == role)&&(identical(other.employeeStatus, employeeStatus) || other.employeeStatus == employeeStatus)&&(identical(other.organizationId, organizationId) || other.organizationId == organizationId)&&(identical(other.regionId, regionId) || other.regionId == regionId)&&(identical(other.districtId, districtId) || other.districtId == districtId)&&(identical(other.policyEpoch, policyEpoch) || other.policyEpoch == policyEpoch));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,id,phone,fullName,role,employeeStatus,organizationId,regionId,districtId,policyEpoch);
}

@override
String toString() {
    return 'Account(id: $id, phone: $phone, fullName: $fullName, role: $role, employeeStatus: $employeeStatus, organizationId: $organizationId, regionId: $regionId, districtId: $districtId, policyEpoch: $policyEpoch)';
}


}

/// @nodoc
abstract mixin class _$AccountCopyWith<$Res> implements $AccountCopyWith<$Res> {
  factory _$AccountCopyWith(_Account value, $Res Function(_Account) _then) = __$AccountCopyWithImpl;
@override @useResult
$Res call({
 String id, String phone,@JsonKey(name: 'full_name') String fullName, String role,@JsonKey(name: 'employee_status') String? employeeStatus,@JsonKey(name: 'organization_id') String? organizationId,@JsonKey(name: 'region_id') String? regionId,@JsonKey(name: 'district_id') String? districtId,@JsonKey(name: 'policy_epoch') int policyEpoch
});




}
/// @nodoc
class __$AccountCopyWithImpl<$Res>
    implements _$AccountCopyWith<$Res> {
  __$AccountCopyWithImpl(this._self, this._then);

  final _Account _self;
  final $Res Function(_Account) _then;

/// Create a copy of Account
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? phone = null,Object? fullName = null,Object? role = null,Object? employeeStatus = freezed,Object? organizationId = freezed,Object? regionId = freezed,Object? districtId = freezed,Object? policyEpoch = null,}) {
  return _then(_Account(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,phone: null == phone ? _self.phone : phone // ignore: cast_nullable_to_non_nullable
as String,fullName: null == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String,role: null == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as String,employeeStatus: freezed == employeeStatus ? _self.employeeStatus : employeeStatus // ignore: cast_nullable_to_non_nullable
as String?,organizationId: freezed == organizationId ? _self.organizationId : organizationId // ignore: cast_nullable_to_non_nullable
as String?,regionId: freezed == regionId ? _self.regionId : regionId // ignore: cast_nullable_to_non_nullable
as String?,districtId: freezed == districtId ? _self.districtId : districtId // ignore: cast_nullable_to_non_nullable
as String?,policyEpoch: null == policyEpoch ? _self.policyEpoch : policyEpoch // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}


/// @nodoc
mixin _$InfrastructureRecord {

 String get id; String get code; String get name; String get description;@JsonKey(name: 'category_id') String get categoryId;@JsonKey(name: 'region_id') String get regionId;@JsonKey(name: 'district_id') String? get districtId; Map<String, dynamic> get geometry;@JsonKey(name: 'operational_status') String get operationalStatus; String get lifecycle; String get sensitivity; int get version; Map<String, dynamic> get passport;@JsonKey(name: 'accuracy_m') double? get accuracyM;@JsonKey(name: 'updated_at') String? get updatedAt;@JsonKey(name: 'is_synthetic') bool get isSynthetic;
/// Create a copy of InfrastructureRecord
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$InfrastructureRecordCopyWith<InfrastructureRecord> get copyWith => _$InfrastructureRecordCopyWithImpl<InfrastructureRecord>(this as InfrastructureRecord, _$identity);

  /// Serializes this InfrastructureRecord to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as InfrastructureRecord;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is InfrastructureRecord&&(identical(other.id, _this.id) || other.id == _this.id)&&(identical(other.code, _this.code) || other.code == _this.code)&&(identical(other.name, _this.name) || other.name == _this.name)&&(identical(other.description, _this.description) || other.description == _this.description)&&(identical(other.categoryId, _this.categoryId) || other.categoryId == _this.categoryId)&&(identical(other.regionId, _this.regionId) || other.regionId == _this.regionId)&&(identical(other.districtId, _this.districtId) || other.districtId == _this.districtId)&&const DeepCollectionEquality().equals(other.geometry, _this.geometry)&&(identical(other.operationalStatus, _this.operationalStatus) || other.operationalStatus == _this.operationalStatus)&&(identical(other.lifecycle, _this.lifecycle) || other.lifecycle == _this.lifecycle)&&(identical(other.sensitivity, _this.sensitivity) || other.sensitivity == _this.sensitivity)&&(identical(other.version, _this.version) || other.version == _this.version)&&const DeepCollectionEquality().equals(other.passport, _this.passport)&&(identical(other.accuracyM, _this.accuracyM) || other.accuracyM == _this.accuracyM)&&(identical(other.updatedAt, _this.updatedAt) || other.updatedAt == _this.updatedAt)&&(identical(other.isSynthetic, _this.isSynthetic) || other.isSynthetic == _this.isSynthetic));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as InfrastructureRecord;
  return Object.hash(runtimeType,_this.id,_this.code,_this.name,_this.description,_this.categoryId,_this.regionId,_this.districtId,const DeepCollectionEquality().hash(_this.geometry),_this.operationalStatus,_this.lifecycle,_this.sensitivity,_this.version,const DeepCollectionEquality().hash(_this.passport),_this.accuracyM,_this.updatedAt,_this.isSynthetic);
}

@override
String toString() {
  final _this = this as InfrastructureRecord;
  return 'InfrastructureRecord(id: ${_this.id}, code: ${_this.code}, name: ${_this.name}, description: ${_this.description}, categoryId: ${_this.categoryId}, regionId: ${_this.regionId}, districtId: ${_this.districtId}, geometry: ${_this.geometry}, operationalStatus: ${_this.operationalStatus}, lifecycle: ${_this.lifecycle}, sensitivity: ${_this.sensitivity}, version: ${_this.version}, passport: ${_this.passport}, accuracyM: ${_this.accuracyM}, updatedAt: ${_this.updatedAt}, isSynthetic: ${_this.isSynthetic})';
}


}

/// @nodoc
abstract mixin class $InfrastructureRecordCopyWith<$Res>  {
  factory $InfrastructureRecordCopyWith(InfrastructureRecord value, $Res Function(InfrastructureRecord) _then) = _$InfrastructureRecordCopyWithImpl;
@useResult
$Res call({
 String id, String code, String name, String description,@JsonKey(name: 'category_id') String categoryId,@JsonKey(name: 'region_id') String regionId,@JsonKey(name: 'district_id') String? districtId, Map<String, dynamic> geometry,@JsonKey(name: 'operational_status') String operationalStatus, String lifecycle, String sensitivity, int version, Map<String, dynamic> passport,@JsonKey(name: 'accuracy_m') double? accuracyM,@JsonKey(name: 'updated_at') String? updatedAt,@JsonKey(name: 'is_synthetic') bool isSynthetic
});




}
/// @nodoc
class _$InfrastructureRecordCopyWithImpl<$Res>
    implements $InfrastructureRecordCopyWith<$Res> {
  _$InfrastructureRecordCopyWithImpl(this._self, this._then);

  final InfrastructureRecord _self;
  final $Res Function(InfrastructureRecord) _then;

/// Create a copy of InfrastructureRecord
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? code = null,Object? name = null,Object? description = null,Object? categoryId = null,Object? regionId = null,Object? districtId = freezed,Object? geometry = null,Object? operationalStatus = null,Object? lifecycle = null,Object? sensitivity = null,Object? version = null,Object? passport = null,Object? accuracyM = freezed,Object? updatedAt = freezed,Object? isSynthetic = null,}) {
  return _then(InfrastructureRecord(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,code: null == code ? _self.code : code // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,description: null == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String,categoryId: null == categoryId ? _self.categoryId : categoryId // ignore: cast_nullable_to_non_nullable
as String,regionId: null == regionId ? _self.regionId : regionId // ignore: cast_nullable_to_non_nullable
as String,districtId: freezed == districtId ? _self.districtId : districtId // ignore: cast_nullable_to_non_nullable
as String?,geometry: null == geometry ? _self.geometry : geometry // ignore: cast_nullable_to_non_nullable
as Map<String, dynamic>,operationalStatus: null == operationalStatus ? _self.operationalStatus : operationalStatus // ignore: cast_nullable_to_non_nullable
as String,lifecycle: null == lifecycle ? _self.lifecycle : lifecycle // ignore: cast_nullable_to_non_nullable
as String,sensitivity: null == sensitivity ? _self.sensitivity : sensitivity // ignore: cast_nullable_to_non_nullable
as String,version: null == version ? _self.version : version // ignore: cast_nullable_to_non_nullable
as int,passport: null == passport ? _self.passport : passport // ignore: cast_nullable_to_non_nullable
as Map<String, dynamic>,accuracyM: freezed == accuracyM ? _self.accuracyM : accuracyM // ignore: cast_nullable_to_non_nullable
as double?,updatedAt: freezed == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as String?,isSynthetic: null == isSynthetic ? _self.isSynthetic : isSynthetic // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [InfrastructureRecord].
extension InfrastructureRecordPatterns on InfrastructureRecord {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _InfrastructureRecord value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _InfrastructureRecord() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _InfrastructureRecord value)  $default,){
final _that = this;
switch (_that) {
case _InfrastructureRecord():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _InfrastructureRecord value)?  $default,){
final _that = this;
switch (_that) {
case _InfrastructureRecord() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String code,  String name,  String description, @JsonKey(name: 'category_id')  String categoryId, @JsonKey(name: 'region_id')  String regionId, @JsonKey(name: 'district_id')  String? districtId,  Map<String, dynamic> geometry, @JsonKey(name: 'operational_status')  String operationalStatus,  String lifecycle,  String sensitivity,  int version,  Map<String, dynamic> passport, @JsonKey(name: 'accuracy_m')  double? accuracyM, @JsonKey(name: 'updated_at')  String? updatedAt, @JsonKey(name: 'is_synthetic')  bool isSynthetic)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _InfrastructureRecord() when $default != null:
return $default(_that.id,_that.code,_that.name,_that.description,_that.categoryId,_that.regionId,_that.districtId,_that.geometry,_that.operationalStatus,_that.lifecycle,_that.sensitivity,_that.version,_that.passport,_that.accuracyM,_that.updatedAt,_that.isSynthetic);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String code,  String name,  String description, @JsonKey(name: 'category_id')  String categoryId, @JsonKey(name: 'region_id')  String regionId, @JsonKey(name: 'district_id')  String? districtId,  Map<String, dynamic> geometry, @JsonKey(name: 'operational_status')  String operationalStatus,  String lifecycle,  String sensitivity,  int version,  Map<String, dynamic> passport, @JsonKey(name: 'accuracy_m')  double? accuracyM, @JsonKey(name: 'updated_at')  String? updatedAt, @JsonKey(name: 'is_synthetic')  bool isSynthetic)  $default,) {final _that = this;
switch (_that) {
case _InfrastructureRecord():
return $default(_that.id,_that.code,_that.name,_that.description,_that.categoryId,_that.regionId,_that.districtId,_that.geometry,_that.operationalStatus,_that.lifecycle,_that.sensitivity,_that.version,_that.passport,_that.accuracyM,_that.updatedAt,_that.isSynthetic);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String code,  String name,  String description, @JsonKey(name: 'category_id')  String categoryId, @JsonKey(name: 'region_id')  String regionId, @JsonKey(name: 'district_id')  String? districtId,  Map<String, dynamic> geometry, @JsonKey(name: 'operational_status')  String operationalStatus,  String lifecycle,  String sensitivity,  int version,  Map<String, dynamic> passport, @JsonKey(name: 'accuracy_m')  double? accuracyM, @JsonKey(name: 'updated_at')  String? updatedAt, @JsonKey(name: 'is_synthetic')  bool isSynthetic)?  $default,) {final _that = this;
switch (_that) {
case _InfrastructureRecord() when $default != null:
return $default(_that.id,_that.code,_that.name,_that.description,_that.categoryId,_that.regionId,_that.districtId,_that.geometry,_that.operationalStatus,_that.lifecycle,_that.sensitivity,_that.version,_that.passport,_that.accuracyM,_that.updatedAt,_that.isSynthetic);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _InfrastructureRecord extends InfrastructureRecord {
  const _InfrastructureRecord({required this.id, this.code = '', required this.name, this.description = '', @JsonKey(name: 'category_id') required this.categoryId, @JsonKey(name: 'region_id') required this.regionId, @JsonKey(name: 'district_id') this.districtId,  Map<String, dynamic> geometry = const {}, @JsonKey(name: 'operational_status') this.operationalStatus = 'unknown', this.lifecycle = 'draft', this.sensitivity = 'restricted', this.version = 1,  Map<String, dynamic> passport = const {}, @JsonKey(name: 'accuracy_m') this.accuracyM, @JsonKey(name: 'updated_at') this.updatedAt, @JsonKey(name: 'is_synthetic') this.isSynthetic = false}): _geometry = geometry,_passport = passport,super._();
  factory _InfrastructureRecord.fromJson(Map<String, dynamic> json) => _$InfrastructureRecordFromJson(json);

@override final  String id;
@override@JsonKey() final  String code;
@override final  String name;
@override@JsonKey() final  String description;
@override@JsonKey(name: 'category_id') final  String categoryId;
@override@JsonKey(name: 'region_id') final  String regionId;
@override@JsonKey(name: 'district_id') final  String? districtId;
 final  Map<String, dynamic> _geometry;
@override@JsonKey() Map<String, dynamic> get geometry {
  if (_geometry is EqualUnmodifiableMapView) return _geometry;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(_geometry);
}

@override@JsonKey(name: 'operational_status') final  String operationalStatus;
@override@JsonKey() final  String lifecycle;
@override@JsonKey() final  String sensitivity;
@override@JsonKey() final  int version;
 final  Map<String, dynamic> _passport;
@override@JsonKey() Map<String, dynamic> get passport {
  if (_passport is EqualUnmodifiableMapView) return _passport;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(_passport);
}

@override@JsonKey(name: 'accuracy_m') final  double? accuracyM;
@override@JsonKey(name: 'updated_at') final  String? updatedAt;
@override@JsonKey(name: 'is_synthetic') final  bool isSynthetic;

/// Create a copy of InfrastructureRecord
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$InfrastructureRecordCopyWith<_InfrastructureRecord> get copyWith => __$InfrastructureRecordCopyWithImpl<_InfrastructureRecord>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$InfrastructureRecordToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _InfrastructureRecord&&(identical(other.id, id) || other.id == id)&&(identical(other.code, code) || other.code == code)&&(identical(other.name, name) || other.name == name)&&(identical(other.description, description) || other.description == description)&&(identical(other.categoryId, categoryId) || other.categoryId == categoryId)&&(identical(other.regionId, regionId) || other.regionId == regionId)&&(identical(other.districtId, districtId) || other.districtId == districtId)&&const DeepCollectionEquality().equals(other.geometry, _geometry)&&(identical(other.operationalStatus, operationalStatus) || other.operationalStatus == operationalStatus)&&(identical(other.lifecycle, lifecycle) || other.lifecycle == lifecycle)&&(identical(other.sensitivity, sensitivity) || other.sensitivity == sensitivity)&&(identical(other.version, version) || other.version == version)&&const DeepCollectionEquality().equals(other.passport, _passport)&&(identical(other.accuracyM, accuracyM) || other.accuracyM == accuracyM)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt)&&(identical(other.isSynthetic, isSynthetic) || other.isSynthetic == isSynthetic));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,id,code,name,description,categoryId,regionId,districtId,const DeepCollectionEquality().hash(_geometry),operationalStatus,lifecycle,sensitivity,version,const DeepCollectionEquality().hash(_passport),accuracyM,updatedAt,isSynthetic);
}

@override
String toString() {
    return 'InfrastructureRecord(id: $id, code: $code, name: $name, description: $description, categoryId: $categoryId, regionId: $regionId, districtId: $districtId, geometry: $geometry, operationalStatus: $operationalStatus, lifecycle: $lifecycle, sensitivity: $sensitivity, version: $version, passport: $passport, accuracyM: $accuracyM, updatedAt: $updatedAt, isSynthetic: $isSynthetic)';
}


}

/// @nodoc
abstract mixin class _$InfrastructureRecordCopyWith<$Res> implements $InfrastructureRecordCopyWith<$Res> {
  factory _$InfrastructureRecordCopyWith(_InfrastructureRecord value, $Res Function(_InfrastructureRecord) _then) = __$InfrastructureRecordCopyWithImpl;
@override @useResult
$Res call({
 String id, String code, String name, String description,@JsonKey(name: 'category_id') String categoryId,@JsonKey(name: 'region_id') String regionId,@JsonKey(name: 'district_id') String? districtId, Map<String, dynamic> geometry,@JsonKey(name: 'operational_status') String operationalStatus, String lifecycle, String sensitivity, int version, Map<String, dynamic> passport,@JsonKey(name: 'accuracy_m') double? accuracyM,@JsonKey(name: 'updated_at') String? updatedAt,@JsonKey(name: 'is_synthetic') bool isSynthetic
});




}
/// @nodoc
class __$InfrastructureRecordCopyWithImpl<$Res>
    implements _$InfrastructureRecordCopyWith<$Res> {
  __$InfrastructureRecordCopyWithImpl(this._self, this._then);

  final _InfrastructureRecord _self;
  final $Res Function(_InfrastructureRecord) _then;

/// Create a copy of InfrastructureRecord
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? code = null,Object? name = null,Object? description = null,Object? categoryId = null,Object? regionId = null,Object? districtId = freezed,Object? geometry = null,Object? operationalStatus = null,Object? lifecycle = null,Object? sensitivity = null,Object? version = null,Object? passport = null,Object? accuracyM = freezed,Object? updatedAt = freezed,Object? isSynthetic = null,}) {
  return _then(_InfrastructureRecord(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,code: null == code ? _self.code : code // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,description: null == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String,categoryId: null == categoryId ? _self.categoryId : categoryId // ignore: cast_nullable_to_non_nullable
as String,regionId: null == regionId ? _self.regionId : regionId // ignore: cast_nullable_to_non_nullable
as String,districtId: freezed == districtId ? _self.districtId : districtId // ignore: cast_nullable_to_non_nullable
as String?,geometry: null == geometry ? _self._geometry : geometry // ignore: cast_nullable_to_non_nullable
as Map<String, dynamic>,operationalStatus: null == operationalStatus ? _self.operationalStatus : operationalStatus // ignore: cast_nullable_to_non_nullable
as String,lifecycle: null == lifecycle ? _self.lifecycle : lifecycle // ignore: cast_nullable_to_non_nullable
as String,sensitivity: null == sensitivity ? _self.sensitivity : sensitivity // ignore: cast_nullable_to_non_nullable
as String,version: null == version ? _self.version : version // ignore: cast_nullable_to_non_nullable
as int,passport: null == passport ? _self._passport : passport // ignore: cast_nullable_to_non_nullable
as Map<String, dynamic>,accuracyM: freezed == accuracyM ? _self.accuracyM : accuracyM // ignore: cast_nullable_to_non_nullable
as double?,updatedAt: freezed == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as String?,isSynthetic: null == isSynthetic ? _self.isSynthetic : isSynthetic // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}

// dart format on
