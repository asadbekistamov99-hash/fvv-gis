import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api.dart';
import '../../core/l10n.dart';
import '../../core/state.dart';
import '../../core/widgets.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});
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
                  t('notifications'),
                  style: Theme.of(context).textTheme.headlineSmall
                      ?.copyWith(fontWeight: FontWeight.w900),
                ),
              ),
              IconButton(
                onPressed: () => ref.invalidate(notificationsProvider),
                tooltip: t('refresh'),
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
        ),
        Expanded(
          child: ref
              .watch(notificationsProvider)
              .when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => ErrorPanel(
                  e,
                  t: t,
                  retry: () => ref.invalidate(notificationsProvider),
                ),
                data: (items) {
                  if (items.isEmpty) {
                    return EmptyPanel(t: t, icon: Icons.notifications_none);
                  }
                  return ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: items.length,
                    itemBuilder: (context, index) {
                      final item = items[index];
                      return Card(
                        child: ListTile(
                          contentPadding: const EdgeInsets.all(16),
                          leading: Icon(
                            item['read_at'] == null
                                ? Icons.notifications_active_outlined
                                : Icons.notifications_none,
                          ),
                          title: Text(
                            item['title']?.toString() ?? t('notifications'),
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const SizedBox(height: 8),
                              Text(item['body']?.toString() ?? ''),
                              const SizedBox(height: 10),
                              Text(
                                item['created_at']?.toString() ?? '',
                                style: Theme.of(context).textTheme.labelMedium,
                              ),
                            ],
                          ),
                          onTap: () async {
                            try {
                              await ref
                                  .read(apiProvider)
                                  .post('/notifications/${item['id']}/read');
                              ref.invalidate(notificationsProvider);
                            } catch (e) {
                              if (context.mounted) {
                                showMessage(context, readableError(e));
                              }
                            }
                          },
                        ),
                      );
                    },
                  );
                },
              ),
        ),
      ],
    );
  }
}
