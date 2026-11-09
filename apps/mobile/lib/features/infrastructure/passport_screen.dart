import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api.dart';
import '../../core/l10n.dart';
import '../../core/state.dart';
import '../../core/widgets.dart';
import '../gis/map_screen.dart';

class PassportScreen extends ConsumerStatefulWidget {
  const PassportScreen({required this.id, super.key});
  final String id;
  @override
  ConsumerState<PassportScreen> createState() => _PassportScreenState();
}

class _PassportScreenState extends ConsumerState<PassportScreen> {
  late Future<Map<String, dynamic>> future;
  @override
  void initState() {
    super.initState();
    future = load();
  }

  @override
  void didUpdateWidget(covariant PassportScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.id != widget.id) {
      future = load();
    }
  }

  Future<Map<String, dynamic>> load() async {
    final account = ref.read(appProvider).account;
    final api = ref.read(apiProvider);
    final revision = api.sessionRevision;
    final id = widget.id;
    bool current() =>
        mounted &&
        widget.id == id &&
        revision == api.sessionRevision &&
        ref.read(appProvider).account?.id == account?.id &&
        ref.read(appProvider).account?.policyEpoch == account?.policyEpoch &&
        ref.read(appProvider).offlineGrantValid;
    if (account?.isEmployee != true || !current()) {
      throw StateError('Texnik pasport uchun ruxsatni yangilang.');
    }
    try {
      final record = Map<String, dynamic>.from(
        await api.get('/infrastructure/$id') as Map,
      );
      if (!current()) {
        throw StateError('Hisob yoki ruxsatlar o‘zgardi.');
      }
      return record;
    } catch (error) {
      if (error is! DioException || error.response != null || !current()) {
        rethrow;
      }
      final rows = await ref
          .read(appProvider.notifier)
          .store
          ?.readCache('infrastructure');
      if (!current()) {
        rethrow;
      }
      for (final row in rows ?? <Map<String, dynamic>>[]) {
        if (row['id'] == id) {
          return row;
        }
      }
      rethrow;
    }
  }

  void reload() {
    setState(() => future = load());
  }

  Future<void> submit(Map<String, dynamic> item, L10n t) async {
    if (!await confirm(context, t('submit'), t)) return;
    try {
      await ref.read(apiProvider).post('/infrastructure/${widget.id}/submit', {
        'expected_version': item['version'],
      });
      ref.invalidate(infrastructureProvider);
      reload();
    } catch (e) {
      if (mounted) showMessage(context, readableError(e));
    }
  }

  Future<void> requestRoute() async {
    try {
      final position = await currentPosition();
      if (!mounted) {
        return;
      }
      final result = await ref.read(apiProvider).post('/routes', {
        'destination_object_id': widget.id,
        'origin': {
          'type': 'Point',
          'coordinates': [position.longitude, position.latitude],
        },
      }) as Map;
      if (mounted) {
        showMessage(
          context,
          '${L10n(ref.read(appProvider).locale)('route')}: ${result['status'] ?? result['approval_status'] ?? 'under_review'}',
        );
        context.go('/routes');
      }
    } catch (e) {
      if (mounted) showMessage(context, readableError(e));
    }
  }

  Future<void> preview(Map<String, dynamic> attachment) async {
    try {
      final id = attachment['id'];
      final response = await ref
          .read(apiProvider)
          .dio
          .get<List<int>>(
            '/attachments/$id/download',
            options: Options(responseType: ResponseType.bytes),
          );
      if (!mounted) return;
      if ((attachment['content_type'] ?? attachment['mime_type'] ?? '')
          .toString()
          .startsWith('image/')) {
        await showDialog<void>(
          context: context,
          builder: (context) => Dialog(
            child: InteractiveViewer(
              child: Image.memory(Uint8List.fromList(response.data!)),
            ),
          ),
        );
      } else {
        showMessage(
          context,
          '${attachment['filename'] ?? attachment['name']} · ${response.data!.length} bytes',
        );
      }
    } catch (e) {
      if (mounted) showMessage(context, readableError(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = L10n(ref.watch(appProvider).locale);
    return FutureBuilder<Map<String, dynamic>>(
      future: future,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return ErrorPanel(snapshot.error!, t: t, retry: reload);
        }
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final item = snapshot.data!;
        final passport = Map<String, dynamic>.from(
          item['passport'] as Map? ?? {},
        );
        final measurement = DateTime.tryParse(
          passport['measurement_date']?.toString() ?? '',
        );
        final stale =
            measurement == null ||
            DateTime.now().toUtc().difference(measurement) >
                const Duration(days: 30);
        final labels = <String, String>{
          'hydrant_type': 'Gidrant turi',
          'installation_type': 'O‘rnatish turi',
          'installation_year': 'O‘rnatilgan yil',
          'manufacturer': 'Ishlab chiqaruvchi',
          'model': 'Model',
          'material': 'Material',
          'connection_diameter_mm': 'Ulanish diametri · mm',
          'nominal_pressure_kpa': 'Nominal bosim · kPa',
          'accessibility_status': 'Kirish imkoniyati',
          'visible_condition': 'Tashqi holat',
          'last_inspection_date': 'Oxirgi tekshiruv',
          'next_inspection_date': 'Keyingi tekshiruv',
          'last_maintenance_date': 'Oxirgi ta’mirlash',
          'defect_description': 'Nuqson',
          'repair_status': 'Ta’mirlash holati',
          'notes': 'Izohlar',
          'diameter_mm': 'Diametr · mm',
          'length_m': 'Uzunlik · m',
          'depth_m': 'Chuqurlik · m',
          'pressure_kpa': 'Bosim · kPa',
          'voltage_kv': 'Kuchlanish · kV',
        };
        return ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Row(
              children: [
                IconButton(
                  onPressed: () => context.go('/registry'),
                  tooltip: t('registry'),
                  icon: const Icon(Icons.arrow_back),
                ),
                Expanded(
                  child: Text(
                    t('technicalPassport'),
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              item['code']?.toString() ?? '',
              style: TextStyle(
                color: Theme.of(context).colorScheme.primary,
                fontWeight: FontWeight.w800,
              ),
            ),
            Text(
              item['name']?.toString() ?? '—',
              style: Theme.of(context).textTheme.headlineMedium
                  ?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                StatusPill(
                  item['operational_status']?.toString() ?? 'unknown',
                  t: t,
                ),
                StatusPill(item['lifecycle']?.toString() ?? 'draft', t: t),
                if (item['is_synthetic'] == true)
                  Chip(label: Text(t('synthetic'))),
              ],
            ),
            SectionCard(
              title: t('measurement'),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: _Metric(
                          t('pressure'),
                          passport['measured_pressure_kpa'],
                          'kPa',
                        ),
                      ),
                      Expanded(
                        child: _Metric(t('flow'), passport['flow_lps'], 'L/s'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  DataRowView(
                    t('measurement'),
                    measurement?.toLocal().toString(),
                  ),
                  if (stale)
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.errorContainer,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '${t('offline')} · ${t('measurement')}',
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.onErrorContainer,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  DataRowView(t('description'), item['description']),
                  DataRowView(
                    t('accuracy'),
                    item['accuracy_m'] == null
                        ? null
                        : '±${item['accuracy_m']} m',
                  ),
                  DataRowView(t('updated'), item['updated_at']),
                  DataRowView('Versiya', item['version']),
                  ...passport.entries
                      .where(
                        (e) => ![
                          'measured_pressure_kpa',
                          'flow_lps',
                          'measurement_date',
                          'schema_version',
                        ].contains(e.key),
                      )
                      .map((e) => DataRowView(labels[e.key] ?? e.key, e.value)),
                ],
              ),
            ),
            SectionCard(
              title: t('attachments'),
              child: Column(
                children: [
                  if ((item['attachments'] as List? ?? []).isEmpty)
                    Text(t('empty')),
                  ...(item['attachments'] as List? ?? []).map((raw) {
                    final a = Map<String, dynamic>.from(raw as Map);
                    return ListTile(
                      leading: const Icon(Icons.attach_file),
                      title: Text(a['filename']?.toString() ?? '—'),
                      subtitle: Text(a['scan_status']?.toString() ?? ''),
                      onTap: () => preview(a),
                    );
                  }),
                ],
              ),
            ),
            FilledButton.icon(
              onPressed: () => context.push('/objects/${widget.id}/edit'),
              icon: const Icon(Icons.edit_outlined),
              label: Text(t('edit')),
            ),
            const SizedBox(height: 12),
            if ([
              'draft',
              'requires_correction',
              'rejected',
            ].contains(item['lifecycle']))
              OutlinedButton.icon(
                onPressed: () => submit(item, t),
                icon: const Icon(Icons.send_outlined),
                label: Text(t('submit')),
              ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: requestRoute,
              icon: const Icon(Icons.route_outlined),
              label: Text(t('requestRoute')),
            ),
            const SizedBox(height: 24),
          ],
        );
      },
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric(this.label, this.value, this.unit);
  final String label, unit;
  final dynamic value;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: Theme.of(context).textTheme.labelLarge),
      const SizedBox(height: 8),
      Text(
        value?.toString() ?? '—',
        style: Theme.of(context).textTheme.headlineLarge
            ?.copyWith(fontWeight: FontWeight.w900),
      ),
      Text(unit),
    ],
  );
}
