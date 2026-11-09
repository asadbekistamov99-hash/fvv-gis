import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api.dart';
import '../../core/l10n.dart';
import '../../core/state.dart';
import '../../core/widgets.dart';

class SyncScreen extends ConsumerStatefulWidget {
  const SyncScreen({super.key});
  @override
  ConsumerState<SyncScreen> createState() => _SyncScreenState();
}

class _SyncScreenState extends ConsumerState<SyncScreen> {
  late Future<List<Map<String, dynamic>>> future;
  @override
  void initState() {
    super.initState();
    reload();
  }

  void reload() {
    future =
        ref.read(appProvider.notifier).store?.pending(includeConflicts: true) ??
        Future.value([]);
  }

  Future<void> resolve(Map<String, dynamic> operation) async {
    final t = L10n(ref.read(appProvider).locale);
    final store = ref.read(appProvider.notifier).store;
    if (store == null) return;
    Map<String, dynamic>? current;
    try {
      if (operation['object_id'] != null) {
        current = Map<String, dynamic>.from(
          await ref
                  .read(apiProvider)
                  .get('/infrastructure/${operation['object_id']}')
              as Map,
        );
      }
    } catch (e) {
      if (mounted) showMessage(context, readableError(e));
      return;
    }
    if (!mounted) return;
    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(t('review')),
        content: SizedBox(
          width: 600,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  operation['_error']?.toString() ?? '',
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
                const SizedBox(height: 16),
                Text('LOCAL', style: Theme.of(context).textTheme.titleMedium),
                SelectableText(
                  const JsonEncoder.withIndent('  ').convert(operation['data']),
                ),
                const Divider(),
                if (current != null) ...[
                  Text(
                    'SERVER · v${current['version']}',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  SelectableText(
                    const JsonEncoder.withIndent('  ').convert(current),
                  ),
                ],
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(t('cancel')),
          ),
          OutlinedButton(
            onPressed: () => Navigator.pop(context, 'server'),
            child: Text('${t('verify')} · SERVER'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, 'local'),
            child: Text('${t('retry')} · LOCAL'),
          ),
        ],
      ),
    );
    if (result == 'server') {
      await store.settle(operation['operation_id'] as String);
    }
    if (result == 'local') {
      if (current != null) {
        final previousId = operation['operation_id'] as String;
        final retry = Map<String, dynamic>.from(operation)
          ..remove('_status')
          ..remove('_error')
          ..remove('operation_id');
        await store.queue({...retry, 'expected_version': current['version']});
        await store.settle(previousId);
      } else {
        await store.retry(operation['operation_id'] as String);
      }
    }
    if (mounted) setState(reload);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(appProvider);
    final t = L10n(state.locale);
    final store = ref.read(appProvider.notifier).store;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          t('queue'),
          style: Theme.of(context).textTheme.headlineMedium
              ?.copyWith(fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 16),
        SectionCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              DataRowView(t('lastSync'), store?.lastSync?.toLocal()),
              DataRowView(
                t('permission'),
                store?.leaseValid == true
                    ? '${store!.lease.remaining.inMinutes} min'
                    : '—',
              ),
              Text(t('offline')),
            ],
          ),
        ),
        FilledButton.icon(
          onPressed: state.syncing
              ? null
              : () async {
                  await ref.read(appProvider.notifier).synchronize();
                  ref.invalidate(infrastructureProvider);
                  if (mounted) setState(reload);
                },
          icon: state.syncing
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.sync),
          label: Text(t('sync')),
        ),
        if (state.message != null)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Text(state.message!),
          ),
        const SizedBox(height: 18),
        FutureBuilder<List<Map<String, dynamic>>>(
          future: future,
          builder: (context, snapshot) {
            if (snapshot.hasError) {
              return ErrorPanel(
                snapshot.error!,
                t: t,
                retry: () => setState(reload),
              );
            }
            if (!snapshot.hasData) return const LinearProgressIndicator();
            if (snapshot.data!.isEmpty) return EmptyPanel(t: t);
            return Column(
              children: snapshot.data!
                  .map(
                    (item) => SectionCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            (item['data'] as Map?)?['name']?.toString() ??
                                item['entity_type']?.toString() ??
                                '',
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          DataRowView(t('status'), item['_status']),
                          if (item['_error'] != null)
                            Text(item['_error'].toString()),
                          if (item['_status'] == 'conflict')
                            OutlinedButton.icon(
                              onPressed: () => resolve(item),
                              icon: const Icon(Icons.compare_arrows),
                              label: Text(t('review')),
                            ),
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
