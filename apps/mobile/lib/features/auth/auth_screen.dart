import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api.dart';
import '../../core/l10n.dart';
import '../../core/state.dart';
import '../../core/widgets.dart';

class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({super.key});
  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen> {
  final form = GlobalKey<FormState>();
  final phone = TextEditingController(text: '+998');
  final name = TextEditingController();
  final password = TextEditingController();
  final code = TextEditingController();
  final department = TextEditingController();
  final reference = TextEditingController();
  bool register = false, employee = false, busy = false;
  String? challenge, devOtp, error, regionId, organizationId, mfaChallenge;
  List<Map<String, dynamic>> organizations = [];
  @override
  void initState() {
    super.initState();
    Future.microtask(() async {
      try {
        final values = await ref
            .read(apiProvider)
            .list('/public/registration/organizations');
        if (mounted) setState(() => organizations = values);
      } catch (_) {}
    });
  }

  @override
  void dispose() {
    for (final c in [phone, name, password, code, department, reference]) {
      c.dispose();
    }
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
      if (challenge == null) {
        final response = Map<String, dynamic>.from(
          await api.post(register ? '/auth/register' : '/auth/login', {
            'phone': phone.text.trim(),
            if (register) 'full_name': name.text.trim(),
            if (register) 'password': password.text,
            if (register) 'account_type': employee ? 'employee' : 'citizen',
            if (register)
              'is_synthetic': const bool.fromEnvironment(
                'SYNTHETIC_MODE',
                defaultValue: true,
              ),
            if (register && employee) ...{
              'organization_id': organizationId,
              'region_id': regionId,
              'department': department.text.trim(),
              'verification_reference': reference.text.trim(),
              'requested_role': 'verified_employee',
            },
          }) as Map,
        );
        setState(() {
          challenge = response['challenge_id'] as String?;
          devOtp = response['dev_otp']?.toString();
        });
      } else {
        final response = Map<String, dynamic>.from(
          await api.post(
            mfaChallenge == null ? '/auth/verify-phone' : '/auth/mfa/verify',
            mfaChallenge == null
                ? {
                    'challenge_id': challenge,
                    'code': code.text.trim(),
                    'device_id': await api.deviceId,
                  }
                : {
                    'challenge_token': mfaChallenge,
                    'code': code.text.trim(),
                    'device_id': await api.deviceId,
                  },
          ) as Map,
        );
        if (response['mfa_required'] == true ||
            response['mfa_challenge_token'] != null) {
          setState(() {
            mfaChallenge = response['mfa_challenge_token'] as String?;
            code.clear();
          });
          if (response['mfa_setup_required'] == true) {
            final setup = await api.post('/auth/mfa/enroll', {
              'challenge_token': mfaChallenge,
            }) as Map;
            if (mounted) {
              await showDialog<void>(
                context: context,
                builder: (context) => AlertDialog(
                  title: const Text('MFA'),
                  content: SelectableText(
                    'Authenticator: ${setup['secret']}\n\n${setup['provisioning_uri']}',
                  ),
                  actions: [
                    FilledButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('OK'),
                    ),
                  ],
                ),
              );
            }
          }
          return;
        }
        await ref.read(appProvider.notifier).acceptSession(response);
        if (mounted) context.go('/map');
      }
    } catch (e) {
      setState(() => error = readableError(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = L10n(ref.watch(appProvider).locale);
    final regions = ref.watch(regionsProvider).asData?.value ?? [];
    return Scaffold(
      appBar: AppBar(title: const Text('FVV GIS')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560),
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              Container(
                alignment: Alignment.centerLeft,
                child: Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.primaryContainer,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Icon(
                    Icons.explore_outlined,
                    size: 48,
                    color: Theme.of(context).colorScheme.onPrimaryContainer,
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Text(
                challenge == null
                    ? t(register ? 'register' : 'login')
                    : mfaChallenge == null
                    ? t('code')
                    : 'MFA',
                style: Theme.of(context).textTheme.headlineLarge
                    ?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 8),
              Text(t('independent')),
              const SizedBox(height: 26),
              Form(
                key: form,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (challenge == null) ...[
                      SegmentedButton<bool>(
                        segments: [
                          ButtonSegment(value: false, label: Text(t('login'))),
                          ButtonSegment(
                            value: true,
                            label: Text(t('register')),
                          ),
                        ],
                        selected: {register},
                        onSelectionChanged: (values) =>
                            setState(() => register = values.first),
                      ),
                      const SizedBox(height: 24),
                      TextFormField(
                        controller: phone,
                        keyboardType: TextInputType.phone,
                        decoration: InputDecoration(
                          labelText: t('phone'),
                          prefixIcon: const Icon(Icons.phone_outlined),
                        ),
                        validator: (v) =>
                            RegExp(r'^\+998\d{9}$').hasMatch(v ?? '')
                            ? null
                            : '+998 XX XXX XX XX',
                      ),
                      if (register) ...[
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: name,
                          decoration: InputDecoration(labelText: t('name')),
                          validator: (v) => (v?.trim().length ?? 0) < 2
                              ? t('required')
                              : null,
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: password,
                          obscureText: true,
                          decoration: InputDecoration(
                            labelText: t('password'),
                            prefixIcon: const Icon(Icons.lock_outline),
                          ),
                          validator: (v) {
                            final value = v ?? '';
                            final strong = value.length >= 8 &&
                                RegExp(r'[A-Za-z]').hasMatch(value) &&
                                RegExp(r'\d').hasMatch(value);
                            return strong ? null : t('password_rules');
                          },
                        ),
                        const SizedBox(height: 20),
                        SegmentedButton<bool>(
                          segments: [
                            ButtonSegment(
                              value: false,
                              label: Text(t('citizen')),
                            ),
                            ButtonSegment(
                              value: true,
                              label: Text(t('employee')),
                            ),
                          ],
                          selected: {employee},
                          onSelectionChanged: (values) =>
                              setState(() => employee = values.first),
                        ),
                        if (employee) ...[
                          const SizedBox(height: 18),
                          Text(t('pendingVerification')),
                          if (organizations.isEmpty) ...[
                            const SizedBox(height: 12),
                            Text(switch (ref.watch(appProvider).locale) {
                              'ru' => 'Нет организаций, разрешённых для регистрации. Обратитесь к оператору сервиса.',
                              'en' => 'No organizations are approved for registration. Contact the service operator.',
                              _ => 'Ro‘yxatdan o‘tish uchun tasdiqlangan tashkilotlar yo‘q. Xizmat operatoriga murojaat qiling.',
                            }),
                          ],
                          const SizedBox(height: 16),
                          DropdownButtonFormField<String>(
                            initialValue: organizationId,
                            isExpanded: true,
                            decoration: InputDecoration(
                              labelText: t('organization'),
                            ),
                            items: organizations
                                .map(
                                  (e) => DropdownMenuItem(
                                    value: e['id'].toString(),
                                    child: Text(
                                      (e['name_uz'] ?? e['name'] ?? e['code'])
                                          .toString(),
                                    ),
                                  ),
                                )
                                .toList(),
                            onChanged: (value) =>
                                setState(() => organizationId = value),
                            validator: (v) => v == null ? t('required') : null,
                          ),
                          const SizedBox(height: 16),
                          DropdownButtonFormField<String>(
                            initialValue: regionId,
                            isExpanded: true,
                            decoration: InputDecoration(labelText: t('region')),
                            items: regions
                                .map(
                                  (e) => DropdownMenuItem(
                                    value: e['id'].toString(),
                                    child: Text(
                                      (e['name_uz'] ?? e['name'] ?? e['code'])
                                          .toString(),
                                    ),
                                  ),
                                )
                                .toList(),
                            onChanged: (value) =>
                                setState(() => regionId = value),
                            validator: (v) => v == null ? t('required') : null,
                          ),
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: department,
                            decoration: InputDecoration(
                              labelText: t('department'),
                            ),
                            validator: (v) => v?.trim().isEmpty == true
                                ? t('required')
                                : null,
                          ),
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: reference,
                            decoration: InputDecoration(
                              labelText: t('reference'),
                            ),
                          ),
                        ],
                      ],
                    ] else ...[
                      Text(
                        phone.text,
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 20),
                      if (devOtp != null)
                        SectionCard(
                          child: Text('${t('synthetic')} · OTP: $devOtp'),
                        ),
                      TextFormField(
                        controller: code,
                        keyboardType: TextInputType.number,
                        autofillHints: const [AutofillHints.oneTimeCode],
                        maxLength: 6,
                        decoration: InputDecoration(labelText: t('code')),
                        validator: (v) => RegExp(r'^\d{6}$').hasMatch(v ?? '')
                            ? null
                            : t('required'),
                      ),
                    ],
                    if (error != null)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 18),
                        child: Text(
                          error!,
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.error,
                          ),
                        ),
                      ),
                    const SizedBox(height: 20),
                    FilledButton.icon(
                      onPressed: busy ? null : send,
                      icon: busy
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Icon(
                              challenge == null
                                  ? Icons.arrow_forward
                                  : Icons.verified_user_outlined,
                            ),
                      label: Text(t(challenge == null ? 'continue' : 'verify')),
                    ),
                    if (challenge != null)
                      TextButton(
                        onPressed: () => setState(() {
                          challenge = null;
                          mfaChallenge = null;
                          code.clear();
                        }),
                        child: Text(t('cancel')),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 22),
              OutlinedButton.icon(
                onPressed: () => context.go('/map'),
                icon: const Icon(Icons.public),
                label: Text(t('publicMap')),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
