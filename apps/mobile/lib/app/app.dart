import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/l10n.dart';
import '../core/state.dart';
import '../features/auth/auth_screen.dart';
import '../features/citizen/home_screen.dart';
import '../features/gis/map_screen.dart';
import '../features/infrastructure/registry_screen.dart';
import '../features/infrastructure/object_form.dart';
import '../features/infrastructure/passport_screen.dart';
import '../features/reports/report_screen.dart';
import '../features/profile/profile_screen.dart';
import '../features/inspections/inspections_screen.dart';
import '../features/notifications/notifications_screen.dart';
import '../features/sync/sync_screen.dart';
import '../features/routes/routes_screen.dart';
import '../core/api.dart';
import '../core/widgets.dart';

final router = GoRouter(
  initialLocation: '/home',
  routes: [
    GoRoute(path: '/auth', builder: (_, _) => const AuthScreen()),
    ShellRoute(
      builder: (context, state, child) =>
          AppShell(path: state.uri.path, child: child),
      routes: [
        GoRoute(path: '/home', builder: (_, _) => const HomeScreen()),
        GoRoute(path: '/map', builder: (_, _) => const MapScreen()),
        GoRoute(path: '/registry', builder: (_, _) => const RegistryScreen()),
        GoRoute(path: '/add', builder: (_, _) => const ObjectForm()),
        GoRoute(
          path: '/objects/:id',
          builder: (_, state) =>
              PassportScreen(id: state.pathParameters['id']!),
        ),
        GoRoute(
          path: '/objects/:id/edit',
          builder: (_, state) =>
              ObjectForm(objectId: state.pathParameters['id']!),
        ),
        GoRoute(path: '/report', builder: (_, _) => const ReportScreen()),
        GoRoute(path: '/reports', builder: (_, _) => const MyReportsScreen()),
        GoRoute(path: '/profile', builder: (_, _) => const ProfileScreen()),
        GoRoute(
          path: '/inspections',
          builder: (_, _) => const InspectionsScreen(),
        ),
        GoRoute(
          path: '/notifications',
          builder: (_, _) => const NotificationsScreen(),
        ),
        GoRoute(path: '/sync', builder: (_, _) => const SyncScreen()),
        GoRoute(
          path: '/routes',
          builder: (_, _) => const ApprovedRoutesScreen(),
        ),
      ],
    ),
  ],
);

class FvvApp extends ConsumerWidget {
  const FvvApp({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(appProvider);
    return MaterialApp.router(
      title: 'FVV GIS Uzbekistan',
      debugShowCheckedModeBanner: false,
      theme: appTheme(false),
      darkTheme: appTheme(true),
      themeMode: state.dark ? ThemeMode.dark : ThemeMode.light,
      locale: Locale(state.locale),
      supportedLocales: const [Locale('uz'), Locale('ru'), Locale('en')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      routerConfig: router,
    );
  }
}

class AppShell extends ConsumerWidget {
  const AppShell({required this.path, required this.child, super.key});
  final String path;
  final Widget child;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(appProvider);
    final employee = state.account?.isEmployee == true;
    final t = L10n(state.locale);
    final employeePath =
        path == '/registry' ||
        path == '/add' ||
        path == '/inspections' ||
        path == '/routes' ||
        path == '/sync' ||
        path.startsWith('/objects');
    final cachedRestrictedPath =
        path == '/map' ||
        path == '/registry' ||
        path == '/inspections' ||
        path == '/routes' ||
        path.startsWith('/objects');
    final restrictedUnavailable =
        employee && cachedRestrictedPath && !state.offlineGrantValid;
    final leaseMessage = switch (state.locale) {
      'ru' => 'Офлайн-доступ истёк или ещё не подтверждён. Подключитесь для проверки разрешений.',
      'en' => 'Offline access has expired or has not been confirmed. Connect to verify your permissions.',
      _ => 'Offline ruxsat muddati tugagan yoki hali tasdiqlanmagan. Ruxsatlarni tekshirish uchun internetga ulaning.',
    };
    final routes = employee
        ? ['/map', '/registry', '/add', '/inspections', '/profile']
        : ['/home', '/map', '/report', '/reports', '/profile'];
    final labels = employee
        ? ['map', 'registry', 'add', 'inspections', 'profile']
        : ['home', 'map', 'report', 'reports', 'profile'];
    final icons = employee
        ? [
            Icons.map_outlined,
            Icons.inventory_2_outlined,
            Icons.add_circle_outline,
            Icons.fact_check_outlined,
            Icons.person_outline,
          ]
        : [
            Icons.home_outlined,
            Icons.map_outlined,
            Icons.add_alert_outlined,
            Icons.assignment_outlined,
            Icons.person_outline,
          ];
    var index = routes.indexWhere((route) => path == route);
    if (index < 0) index = path.startsWith('/objects') ? 1 : 4;
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Icon(
              Icons.explore_outlined,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(width: 10),
            const Text(
              'FVV GIS',
              style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1.4),
            ),
          ],
        ),
        actions: [
          if (employee)
            IconButton(
              onPressed: () => context.go('/sync'),
              icon: const Icon(Icons.sync),
              tooltip: t('sync'),
            ),
          IconButton(
            onPressed: () => context.go('/notifications'),
            icon: const Icon(Icons.notifications_none_outlined),
            tooltip: t('notifications'),
          ),
        ],
      ),
      body: Column(
        children: [
          if (state.offline)
            Container(
              width: double.infinity,
              color: const Color(0xff6b4100),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Text(
                t('offline'),
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          if (state.account?.employeeStatus == 'pending_verification')
            Container(
              width: double.infinity,
              color: Theme.of(context).colorScheme.primaryContainer,
              padding: const EdgeInsets.all(12),
              child: Text(t('pendingVerification')),
            ),
          Expanded(
            child: state.initializing
                ? const Center(child: CircularProgressIndicator())
                : employeePath && !employee
                ? Center(
                    child: FilledButton.icon(
                      onPressed: () => context.go('/auth'),
                      icon: const Icon(Icons.lock_outline),
                      label: Text(t('login')),
                    ),
                  )
                : restrictedUnavailable
                ? SingleChildScrollView(
                    child: ErrorPanel(
                      StateError(leaseMessage),
                      t: t,
                      retry: () async {
                        try {
                          await ref.read(appProvider.notifier).renewLease();
                        } catch (error) {
                          if (context.mounted) {
                            showMessage(context, readableError(error));
                          }
                        }
                      },
                    ),
                  )
                : child,
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (value) => context.go(routes[value]),
        destinations: List.generate(
          routes.length,
          (i) =>
              NavigationDestination(icon: Icon(icons[i]), label: t(labels[i])),
        ),
      ),
    );
  }
}
