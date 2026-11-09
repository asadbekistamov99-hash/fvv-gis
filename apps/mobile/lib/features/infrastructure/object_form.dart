import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:maplibre_gl/maplibre_gl.dart';
import 'package:uuid/uuid.dart';

import '../../core/api.dart';
import '../../core/l10n.dart';
import '../../core/state.dart';
import '../../core/widgets.dart';
import '../gis/map_screen.dart';

class ObjectForm extends ConsumerStatefulWidget {
  const ObjectForm({super.key, this.objectId});
  final String? objectId;
  @override
  ConsumerState<ObjectForm> createState() => _ObjectFormState();
}

class _ObjectFormState extends ConsumerState<ObjectForm> {
  final form = GlobalKey<FormState>();
  final name = TextEditingController(),
      code = TextEditingController(),
      description = TextEditingController(),
      latitude = TextEditingController(),
      longitude = TextEditingController();
  final Map<String, TextEditingController> technical = {};
  final List<Map<String, dynamic>> attachments = [];
  final List<LatLng> vertices = [];
  Timer? autosave;
  int step = 0, version = 1;
  bool busy = false, restoring = true, saved = false;
  String? categoryId, regionId, error;
  String geometryType = 'Point', status = 'unknown';
  double? accuracy;
  Map<String, dynamic>? saveOperation;
  String get draftId => widget.objectId ?? 'new-object';
  @override
  void initState() {
    super.initState();
    Future.microtask(restore);
  }

