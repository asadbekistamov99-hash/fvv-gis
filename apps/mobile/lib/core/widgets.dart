import 'package:flutter/material.dart';

import 'api.dart';
import 'l10n.dart';

Color statusColor(String value) => switch (value) {
  'working' ||
  'approved' ||
  'published' ||
  'resolved' => const Color(0xff36d698),
  'faulty' || 'rejected' => const Color(0xffff8a91),
  'under_maintenance' ||
  'requires_correction' ||
  'submitted' => const Color(0xffffcd73),
  _ => const Color(0xffb6cce3),
};
IconData statusIcon(String value) => switch (value) {
  'working' ||
  'approved' ||
  'published' ||
  'resolved' => Icons.check_circle_outline,
  'faulty' || 'rejected' => Icons.error_outline,
  'under_maintenance' => Icons.build_outlined,
  _ => Icons.help_outline,
};

class StatusPill extends StatelessWidget {
  const StatusPill(this.value, {required this.t, super.key});
  final String value;
  final L10n t;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
    decoration: BoxDecoration(
      border: Border.all(color: statusColor(value)),
      borderRadius: BorderRadius.circular(9),
      color: statusColor(value).withValues(alpha: .1),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(statusIcon(value), size: 19, color: statusColor(value)),
        const SizedBox(width: 7),
        Flexible(
          child: Text(
            t(value),
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: Theme.of(context).brightness == Brightness.dark
                  ? statusColor(value)
                  : Theme.of(context).colorScheme.onSurface,
              fontSize: 14,
            ),
          ),
        ),
      ],
    ),
  );
}

class ErrorPanel extends StatelessWidget {
  const ErrorPanel(this.error, {required this.t, this.retry, super.key});
  final Object error;
  final VoidCallback? retry;
  final L10n t;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(24),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          Icons.cloud_off_outlined,
          size: 46,
          color: Theme.of(context).colorScheme.primary,
        ),
        const SizedBox(height: 16),
        Text(readableError(error), textAlign: TextAlign.center),
        if (retry != null) ...[
          const SizedBox(height: 18),
          OutlinedButton.icon(
            onPressed: retry,
            icon: const Icon(Icons.refresh),
            label: Text(t('retry')),
          ),
        ],
      ],
    ),
  );
}

class EmptyPanel extends StatelessWidget {
  const EmptyPanel({
    required this.t,
    this.icon = Icons.inventory_2_outlined,
    super.key,
  });
  final L10n t;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(36),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 56, color: Theme.of(context).colorScheme.primary),
        const SizedBox(height: 18),
        Text(t('empty'), textAlign: TextAlign.center),
      ],
    ),
  );
}

class SectionCard extends StatelessWidget {
  const SectionCard({required this.child, this.title, super.key});
  final Widget child;
  final String? title;
  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.symmetric(vertical: 8),
    child: Padding(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (title != null) ...[
            Text(
              title!,
              style: Theme.of(context).textTheme.titleLarge
                  ?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 16),
          ],
          child,
        ],
      ),
    ),
  );
}

class DataRowView extends StatelessWidget {
  const DataRowView(this.label, this.value, {super.key});
  final String label;
  final Object? value;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 9),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: Theme.of(context).textTheme.labelLarge),
        const SizedBox(height: 3),
        SelectableText(
          value?.toString() ?? '—',
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
        ),
      ],
    ),
  );
}

Future<bool> confirm(BuildContext context, String title, L10n t) async =>
    await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(t('cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(t('verify')),
          ),
        ],
      ),
    ) ??
    false;

void showMessage(BuildContext context, String message) =>
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
