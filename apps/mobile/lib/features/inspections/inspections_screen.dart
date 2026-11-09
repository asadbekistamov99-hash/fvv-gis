import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api.dart';
import '../../core/l10n.dart';
import '../../core/state.dart';
import '../../core/widgets.dart';

class InspectionsScreen extends ConsumerStatefulWidget {
  const InspectionsScreen({super.key});
  @override
  ConsumerState<InspectionsScreen> createState() => _InspectionsScreenState();
}

class _InspectionsScreenState extends ConsumerState<InspectionsScreen> {
  String? objectId;
  Future<List<Map<String, dynamic>>>? history;
  void load() {
    if (objectId != null) {
      setState(
        () => history = ref
            .read(apiProvider)
            .list('/infrastructure/$objectId/inspections'),
      );
    }
  }

  Future<void> add() async {
    final t = L10n(ref.read(appProvider).locale);
    final notes = TextEditingController(), next = TextEditingController();
    String status = 'not_inspected', condition = 'unknown';
    bool saving = false;
    String? error;
    await showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialog) => AlertDialog(
          title: Text(t('check')),
          content: SizedBox(
            width: 480,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  DropdownButtonFormField<String>(
                    initialValue: status,
                    isExpanded: true,
                    decoration: InputDecoration(labelText: t('status')),
                    items:
                        [
                              'working',
                              'faulty',
                              'under_maintenance',
                              'not_inspected',
                              'unknown',
                            ]
                            .map(
                              (s) =>
                                  DropdownMenuItem(value: s, child: Text(t(s))),
                            )
                            .toList(),
                    onChanged: (s) => setDialog(() => status = s!),
                  ),
                  const SizedBox(height: 18),
                  DropdownButtonFormField<String>(
                    initialValue: condition,
                    isExpanded: true,
                    decoration: InputDecoration(labelText: t('review')),
                    items: ['good', 'fair', 'poor', 'unknown']
                        .map(
                          (s) => DropdownMenuItem(
                            value: s,
                            child: Text(
                              s == 'good'
                                  ? '✓ ${t('working')}'
                                  : s == 'poor'
                                  ? '! ${t('faulty')}'
                                  : t(s),
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: (s) => setDialog(() => condition = s!),
                  ),
                  const SizedBox(height: 18),
                  TextField(
                    controller: notes,
                    minLines: 3,
                    maxLines: 6,
                    decoration: InputDecoration(labelText: t('description')),
                  ),
                  const SizedBox(height: 18),
                  TextField(
                    controller: next,
                    decoration: const InputDecoration(labelText: 'YYYY-MM-DD'),
                  ),
                  if (error != null) Text(error!),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: saving ? null : () => Navigator.pop(context),
              child: Text(t('cancel')),
            ),
            FilledButton(
              onPressed: saving
                  ? null
                  : () async {
                      if (notes.text.trim().isEmpty) {
                        setDialog(() => error = t('required'));
                        return;
                      }
                      if (next.text.isNotEmpty &&
                          DateTime.tryParse(next.text) == null) {
                        setDialog(() => error = 'YYYY-MM-DD');
                        return;
                      }
                      setDialog(() => saving = true);
                      try {
                        await ref.read(apiProvider).post('/inspections', {
                          'object_id': objectId,
                          'condition': condition,
                          'notes': notes.text.trim(),
                          'operational_status': status,
                          if (next.text.isNotEmpty)
                            'next_inspection_date': next.text,
                        });
                        if (context.mounted) Navigator.pop(context);
                        ref.invalidate(infrastructureProvider);
                        load();
                      } catch (e) {
                        setDialog(() {
                          saving = false;
                          error = readableError(e);
                        });
                      }
                    },
              child: Text(t('save')),
            ),
          ],
        ),
      ),
    );
    notes.dispose();
    next.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(appProvider);
    final t = L10n(state.locale);
    if (state.account?.isEmployee != true) {
      return Center(child: Text(t('pendingVerification')));
    }
    final objects = ref.watch(infrastructureProvider);
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          t('inspections'),
          style: Theme.of(context).textTheme.headlineMedium
              ?.copyWith(fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 24),
        objects.when(
          loading: () => const LinearProgressIndicator(),
          error: (e, _) => ErrorPanel(
            e,
            t: t,
            retry: () => ref.invalidate(infrastructureProvider),
          ),
          data: (values) => DropdownButtonFormField<String>(
            initialValue: objectId,
            isExpanded: true,
            decoration: InputDecoration(labelText: t('objectName')),
            items: values
                .map(
                  (e) => DropdownMenuItem(
                    value: e['id'].toString(),
                    child: Text('${e['code']} · ${e['name']}'),
                  ),
                )
                .toList(),
            onChanged: (value) {
              objectId = value;
              load();
            },
          ),
        ),
        const SizedBox(height: 18),
        FilledButton.icon(
          onPressed: objectId == null ? null : add,
          icon: const Icon(Icons.fact_check_outlined),
          label: Text(t('check')),
        ),
        const SizedBox(height: 20),
        if (history != null)
          FutureBuilder<List<Map<String, dynamic>>>(
            future: history,
            builder: (context, snapshot) {
              if (snapshot.hasError) {
                return ErrorPanel(snapshot.error!, t: t, retry: load);
              }
              if (!snapshot.hasData) return const LinearProgressIndicator();
              if (snapshot.data!.isEmpty) return EmptyPanel(t: t);
              return Column(
                children: snapshot.data!
                    .map(
                      (e) => SectionCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            StatusPill(
                              e['operational_status']?.toString() ?? 'unknown',
                              t: t,
                            ),
                            DataRowView(t('description'), e['notes']),
                            DataRowView(t('updated'), e['created_at']),
                            DataRowView(t('review'), e['condition']),
                          ],
                        ),
                      ),
                    )
                    .toList(),
              );
            },
          ),
      ],
    );
  }
}