  @override
  void dispose() {
    autosave?.cancel();
    for (final c in [
      name,
      code,
      description,
      latitude,
      longitude,
      ...technical.values,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> restore() async {
    try {
      final data = widget.objectId == null
          ? await ref.read(appProvider.notifier).store?.readDraft(draftId)
          : Map<String, dynamic>.from(
              await ref
                      .read(apiProvider)
                      .get('/infrastructure/${widget.objectId}')
                  as Map,
            );
      if (data != null) {
        name.text = data['name']?.toString() ?? '';
        code.text = data['code']?.toString() ?? '';
        description.text = data['description']?.toString() ?? '';
        categoryId = data['category_id'] as String?;
        regionId = data['region_id'] as String?;
        version = (data['version'] as num?)?.toInt() ?? 1;
        status = data['operational_status'] as String? ?? 'unknown';
        accuracy = (data['accuracy_m'] as num?)?.toDouble();
        final geometry = data['geometry'] as Map?;
        if (geometry != null) {
          geometryType = geometry['type'] as String;
          final coordinates = geometry['coordinates'];
          final values = geometryType == 'Point'
              ? [coordinates]
              : geometryType == 'Polygon'
              ? coordinates[0]
              : coordinates;
          for (final c in values as List) {
            vertices.add(
              LatLng((c[1] as num).toDouble(), (c[0] as num).toDouble()),
            );
          }
          if (geometryType == 'Polygon' &&
              vertices.length > 1 &&
              vertices.first == vertices.last) {
            vertices.removeLast();
          }
          if (vertices.isNotEmpty) {
            latitude.text = vertices.first.latitude.toString();
            longitude.text = vertices.first.longitude.toString();
          }
        }
        for (final entry in (data['passport'] as Map? ?? {}).entries) {
          if (entry.value != null && entry.key != 'schema_version') {
            technical[entry.key.toString()] = TextEditingController(
              text: entry.value.toString(),
            );
          }
        }
        attachments.addAll(
          (data['_attachments'] as List? ?? []).map(
            (e) => Map<String, dynamic>.from(e as Map),
          ),
        );
        if (data['_sync_operation'] is Map) {
          saveOperation = Map<String, dynamic>.from(
            data['_sync_operation'] as Map,
          );
        }
      }
    } catch (e) {
      error = readableError(e);
    }
    if (mounted) setState(() => restoring = false);
  }

  List<_Field> fields() {
    final categories = ref.read(categoriesProvider).asData?.value ?? [];
    final category = categories
        .where((e) => e['id'].toString() == categoryId)
        .firstOrNull;
    final slug =
        (category?['code'] ?? category?['slug'] ?? category?['id'] ?? '')
            .toString();
    if (slug.contains('hydrant')) {
      return const [
        _Field('hydrant_type', 'Gidrant turi', 'Тип гидранта', 'Hydrant type'),
        _Field(
          'installation_type',
          'O‘rnatish turi',
          'Способ установки',
          'Installation type',
        ),
        _Field(
          'manufacturer',
          'Ishlab chiqaruvchi',
          'Производитель',
          'Manufacturer',
        ),
        _Field('model', 'Model', 'Модель', 'Model'),
        _Field(
          'installation_year',
          'O‘rnatilgan yil',
          'Год установки',
          'Installation year',
          numeric: true,
        ),
        _Field(
          'connection_diameter_mm',
          'Ulanish diametri · mm',
          'Диаметр подключения · мм',
          'Connection diameter · mm',
          numeric: true,
        ),
        _Field(
          'nominal_pressure_kpa',
          'Nominal bosim · kPa',
          'Номинальное давление · кПа',
          'Nominal pressure · kPa',
          numeric: true,
        ),
        _Field(
          'measured_pressure_kpa',
          'O‘lchangan bosim · kPa',
          'Измеренное давление · кПа',
          'Measured pressure · kPa',
          numeric: true,
        ),
        _Field(
          'flow_lps',
          'Suv sarfi · L/s',
          'Расход · л/с',
          'Flow · L/s',
          numeric: true,
        ),
        _Field(
          'measurement_date',
          'O‘lchov vaqti · ISO 8601',
          'Время измерения · ISO 8601',
          'Measurement timestamp · ISO 8601',
          date: true,
        ),
        _Field(
          'measurement_method',
          'O‘lchov usuli',
          'Метод измерения',
          'Measurement method',
        ),
        _Field(
          'accessibility_status',
          'Kirish imkoniyati',
          'Доступность',
          'Accessibility',
        ),
        _Field(
          'visible_condition',
          'Tashqi holat',
          'Внешнее состояние',
          'Visible condition',
        ),
        _Field(
          'next_inspection_date',
          'Keyingi tekshiruv · YYYY-MM-DD',
          'Следующая проверка · YYYY-MM-DD',
          'Next inspection · YYYY-MM-DD',
          date: true,
        ),
        _Field(
          'defect_description',
          'Nuqson tavsifi',
          'Описание дефекта',
          'Defect description',
        ),
        _Field('notes', 'Izohlar', 'Примечания', 'Notes'),
      ];
    }
    if (slug.contains('electr')) {
      return const [
        _Field(
          'voltage_kv',
          'Kuchlanish · kV',
          'Напряжение · кВ',
          'Voltage · kV',
          numeric: true,
        ),
        _Field('cable_type', 'Kabel turi', 'Тип кабеля', 'Cable type'),
        _Field(
          'installation_method',
          'O‘rnatish usuli',
          'Способ установки',
          'Installation method',
        ),
        _Field('notes', 'Izohlar', 'Примечания', 'Notes'),
      ];
    }
    if (slug.contains('gas')) {
      return const [
        _Field(
          'diameter_mm',
          'Diametr · mm',
          'Диаметр · мм',
          'Diameter · mm',
          numeric: true,
        ),
        _Field('material', 'Material', 'Материал', 'Material'),
        _Field('classification', 'Tasnif', 'Классификация', 'Classification'),
        _Field('notes', 'Izohlar', 'Примечания', 'Notes'),
      ];
    }
    if (slug.contains('sewer') || slug.contains('drain')) {
      return const [
        _Field(
          'diameter_mm',
          'Diametr · mm',
          'Диаметр · мм',
          'Diameter · mm',
          numeric: true,
        ),
        _Field('material', 'Material', 'Материал', 'Material'),
        _Field(
          'length_m',
          'Uzunlik · m',
          'Длина · м',
          'Length · m',
          numeric: true,
        ),
        _Field(
          'depth_m',
          'Chuqurlik · m',
          'Глубина · м',
          'Depth · m',
          numeric: true,
        ),
        _Field(
          'blockage_status',
          'Tiqilish holati',
          'Состояние засоров',
          'Blockage status',
        ),
        _Field('notes', 'Izohlar', 'Примечания', 'Notes'),
      ];
    }
    if (slug.contains('pipeline') ||
        slug.contains('water') ||
        slug.contains('reservoir') ||
        slug.contains('pump')) {
      return const [
        _Field(
          'diameter_mm',
          'Diametr · mm',
          'Диаметр · мм',
          'Diameter · mm',
          numeric: true,
        ),
        _Field('material', 'Material', 'Материал', 'Material'),
        _Field(
          'length_m',
          'Uzunlik · m',
          'Длина · м',
          'Length · m',
          numeric: true,
        ),
        _Field(
          'depth_m',
          'Chuqurlik · m',
          'Глубина · м',
          'Depth · m',
          numeric: true,
        ),
        _Field(
          'pressure_kpa',
          'Bosim · kPa',
          'Давление · кПа',
          'Pressure · kPa',
          numeric: true,
        ),
        _Field(
          'capacity_m3',
          'Sig‘im · m³',
          'Объём · м³',
          'Capacity · m³',
          numeric: true,
        ),
        _Field(
          'pump_power_kw',
          'Nasos quvvati · kW',
          'Мощность насоса · кВт',
          'Pump power · kW',
          numeric: true,
        ),
        _Field('notes', 'Izohlar', 'Примечания', 'Notes'),
      ];
    }
    return const [
      _Field('material', 'Material', 'Материал', 'Material'),
      _Field('notes', 'Izohlar', 'Примечания', 'Notes'),
    ];
  }

  Map<String, dynamic> payload() {
    final coords = vertices.map((v) => [v.longitude, v.latitude]).toList();
    final passport = <String, dynamic>{'schema_version': 1};
    for (final f in fields()) {
      final value = technical[f.key]?.text.trim() ?? '';
      passport[f.key] = value.isEmpty
          ? null
          : f.numeric
          ? num.tryParse(value)
          : value;
    }
    final ring = coords.isEmpty ? <List<double>>[] : [...coords, coords.first];
    return {
      'name': name.text.trim(),
      'code': code.text.trim(),
      'description': description.text.trim(),
      'category_id': categoryId,
      'region_id': regionId,
      'geometry': {
        'type': geometryType,
        'coordinates': geometryType == 'Point'
            ? (coords.isEmpty ? null : coords.first)
            : geometryType == 'Polygon'
            ? [ring]
            : coords,
      },
      'operational_status': status,
      'sensitivity': 'restricted',
      'accuracy_m': accuracy,
      'passport': passport,
      'is_synthetic': const bool.fromEnvironment(
        'SYNTHETIC_MODE',
        defaultValue: true,
      ),
    };
  }

  void changed() {
    if (restoring) return;
    autosave?.cancel();
    autosave = Timer(const Duration(milliseconds: 650), () async {
      try {
        await ref.read(appProvider.notifier).store?.saveDraft(draftId, {
          ...payload(),
          '_attachments': attachments,
          if (saveOperation != null) '_sync_operation': saveOperation,
        });
        if (mounted) setState(() => saved = true);
      } catch (e) {
        if (mounted) setState(() => error = readableError(e));
      }
    });
  }

  String? validate() {
    if (categoryId == null ||
        regionId == null ||
        name.text.trim().isEmpty ||
        code.text.trim().isEmpty) {
      return 'Kategoriya, hudud, nom va kod majburiy.';
    }
    if (vertices.isEmpty ||
        geometryType == 'LineString' && vertices.length < 2 ||
        geometryType == 'Polygon' && vertices.length < 3) {
      return 'Geometriya uchun yetarli nuqtalar belgilanmagan.';
    }
    if (vertices.any(
      (v) =>
          !v.latitude.isFinite ||
          !v.longitude.isFinite ||
          v.latitude.abs() > 90 ||
          v.longitude.abs() > 180,
    )) {
      return 'Koordinatalar noto‘g‘ri.';
    }
    if ((technical['measured_pressure_kpa']?.text.isNotEmpty == true ||
            technical['flow_lps']?.text.isNotEmpty == true) &&
        DateTime.tryParse(technical['measurement_date']?.text ?? '') == null) {
      return 'Bosim yoki suv sarfi uchun o‘lchov vaqti majburiy.';
    }
    return null;
  }

  Future<void> save() async {
    if (!form.currentState!.validate()) return;
    final validation = validate();
    if (validation != null) {
      setState(() => error = validation);
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    final data = payload();
    final operation = saveOperation ??= {
      'operation_id': const Uuid().v4(),
      'entity_type': 'infrastructure',
      'action': widget.objectId == null ? 'create' : 'update',
      if (widget.objectId != null) 'object_id': widget.objectId,
      if (widget.objectId != null) 'expected_version': version,
      'data': data,
    };
    try {
      final api = ref.read(apiProvider);
      await ref.read(appProvider.notifier).store?.saveDraft(draftId, {
        ...data,
        '_attachments': attachments,
        '_sync_operation': operation,
      });
      final batch = await api.post('/sync/batch', {
        'policy_epoch': ref.read(appProvider).account!.policyEpoch,
        'operations': [operation],
      }) as Map;
      final outcome = (batch['results'] as List).single as Map;
      if (outcome['status'] != 'success') {
        throw StateError(outcome['error']?.toString() ?? 'Amal bajarilmadi');
      }
      final result = Map<String, dynamic>.from(outcome['data'] as Map);
      while (attachments.isNotEmpty) {
        final attachment = attachments.first;
        await api.post(
          '/attachments',
          FormData.fromMap({
            'object_id': result['id'],
            'file': MultipartFile.fromBytes(
              base64Decode(attachment['bytes'] as String),
              filename: attachment['name'] as String,
            ),
          }),
        );
        attachments.removeAt(0);
        await ref.read(appProvider.notifier).store?.saveDraft(draftId, {
          ...data,
          '_attachments': attachments,
          '_sync_operation': operation,
        });
      }
      await ref.read(appProvider.notifier).store?.deleteDraft(draftId);
      ref.invalidate(infrastructureProvider);
      if (mounted) context.go('/objects/${result['id']}');
    } on DioException catch (e) {
      if ((e.response == null || (e.response?.statusCode ?? 0) >= 500) &&
          ref.read(appProvider.notifier).store != null) {
        await ref.read(appProvider.notifier).store!.queue({
          ...operation,
          '_attachments': attachments,
        });
        await ref.read(appProvider.notifier).store!.deleteDraft(draftId);
        if (mounted) {
          showMessage(context, 'Qoralama shifrlangan navbatda saqlandi.');
          context.go('/sync');
        }
      } else {
        if (mounted) setState(() => error = readableError(e));
      }
    } catch (e) {
      if (mounted) setState(() => error = readableError(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> photo() async {
    try {
      final photo = await ImagePicker().pickImage(
        source: ImageSource.camera,
        maxWidth: 1800,
        imageQuality: 85,
      );
      if (photo != null) {
        final bytes = await photo.readAsBytes();
        if (bytes.length > 10 * 1024 * 1024) {
          throw StateError('Fayl 10 MB dan oshmasin.');
        }
        setState(
          () => attachments.add({
            'name': photo.name,
            'bytes': base64Encode(bytes),
            'image': true,
          }),
        );
        changed();
      }
    } catch (e) {
      if (mounted) showMessage(context, readableError(e));
    }
  }

  Future<void> file() async {
    try {
      final picked = await FilePicker.pickFile(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
      );
      if (picked != null) {
        final size = await picked.length();
        if (size == null || size > 10 * 1024 * 1024) {
          throw StateError('Fayl 10 MB dan oshmasin.');
        }
        final bytes = await picked.readAsBytes();
        if (bytes.length > 10 * 1024 * 1024) {
          throw StateError('Fayl 10 MB dan oshmasin.');
        }
        if (!mounted) return;
        setState(
          () => attachments.add({
            'name': picked.name,
            'bytes': base64Encode(bytes),
            'image': ['jpg', 'jpeg', 'png'].contains(picked.extension),
          }),
        );
        changed();
      }
    } catch (e) {
      if (mounted) showMessage(context, readableError(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(appProvider);
    final t = L10n(state.locale);
    if (state.account?.isEmployee != true) {
      return Center(child: Text(t('pendingVerification')));
    }
    if (restoring) return const Center(child: CircularProgressIndicator());
    final categories = ref.watch(categoriesProvider).asData?.value ?? [],
        regions = ref.watch(regionsProvider).asData?.value ?? [];
    final steps = [
      t('category'),
      t('geometry'),
      t('description'),
      t('technicalPassport'),
      t('attachments'),
      t('review'),
    ];
    return Form(
      key: form,
      onChanged: changed,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 4),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    '${t('add')} · ${step + 1}/${steps.length}',
                    style: Theme.of(context).textTheme.titleLarge
                        ?.copyWith(fontWeight: FontWeight.w800),
                  ),
                ),
                if (saved) const Icon(Icons.cloud_done_outlined),
              ],
            ),
          ),
          LinearProgressIndicator(value: (step + 1) / steps.length),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Text(
                  steps[step],
                  style: Theme.of(context).textTheme.headlineMedium
                      ?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 24),
                if (step == 0) ...[
                  DropdownButtonFormField<String>(
                    initialValue: categoryId,
                    isExpanded: true,
                    decoration: InputDecoration(labelText: t('category')),
                    items: categories
                        .map(
                          (e) => DropdownMenuItem(
                            value: e['id'].toString(),
                            child: Text((e['name_uz'] ?? e['name']).toString()),
                          ),
                        )
                        .toList(),
                    onChanged: (value) {
                      setState(() => categoryId = value);
                      changed();
                    },
                  ),
                  const SizedBox(height: 18),
                  DropdownButtonFormField<String>(
                    initialValue: regionId,
                    isExpanded: true,
                    decoration: InputDecoration(labelText: t('region')),
                    items: regions
                        .map(
                          (e) => DropdownMenuItem(
                            value: e['id'].toString(),
                            child: Text((e['name_uz'] ?? e['name']).toString()),
                          ),
                        )
                        .toList(),
                    onChanged: (value) {
                      setState(() => regionId = value);
                      changed();
                    },
                  ),
                ],
                if (step == 1) ...[
                  SegmentedButton<String>(
                    segments: [
                      ButtonSegment(value: 'Point', label: Text(t('point'))),
                      ButtonSegment(
                        value: 'LineString',
                        label: Text(t('line')),
                      ),
                      ButtonSegment(
                        value: 'Polygon',
                        label: Text(t('polygon')),
                      ),
                    ],
                    selected: {geometryType},
                    onSelectionChanged: (v) {
                      setState(() {
                        geometryType = v.first;
                        vertices.clear();
                      });
                      changed();
                    },
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    height: 300,
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: MapScreen(
                        pickLocation: (point) {
                          setState(() {
                            if (geometryType == 'Point') vertices.clear();
                            vertices.add(point);
                            latitude.text = point.latitude.toStringAsFixed(7);
                            longitude.text = point.longitude.toStringAsFixed(7);
                          });
                          changed();
                        },
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: () async {
                      try {
                        final p = await currentPosition();
                        setState(() {
                          if (geometryType == 'Point') vertices.clear();
                          vertices.add(LatLng(p.latitude, p.longitude));
                          latitude.text = p.latitude.toString();
                          longitude.text = p.longitude.toString();
                          accuracy = p.accuracy;
                        });
                        changed();
                      } catch (e) {
                        if (context.mounted) {
                          showMessage(context, readableError(e));
                        }
                      }
                    },
                    icon: const Icon(Icons.my_location),
                    label: Text(t('gps')),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: latitude,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                      signed: true,
                    ),
                    decoration: InputDecoration(labelText: t('latitude')),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: longitude,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                      signed: true,
                    ),
                    decoration: InputDecoration(labelText: t('longitude')),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: () {
                      final lat = double.tryParse(latitude.text),
                          lon = double.tryParse(longitude.text);
                      if (lat == null ||
                          lon == null ||
                          lat.abs() > 90 ||
                          lon.abs() > 180) {
                        showMessage(context, 'Koordinatalar noto‘g‘ri');
                        return;
                      }
                      setState(() {
                        if (geometryType == 'Point') vertices.clear();
                        vertices.add(LatLng(lat, lon));
                      });
                      changed();
                    },
                    icon: const Icon(Icons.add_location_alt_outlined),
                    label: Text(t('add')),
                  ),
                  if (accuracy != null)
                    DataRowView(
                      t('accuracy'),
                      '±${accuracy!.toStringAsFixed(1)} m',
                    ),
                  ...vertices.indexed.map(
                    (entry) => ListTile(
                      title: Text(
                        '${entry.$1 + 1}. ${entry.$2.latitude.toStringAsFixed(6)}, ${entry.$2.longitude.toStringAsFixed(6)}',
                      ),
                      trailing: IconButton(
                        onPressed: () {
                          setState(() => vertices.removeAt(entry.$1));
                          changed();
                        },
                        icon: const Icon(Icons.close),
                      ),
                    ),
                  ),
                ],
                if (step == 2) ...[
                  TextFormField(
                    controller: code,
                    decoration: InputDecoration(
                      labelText: '${t('codeLabel')} *',
                    ),
                  ),
                  const SizedBox(height: 18),
                  TextFormField(
                    controller: name,
                    decoration: InputDecoration(
                      labelText: '${t('objectName')} *',
                    ),
                  ),
                  const SizedBox(height: 18),
                  TextFormField(
                    controller: description,
                    minLines: 3,
                    maxLines: 5,
                    decoration: InputDecoration(labelText: t('description')),
                  ),
                  const SizedBox(height: 18),
                  DropdownButtonFormField<String>(
                    initialValue: status,
                    decoration: InputDecoration(labelText: t('status')),
                    items:
                        [
                              'working',
                              'faulty',
                              'under_maintenance',
                              'temporarily_unavailable',
                              'not_inspected',
                              'unknown',
                            ]
                            .map(
                              (s) =>
                                  DropdownMenuItem(value: s, child: Text(t(s))),
                            )
                            .toList(),
                    onChanged: (v) {
                      setState(() => status = v!);
                      changed();
                    },
                  ),
                ],
                if (step == 3)
                  ...fields().map(
                    (field) => Padding(
                      padding: const EdgeInsets.only(bottom: 18),
                      child: TextFormField(
                        controller: technical.putIfAbsent(
                          field.key,
                          () => TextEditingController(),
                        ),
                        keyboardType: field.numeric
                            ? const TextInputType.numberWithOptions(
                                decimal: true,
                              )
                            : TextInputType.text,
                        decoration: InputDecoration(
                          labelText: field.label(state.locale),
                          hintText: field.date
                              ? 'YYYY-MM-DD${field.key == 'measurement_date' ? 'THH:mm:ssZ' : ''}'
                              : null,
                        ),
                        validator: (v) {
                          if (v == null || v.isEmpty) return null;
                          if (field.numeric &&
                              (num.tryParse(v) == null || num.parse(v) < 0)) {
                            return 'Qiymat musbat son bo‘lishi kerak';
                          }
                          if (field.date && DateTime.tryParse(v) == null) {
                            return 'Sana formati noto‘g‘ri';
                          }
                          return null;
                        },
                      ),
                    ),
                  ),
                if (step == 4) ...[
                  OutlinedButton.icon(
                    onPressed: photo,
                    icon: const Icon(Icons.camera_alt_outlined),
                    label: Text(t('addPhoto')),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: file,
                    icon: const Icon(Icons.attach_file),
                    label: Text(t('addFile')),
                  ),
                  const SizedBox(height: 20),
                  ...attachments.indexed.map(
                    (entry) => Card(
                      child: ListTile(
                        leading: entry.$2['image'] == true
                            ? Image.memory(
                                Uint8List.fromList(
                                  base64Decode(entry.$2['bytes'] as String),
                                ),
                                width: 56,
                                height: 56,
                                fit: BoxFit.cover,
                              )
                            : const Icon(Icons.description_outlined),
                        title: Text(entry.$2['name'] as String),
                        trailing: IconButton(
                          onPressed: () {
                            setState(() => attachments.removeAt(entry.$1));
                            changed();
                          },
                          icon: const Icon(Icons.delete_outline),
                        ),
                      ),
                    ),
                  ),
                ],
                if (step == 5) ...[
                  DataRowView(t('codeLabel'), code.text),
                  DataRowView(t('objectName'), name.text),
                  StatusPill(status, t: t),
                  DataRowView(
                    t('geometry'),
                    '$geometryType · ${vertices.length}',
                  ),
                  ...fields()
                      .where((f) => technical[f.key]?.text.isNotEmpty == true)
                      .map(
                        (f) => DataRowView(
                          f.label(state.locale),
                          technical[f.key]!.text,
                        ),
                      ),
                  DataRowView(t('attachments'), attachments.length),
                  Text(t('draft')),
                ],
                if (error != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    child: Text(
                      error!,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  if (step > 0) ...[
                    OutlinedButton(
                      onPressed: busy ? null : () => setState(() => step--),
                      child: const Icon(Icons.arrow_back),
                    ),
                    const SizedBox(width: 12),
                  ],
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: busy
                          ? null
                          : step == 5
                          ? save
                          : () {
                              if (form.currentState!.validate()) {
                                setState(() => step++);
                              }
                            },
                      icon: busy
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Icon(
                              step == 5
                                  ? Icons.save_outlined
                                  : Icons.arrow_forward,
                            ),
                      label: Text(t(step == 5 ? 'saveDraft' : 'continue')),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Field {
  const _Field(
    this.key,
    this.uz,
    this.ru,
    this.en, {
    this.numeric = false,
    this.date = false,
  });
  final String key, uz, ru, en;
  final bool numeric, date;
  String label(String locale) => locale == 'ru'
      ? ru
      : locale == 'en'
      ? en
      : uz;
}
