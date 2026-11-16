import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:uuid/uuid.dart';

import '../../core/api.dart';
import '../../core/l10n.dart';
import '../../core/state.dart';
import '../../core/widgets.dart';
import '../gis/map_screen.dart';

class ReportScreen extends ConsumerStatefulWidget {
  const ReportScreen({super.key});
  @override
  ConsumerState<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends ConsumerState<ReportScreen> {
  final form = GlobalKey<FormState>();
  final description = TextEditingController();
  final List<(String, Uint8List)> photos = [];
  String category = 'infrastructure_fault';
  bool busy = false;
  String? error, reportId, regionId;
  Map<String, dynamic>? geometry;
  final requestId = const Uuid().v4();
  Map<String, dynamic>? submittedPayload;
  @override
  void dispose() {
    description.dispose();
    super.dispose();
  }

  Future<void> send() async {
    if (!form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final api = ref.read(apiProvider);
      submittedPayload ??= {
        'category': category,
        'description': description.text.trim(),
        if (geometry != null) 'geometry': geometry,
        if (regionId != null) 'region_id': regionId,
        'contact_phone': ref.read(appProvider).account?.phone,
        'is_synthetic': const bool.fromEnvironment(
          'SYNTHETIC_MODE',
          defaultValue: true,
        ),
      };
      if (reportId == null) {
        final report = (await api.dio.post<Map<String, dynamic>>(
          '/reports',
          data: submittedPayload,
          options: Options(headers: {'Idempotency-Key': requestId}),
        )).data!;
        reportId = report['id'] as String;
      }
      while (photos.isNotEmpty) {
        final photo = photos.first;
        await api.post(
          '/attachments',
          FormData.fromMap({
            'report_id': reportId,
            'file': MultipartFile.fromBytes(photo.$2, filename: photo.$1),
          }),
        );
        photos.removeAt(0);
      }
      ref.invalidate(reportsProvider);
      if (mounted) {
        showMessage(
          context,
          '${L10n(ref.read(appProvider).locale)('open')} · $reportId',
        );
        context.go('/reports');
      }
    } catch (e) {
      if (mounted) setState(() => error = readableError(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(appProvider);
    final t = L10n(state.locale);
    final regions = ref.watch(regionsProvider).asData?.value ?? [];
    if (state.account == null) {
      return Center(
        child: FilledButton(
          onPressed: () => context.go('/auth'),
          child: Text(t('login')),
        ),
      );
    }
    final categories = <String, Map<String, String>>{
      'infrastructure_fault': {
        'uz': 'Infratuzilma nosozligi',
        'ru': 'Неисправность инфраструктуры',
        'en': 'Infrastructure fault',
      },
      'fire': {
        'uz': 'Yong‘in haqidagi ma’lumot',
        'ru': 'Информация о пожаре',
        'en': 'Fire information',
      },
      'flood': {'uz': 'Suv toshqini', 'ru': 'Подтопление', 'en': 'Flooding'},
      'gas_leak': {'uz': 'Gaz sizishi', 'ru': 'Утечка газа', 'en': 'Gas leak'},
      'other': {'uz': 'Boshqa', 'ru': 'Другое', 'en': 'Other'},
    };
    return Form(
      key: form,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            t('newReport'),
            style: Theme.of(context).textTheme.headlineMedium
                ?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 12),
          Text(
            t('nonEmergency'),
            style: TextStyle(
              color: Theme.of(context).colorScheme.primary,
              fontWeight: FontWeight.w700,
            ),
          ),
          SectionCard(
            child: Text(
              t('emergencyNotice'),
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
          if (const bool.fromEnvironment('SYNTHETIC_MODE', defaultValue: true))
            Chip(label: Text(t('synthetic'))),
          const SizedBox(height: 18),
          DropdownButtonFormField<String>(
            initialValue: category,
            isExpanded: true,
            decoration: InputDecoration(labelText: t('category')),
            items: categories.entries
                .map(
                  (e) => DropdownMenuItem(
                    value: e.key,
                    child: Text(e.value[state.locale]!),
                  ),
                )
                .toList(),
            onChanged: (v) => setState(() => category = v!),
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
                    child: Text(
                      (e['name_${state.locale}'] ?? e['name_uz']).toString(),
                    ),
                  ),
                )
                .toList(),
            onChanged: (v) => setState(() => regionId = v),
            validator: (v) => v == null ? t('required') : null,
          ),
          const SizedBox(height: 18),
          TextFormField(
            controller: description,
            minLines: 5,
            maxLines: 10,
            maxLength: 4000,
            decoration: InputDecoration(labelText: '${t('description')} *'),
            validator: (v) =>
                (v?.trim().length ?? 0) < 10 ? t('required') : null,
          ),
          const SizedBox(height: 18),
          OutlinedButton.icon(
            onPressed: () async {
              try {
                final position = await currentPosition();
                setState(
                  () => geometry = {
                    'type': 'Point',
                    'coordinates': [position.longitude, position.latitude],
                  },
                );
              } catch (e) {
                if (context.mounted) showMessage(context, readableError(e));
              }
            },
            icon: const Icon(Icons.my_location),
            label: Text(t('includeLocation')),
          ),
          if (geometry != null)
            ListTile(
              leading: const Icon(Icons.location_on_outlined),
              title: Text(
                (geometry!['coordinates'] as List).reversed.join(', '),
              ),
              trailing: IconButton(
                onPressed: () => setState(() => geometry = null),
                icon: const Icon(Icons.close),
              ),
            ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () async {
              try {
                final photo = await ImagePicker().pickImage(
                  source: ImageSource.camera,
                  maxWidth: 1800,
                  imageQuality: 80,
                );
                if (photo != null) {
                  final bytes = await photo.readAsBytes();
                  if (bytes.length > 10 * 1024 * 1024) {
                    throw StateError('10 MB');
                  }
                  setState(() => photos.add((photo.name, bytes)));
                }
              } catch (e) {
                if (context.mounted) showMessage(context, readableError(e));
              }
            },
            icon: const Icon(Icons.camera_alt_outlined),
            label: Text(t('addPhoto')),
          ),
          if (photos.isNotEmpty)
            SizedBox(
              height: 140,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: photos.indexed
                    .map(
                      (e) => Padding(
                        padding: const EdgeInsets.all(8),
                        child: Stack(
                          children: [
                            Image.memory(
                              e.$2.$2,
                              width: 120,
                              height: 120,
                              fit: BoxFit.cover,
                            ),
                            Positioned(
                              right: 0,
                              top: 0,
                              child: IconButton.filled(
                                onPressed: () =>
                                    setState(() => photos.removeAt(e.$1)),
                                icon: const Icon(Icons.close),
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                    .toList(),
              ),
            ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 18),
              child: Text(
                error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
          const SizedBox(height: 24),
          FilledButton.icon(
            onPressed: busy ? null : send,
            icon: busy
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.send_outlined),
            label: Text(t('send')),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

class MyReportsScreen extends ConsumerWidget {
  const MyReportsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = L10n(ref.watch(appProvider).locale);
    if (ref.watch(appProvider).account == null) {
      return Center(
        child: FilledButton(
          onPressed: () => context.go('/auth'),
          child: Text(t('login')),
        ),
      );
    }
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(20),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  t('reports'),
                  style: Theme.of(context).textTheme.headlineMedium
                      ?.copyWith(fontWeight: FontWeight.w900),
                ),
              ),
              IconButton(
                onPressed: () => ref.invalidate(reportsProvider),
                tooltip: t('refresh'),
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
        ),
        Expanded(
          child: ref
              .watch(reportsProvider)
              .when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => ErrorPanel(
                  e,
                  t: t,
                  retry: () => ref.invalidate(reportsProvider),
                ),
                data: (reports) {
                  if (reports.isEmpty) {
                    return EmptyPanel(t: t, icon: Icons.assignment_outlined);
                  }
                  return RefreshIndicator(
                    onRefresh: () async {
                      ref.invalidate(reportsProvider);
                      await ref.read(reportsProvider.future);
                    },
                    child: ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: reports.length,
                      itemBuilder: (context, index) {
                        final report = reports[index];
                        return SectionCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Icon(Icons.assignment_outlined),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      report['category']?.toString() ?? '',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Text(report['description']?.toString() ?? ''),
                              const SizedBox(height: 16),
                              StatusPill(
                                report['status']?.toString() ?? 'open',
                                t: t,
                              ),
                              DataRowView(
                                t('updated'),
                                report['updated_at'] ?? report['created_at'],
                              ),
                              if (report['is_synthetic'] == true)
                                Text(t('synthetic')),
                              if (report['resolution'] != null)
                                DataRowView(
                                  t('description'),
                                  report['resolution'],
                                ),
                            ],
                          ),
                        );
                      },
                    ),
                  );
                },
              ),
        ),
      ],
    );
  }
}
