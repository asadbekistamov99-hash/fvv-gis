import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/l10n.dart';
import '../../core/state.dart';
import '../../core/widgets.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(appProvider),
        t = L10n(ref.watch(appProvider).locale);
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xff123f55), Color(0xff13263d)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: const Color(0xff327b91)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(Icons.public, color: Color(0xff77e7f5)),
                  SizedBox(width: 10),
                  Text(
                    'UZBEKISTAN',
                    style: TextStyle(
                      color: Color(0xff77e7f5),
                      letterSpacing: 2,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              Text(
                state.account?.fullName ?? 'FVV GIS',
                style: const TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                t('independent'),
                style: const TextStyle(color: Colors.white, fontSize: 16),
              ),
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: () => context.go('/map'),
                icon: const Icon(Icons.map_outlined),
                label: Text(t('publicMap')),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        SectionCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(
                    Icons.emergency_outlined,
                    color: Color(0xffff787f),
                    size: 32,
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Text(
                      t('emergencyNotice'),
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              OutlinedButton.icon(
                onPressed: () => launchUrl(Uri(scheme: 'tel', path: '112')),
                icon: const Icon(Icons.phone_outlined),
                label: const Text('112'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: () =>
              context.go(state.account == null ? '/auth' : '/report'),
          icon: const Icon(Icons.add_alert_outlined),
          label: Text(t('newReport')),
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: () =>
              context.go(state.account == null ? '/auth' : '/reports'),
          icon: const Icon(Icons.assignment_outlined),
          label: Text(t('reports')),
        ),
        const SizedBox(height: 20),
        SectionCard(
          title: state.locale == 'ru'
              ? 'Экстренные номера'
              : state.locale == 'en'
              ? 'Emergency contacts'
              : 'Shoshilinch xizmatlar',
          child: Column(
            children: [
              for (final item in [
                (
                  '112',
                  {
                    'uz': 'Yagona shoshilinch xizmat',
                    'ru': 'Единая экстренная служба',
                    'en': 'Unified emergency service',
                  },
                ),
                (
                  '101',
                  {
                    'uz': 'Yong‘in va qutqaruv',
                    'ru': 'Пожарная и спасательная служба',
                    'en': 'Fire and rescue',
                  },
                ),
                (
                  '102',
                  {'uz': 'Ichki ishlar', 'ru': 'Полиция', 'en': 'Police'},
                ),
                (
                  '103',
                  {
                    'uz': 'Tez tibbiy yordam',
                    'ru': 'Скорая помощь',
                    'en': 'Ambulance',
                  },
                ),
                (
                  '104',
                  {
                    'uz': 'Gaz avariya xizmati',
                    'ru': 'Газовая аварийная служба',
                    'en': 'Gas emergency',
                  },
                ),
              ])
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(item.$2[state.locale]!),
                  trailing: OutlinedButton(
                    onPressed: () =>
                        launchUrl(Uri(scheme: 'tel', path: item.$1)),
                    child: Text(item.$1),
                  ),
                ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => launchUrl(
                  Uri.parse('https://advice.adliya.uz/oz/document/3256'),
                  mode: LaunchMode.externalApplication,
                ),
                child: Text(
                  state.locale == 'en'
                      ? 'Source: Ministry of Justice'
                      : state.locale == 'ru'
                      ? 'Источник: Министерство юстиции'
                      : 'Manba: Adliya vazirligi',
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
