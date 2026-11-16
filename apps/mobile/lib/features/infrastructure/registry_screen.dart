import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/l10n.dart';
import '../../core/state.dart';
import '../../core/widgets.dart';

class RegistryScreen extends ConsumerStatefulWidget {
  const RegistryScreen({super.key});
  @override
  ConsumerState<RegistryScreen> createState() => _RegistryScreenState();
}

class _RegistryScreenState extends ConsumerState<RegistryScreen> {
  String search = '', status = '';
  @override
  Widget build(BuildContext context) {
    final t = L10n(ref.watch(appProvider).locale);
    if (ref.watch(appProvider).account?.isEmployee != true) {
      return Center(
        child: FilledButton(
          onPressed: () => context.go('/auth'),
          child: Text(t('login')),
        ),
      );
    }
    final records = ref.watch(infrastructureProvider);
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      t('registry'),
                      style: Theme.of(context).textTheme.headlineMedium
                          ?.copyWith(fontWeight: FontWeight.w900),
                    ),
                  ),
                  IconButton(
                    onPressed: () => ref.invalidate(infrastructureProvider),
                    tooltip: t('refresh'),
                    icon: const Icon(Icons.refresh),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              TextField(
                onChanged: (v) => setState(() => search = v.toLowerCase()),
                decoration: InputDecoration(
                  hintText: t('search'),
                  prefixIcon: const Icon(Icons.search),
                ),
              ),
              const SizedBox(height: 10),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: ['', 'working', 'faulty', 'unknown']
                      .map(
                        (s) => Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: ChoiceChip(
                            label: Text(t(s.isEmpty ? 'all' : s)),
                            selected: status == s,
                            onSelected: (_) => setState(() => status = s),
                          ),
                        ),
                      )
                      .toList(),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: records.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => ErrorPanel(
              e,
              t: t,
              retry: () => ref.invalidate(infrastructureProvider),
            ),
            data: (all) {
              final values = all
                  .where(
                    (e) =>
                        (status.isEmpty || e['operational_status'] == status) &&
                        '${e['name']} ${e['code']}'.toLowerCase().contains(
                          search,
                        ),
                  )
                  .toList();
              if (values.isEmpty) return EmptyPanel(t: t);
              return RefreshIndicator(
                onRefresh: () async {
                  ref.invalidate(infrastructureProvider);
                  await ref.read(infrastructureProvider.future);
                },
                child: ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                  itemCount: values.length,
                  itemBuilder: (context, index) {
                    final item = values[index];
                    return Card(
                      child: InkWell(
                        borderRadius: BorderRadius.circular(16),
                        onTap: () => context.push('/objects/${item['id']}'),
                        child: Padding(
                          padding: const EdgeInsets.all(18),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: Theme.of(context)
                                          .colorScheme
                                          .primaryContainer,
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Icon(
                                      Icons.water_drop_outlined,
                                      color: Theme.of(context)
                                          .colorScheme
                                          .onPrimaryContainer,
                                    ),
                                  ),
                                  const SizedBox(width: 14),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          item['code']?.toString() ?? '',
                                          style: TextStyle(
                                            color: Theme.of(context)
                                                .colorScheme
                                                .primary,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                        Text(
                                          item['name']?.toString() ?? '—',
                                          style: const TextStyle(
                                            fontSize: 19,
                                            fontWeight: FontWeight.w800,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const Icon(Icons.chevron_right),
                                ],
                              ),
                              const SizedBox(height: 16),
                              Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: [
                                  StatusPill(
                                    item['operational_status']?.toString() ??
                                        'unknown',
                                    t: t,
                                  ),
                                  StatusPill(
                                    item['lifecycle']?.toString() ?? 'draft',
                                    t: t,
                                  ),
                                ],
                              ),
                              if (item['is_synthetic'] == true)
                                Padding(
                                  padding: const EdgeInsets.only(top: 10),
                                  child: Text(
                                    t('synthetic'),
                                    style: Theme.of(context)
                                        .textTheme
                                        .labelSmall,
                                  ),
                                ),
                            ],
                          ),
                        ),
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
