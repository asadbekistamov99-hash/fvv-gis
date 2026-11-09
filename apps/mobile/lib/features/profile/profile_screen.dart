import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api.dart';
import '../../core/l10n.dart';
import '../../core/state.dart';
import '../../core/widgets.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(appProvider),
        t = L10n(ref.watch(appProvider).locale);
    final account = state.account;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          t('profile'),
          style: Theme.of(context).textTheme.headlineMedium
              ?.copyWith(fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 20),
        SectionCard(
          child: Row(
            children: [
              CircleAvatar(
                radius: 32,
                backgroundColor: Theme.of(context).colorScheme.primaryContainer,
                child: Icon(
                  Icons.person_outline,
                  size: 36,
                  color: Theme.of(context).colorScheme.onPrimaryContainer,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      account?.fullName ?? t('citizen'),
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(account?.phone ?? 'FVV GIS'),
                    if (account != null)
                      Text(
                        account.role,
                        style: Theme.of(context).textTheme.labelLarge,
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
        if (account != null)
          OutlinedButton.icon(
            onPressed: () async {
              final name = TextEditingController(text: account.fullName);
              final value = await showDialog<String>(
                context: context,
                builder: (context) => AlertDialog(
                  title: Text(t('name')),
                  content: TextField(controller: name),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: Text(t('cancel')),
                    ),
                    FilledButton(
                      onPressed: () => Navigator.pop(context, name.text.trim()),
                      child: Text(t('save')),
                    ),
                  ],
                ),
              );
              name.dispose();
              if (value != null && value.length >= 2) {
                try {
                  await ref.read(apiProvider).patch('/users/me', {
                    'full_name': value,
                  });
                  await ref.read(appProvider.notifier).refreshAccount();
                } catch (e) {
                  if (context.mounted) showMessage(context, readableError(e));
                }
              }
            },
            icon: const Icon(Icons.edit_outlined),
            label: Text(t('edit')),
          ),
        SectionCard(
          child: Column(
            children: [
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(t('darkMode')),
                secondary: const Icon(Icons.dark_mode_outlined),
                value: state.dark,
                onChanged: (value) =>
                    ref.read(appProvider.notifier).preferences(dark: value),
              ),
              const Divider(),
              DropdownButtonFormField<String>(
                initialValue: state.locale,
                decoration: InputDecoration(labelText: t('language')),
                items: const [
                  DropdownMenuItem(value: 'uz', child: Text('O‘zbekcha')),
                  DropdownMenuItem(value: 'ru', child: Text('Русский')),
                  DropdownMenuItem(value: 'en', child: Text('English')),
                ],
                onChanged: (value) =>
                    ref.read(appProvider.notifier).preferences(locale: value),
              ),
            ],
          ),
        ),
        if (account?.isEmployee == true) ...[
          OutlinedButton.icon(
            onPressed: () => context.go('/routes'),
            icon: const Icon(Icons.route_outlined),
            label: Text(t('route')),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () => context.go('/sync'),
            icon: const Icon(Icons.sync),
            label: Text(t('queue')),
          ),
          const SizedBox(height: 12),
        ],
        if (state.message != null) SectionCard(child: Text(state.message!)),
        if (account == null)
          FilledButton(
            onPressed: () => context.go('/auth'),
            child: Text(t('login')),
          )
        else ...[
          OutlinedButton.icon(
            onPressed: () async {
              await ref.read(appProvider.notifier).logout();
              if (context.mounted) context.go('/auth');
            },
            icon: const Icon(Icons.logout),
            label: Text(t('logout')),
          ),
          const SizedBox(height: 16),
          TextButton.icon(
            onPressed: () async {
              if (!await confirm(context, t('deleteConfirm'), t)) return;
              try {
                await ref.read(apiProvider).delete('/users/me');
                await ref.read(appProvider.notifier).logout(revoked: true);
                if (context.mounted) context.go('/auth');
              } catch (e) {
                if (context.mounted) showMessage(context, readableError(e));
              }
            },
            icon: const Icon(Icons.person_remove_outlined),
            label: Text(t('deleteAccount')),
          ),
        ],
        const SizedBox(height: 24),
        Text(
          t('independent'),
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.labelLarge,
        ),
        const SizedBox(height: 20),
      ],
    );
  }
}
