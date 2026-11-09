import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fvv_gis_uzbekistan/core/l10n.dart';
import 'package:fvv_gis_uzbekistan/core/state.dart';
import 'package:fvv_gis_uzbekistan/core/widgets.dart';

void main() {
  for (final dark in [false, true]) {
    test(
      'field theme has high-contrast text and large controls (dark=$dark)',
      () {
        final theme = appTheme(dark);
        final foreground = theme.colorScheme.onSurface.computeLuminance();
        final background = theme.colorScheme.surface.computeLuminance();
        final light = foreground > background ? foreground : background;
        final dim = foreground < background ? foreground : background;
        expect((light + 0.05) / (dim + 0.05), greaterThanOrEqualTo(7));
        expect(
          theme.filledButtonTheme.style!.minimumSize!.resolve({})!.height,
          greaterThanOrEqualTo(56),
        );
        expect(
          theme.iconButtonTheme.style!.minimumSize!.resolve({})!.width,
          greaterThanOrEqualTo(56),
        );
      },
    );
  }

  testWidgets('faulty condition is conveyed with text and an icon', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: appTheme(true),
        home: const Scaffold(
          body: Center(child: StatusPill('faulty', t: L10n('uz'))),
        ),
      ),
    );
    expect(find.text('Nosoz'), findsOneWidget);
    expect(find.byIcon(Icons.error_outline), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('unknown measurements display an em dash rather than zero', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: appTheme(false),
        home: const Scaffold(body: DataRowView('Bosim · kPa', null)),
      ),
    );
    expect(find.text('—'), findsOneWidget);
    expect(find.text('0'), findsNothing);
  });

  testWidgets('error state retains a working retry action with enlarged text', (
    tester,
  ) async {
    var retries = 0;
    await tester.pumpWidget(
      MaterialApp(
        theme: appTheme(true),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context)
              .copyWith(textScaler: const TextScaler.linear(2)),
          child: child!,
        ),
        home: Scaffold(
          body: SingleChildScrollView(
            child: ErrorPanel(
              StateError('Sinov xatosi'),
              t: const L10n('uz'),
              retry: () => retries++,
            ),
          ),
        ),
      ),
    );
    expect(find.text('Sinov xatosi'), findsOneWidget);
    await tester.tap(find.text('Qayta urinish'));
    expect(retries, 1);
    expect(tester.takeException(), isNull);
  });

  test('core safety labels are localized in all supported languages', () {
    for (final key in [
      'emergencyNotice',
      'offline',
      'faulty',
      'pendingVerification',
      'synthetic',
    ]) {
      for (final locale in ['uz', 'ru', 'en']) {
        expect(L10n(locale)(key), isNot(key), reason: '$locale/$key');
      }
    }
  });
}
