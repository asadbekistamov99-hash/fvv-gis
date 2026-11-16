import 'dart:async';
import 'dart:math' as math;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:maplibre_gl/maplibre_gl.dart';

import '../../core/api.dart';
import '../../core/l10n.dart';
import '../../core/state.dart';
import '../../core/widgets.dart';
import '../gis/map_screen.dart';

/// Private route navigation uses supervisor-approved geometry only. It never
/// sends operational coordinates to an installed navigation app or a third party.
class ApprovedRoutesScreen extends ConsumerStatefulWidget {
  const ApprovedRoutesScreen({super.key});

  @override
  ConsumerState<ApprovedRoutesScreen> createState() =>
      _ApprovedRoutesScreenState();
}

class _ApprovedRoutesScreenState extends ConsumerState<ApprovedRoutesScreen> {
  List<Map<String, dynamic>> _routes = [];
  Map<String, dynamic>? _selected;
  MapLibreMapController? _map;
  StreamSubscription<Position>? _positions;
  Timer? _leaseTimer;
  Timer? _statusTimer;
  Position? _position;
  String? _error;
  bool _loading = true;
  bool _offline = false;
  bool _navigating = false;
  bool _starting = false;
  bool _polling = false;
  bool _styleLoaded = false;
  int _step = 0;
  double? _nextDistance;

  String _text(String uz, String ru, String en) =>
      switch (ref.read(appProvider).locale) {
        'ru' => ru,
        'en' => en,
        _ => uz,
      };

  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
    _leaseTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      if (_navigating && !_mayNavigate(_selected)) {
        _stop(
          _text(
            'Marshrut yoki offline ruxsat muddati tugadi.',
            'Срок маршрута или офлайн-доступа истёк.',
            'Route approval or offline access has expired.',
          ),
        );
      }
      if (_offline &&
          ref.read(appProvider.notifier).store?.leaseValid != true) {
        _selected = null;
        _routes = [];
        _draw();
      }
      setState(() {});
    });
  }

  @override
  void dispose() {
    _positions?.cancel();
    _leaseTimer?.cancel();
    _statusTimer?.cancel();
    _map?.dispose();
    super.dispose();
  }

  bool _connectionFailure(Object error) =>
      error is DioException && error.response == null;

  Future<void> _load() async {
    if (ref.read(appProvider).account?.isEmployee != true) {
      if (mounted) setState(() => _loading = false);
      return;
    }
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final rows = await ref.read(apiProvider).list('/routes');
      if (!mounted) return;
      _routes = rows;
      _offline = false;
      final store = ref.read(appProvider.notifier).store;
      if (store?.leaseValid == true) await store!.putCache('routes', rows);
      final selectedId = _selected?['id'];
      if (selectedId != null) {
        _selected = rows.where((row) => row['id'] == selectedId).firstOrNull;
        if (_selected == null) _stop();
      }
    } catch (error) {
      if (_connectionFailure(error)) {
        try {
          final cached = await ref
              .read(appProvider.notifier)
              .store
              ?.readCache('routes');
          if (cached != null) {
            _routes = cached;
            _offline = true;
          } else {
            _error = readableError(error);
          }
        } catch (cacheError) {
          _error = readableError(cacheError);
          _routes = [];
          _selected = null;
        }
      } else {
        _error = readableError(error);
        _routes = [];
        _selected = null;
        _stop();
      }
    } finally {
      if (mounted) setState(() => _loading = false);
      await _draw();
    }
  }

  List<LatLng> _geometry(Map<String, dynamic>? route) {
    final geometry = route?['geometry'];
    if (geometry is! Map || geometry['type'] != 'LineString') return [];
    final coordinates = geometry['coordinates'];
    if (coordinates is! List || coordinates.length < 2) return [];
    final points = <LatLng>[];
    for (final coordinate in coordinates) {
      if (coordinate is! List ||
          coordinate.length < 2 ||
          coordinate[0] is! num ||
          coordinate[1] is! num) {
        return [];
      }
      final lon = (coordinate[0] as num).toDouble();
      final lat = (coordinate[1] as num).toDouble();
      if (!lat.isFinite || !lon.isFinite || lat.abs() > 90 || lon.abs() > 180) {
        return [];
      }
      points.add(LatLng(lat, lon));
    }
    return points;
  }

  bool _mayNavigate(Map<String, dynamic>? route) {
    final store = ref.read(appProvider.notifier).store;
    final trustedNow = store?.trustedNow;
    final expiry = DateTime.tryParse(route?['expires_at']?.toString() ?? '');
    final source = route?['source_date']?.toString() ?? '';
    return ref.read(appProvider).account?.isEmployee == true &&
        store?.leaseValid == true &&
        trustedNow != null &&
        expiry != null &&
        expiry.isAfter(trustedNow) &&
        route?['status'] == 'approved' &&
        (route?['approved_by']?.toString().isNotEmpty ?? false) &&
        source != 'unknown' &&
        DateTime.tryParse(source) != null &&
        _geometry(route).length >= 2;
  }

  Future<void> _select(Map<String, dynamic> route) async {
    _stop();
    if (!mounted) return;
    setState(() {
      _selected = route;
      _error = null;
      _step = 0;
      _position = null;
      _nextDistance = null;
    });
    await _draw(fit: true);
  }

  Future<void> _draw({bool fit = false}) async {
    if (!_styleLoaded || _map == null) return;
    try {
      await _map!.clearLines();
      await _map!.clearCircles();
      final points = _geometry(_selected);
      if (points.length >= 2) {
        await _map!.addLine(
          LineOptions(geometry: points, lineColor: '#08a5bc', lineWidth: 6),
        );
        await _map!.addCircle(
          CircleOptions(
            geometry: points.last,
            circleRadius: 11,
            circleColor: '#ffcd73',
            circleStrokeColor: '#081320',
            circleStrokeWidth: 3,
          ),
        );
        if (fit) {
          final south = points.map((p) => p.latitude).reduce(math.min);
          final north = points.map((p) => p.latitude).reduce(math.max);
          final west = points.map((p) => p.longitude).reduce(math.min);
          final east = points.map((p) => p.longitude).reduce(math.max);
          await _map!.animateCamera(
            CameraUpdate.newLatLngBounds(
              LatLngBounds(
                southwest: LatLng(south, west),
                northeast: LatLng(north, east),
              ),
              left: 35,
              top: 35,
              right: 35,
              bottom: 35,
            ),
          );
        }
      }
      final position = _position;
      if (position != null) {
        await _map!.addCircle(
          CircleOptions(
            geometry: LatLng(position.latitude, position.longitude),
            circleRadius: 9,
            circleColor: '#ffffff',
            circleStrokeColor: '#006879',
            circleStrokeWidth: 4,
          ),
        );
      }
    } catch (error) {
      if (mounted) setState(() => _error = readableError(error));
    }
  }

  Future<void> _start() async {
    if (_selected == null || _starting) return;
    setState(() {
      _starting = true;
      _error = null;
    });
    try {
      try {
        final fresh = Map<String, dynamic>.from(
          await ref.read(apiProvider).get('/routes/${_selected!['id']}') as Map,
        );
        _selected = fresh;
        _offline = false;
        if (ref.read(appProvider.notifier).store?.leaseValid != true) {
          await ref.read(appProvider.notifier).renewLease();
        }
      } catch (error) {
        if (!_connectionFailure(error)) rethrow;
        _offline = true;
      }
      if (!_mayNavigate(_selected)) {
        throw StateError(
          _text(
            'Tasdiq, manba sanasi va amaldagi offline ruxsat talab qilinadi.',
            'Нужны одобрение, дата источника и действующий офлайн-доступ.',
            'Approval, a source date and a valid offline grant are required.',
          ),
        );
      }
      final position = await currentPosition();
      final origin = _geometry(_selected).first;
      if (position.accuracy > 100 ||
          distanceMeters(
                origin,
                LatLng(position.latitude, position.longitude),
              ) >
              math.max(100, position.accuracy * 2)) {
        throw StateError(
          _text(
            'Tasdiqlangan boshlang‘ich nuqtaga yaqinlashing yoki yangi marshrut so‘rang. GPS aniqligini tekshiring.',
            'Подойдите к одобренной начальной точке или запросите новый маршрут. Проверьте точность GPS.',
            'Move near the approved route origin or request a new route. Check GPS accuracy.',
          ),
        );
      }
      if (!mounted) return;
      setState(() {
        _navigating = true;
        _step = 0;
      });
      _onPosition(position);
      _positions =
          Geolocator.getPositionStream(
            locationSettings: const LocationSettings(
              accuracy: LocationAccuracy.high,
              distanceFilter: 5,
            ),
          ).listen(
            _onPosition,
            onError: (Object error) => _stop(readableError(error)),
          );
      _statusTimer?.cancel();
      _statusTimer = Timer.periodic(
        const Duration(seconds: 60),
        (_) => _checkStatus(),
      );
    } catch (error) {
      if (mounted) setState(() => _error = readableError(error));
    } finally {
      if (mounted) setState(() => _starting = false);
    }
  }

  Future<void> _checkStatus() async {
    if (_polling || !_navigating || _selected == null) return;
    _polling = true;
    try {
      final fresh = Map<String, dynamic>.from(
        await ref.read(apiProvider).get('/routes/${_selected!['id']}') as Map,
      );
      if (!mounted) return;
      if (fresh['version'] != _selected?['version']) {
        _selected = fresh;
        _stop(
          _text(
            'Marshrut yangilangan. Tasdiqni qayta tekshiring.',
            'Маршрут изменён. Проверьте одобрение заново.',
            'The route changed. Review its approval again.',
          ),
        );
        return;
      }
      _selected = fresh;
      _offline = false;
      if (!_mayNavigate(fresh)) {
        _stop(
          _text(
            'Marshrut tasdig‘i bekor qilingan yoki muddati tugagan.',
            'Маршрут отозван или срок одобрения истёк.',
            'Route approval was withdrawn or has expired.',
          ),
        );
      }
    } catch (error) {
      if (_connectionFailure(error)) {
        _offline = true;
        if (!_mayNavigate(_selected)) _stop(readableError(error));
      } else {
        _stop(readableError(error));
        _selected = null;
        _routes = [];
        await _draw();
      }
    } finally {
      _polling = false;
      if (mounted) setState(() {});
    }
  }

  List<Map<String, dynamic>> get _steps => (_selected?['steps'] as List? ?? [])
      .whereType<Map>()
      .map((step) => Map<String, dynamic>.from(step))
      .toList();

  LatLng? _maneuverLocation(Map<String, dynamic> step) {
    final maneuver = step['maneuver'];
    final location = maneuver is Map ? maneuver['location'] : null;
    if (location is! List ||
        location.length < 2 ||
        location[0] is! num ||
        location[1] is! num) {
      return null;
    }
    return LatLng(
      (location[1] as num).toDouble(),
      (location[0] as num).toDouble(),
    );
  }

  void _onPosition(Position position) {
    if (!mounted || !_navigating) return;
    if (!_mayNavigate(_selected)) {
      _stop();
      return;
    }
    _position = position;
    final points = _geometry(_selected);
    final here = LatLng(position.latitude, position.longitude);
    if (position.accuracy <= 50 &&
        _distanceFromLine(here, points) >
            math.max(100, position.accuracy * 2)) {
      _stop(
        _text(
          'Tasdiqlangan yo‘ldan chiqildi. Yangi marshrut va tasdiq talab qilinadi.',
          'Вы отклонились от одобренного пути. Нужны новый маршрут и одобрение.',
          'You left the approved route. Request a new route and approval.',
        ),
      );
      return;
    }
    final steps = _steps;
    if (steps.isNotEmpty) {
      _step = _step.clamp(0, steps.length - 1);
      var target = _maneuverLocation(steps[_step]);
      while (target != null &&
          _step < steps.length - 1 &&
          distanceMeters(here, target) < math.max(30, position.accuracy)) {
        _step++;
        target = _maneuverLocation(steps[_step]);
      }
      _nextDistance = target == null ? null : distanceMeters(here, target);
      if (_step == steps.length - 1 &&
          _nextDistance != null &&
          _nextDistance! < 30 &&
          position.accuracy <= 35) {
        _stop(
          _text(
            'Tasdiqlangan manzilga yetib keldingiz.',
            'Вы прибыли в одобренный пункт назначения.',
            'You reached the approved destination.',
          ),
        );
      }
    }
    setState(() {});
    _draw();
  }

  // Local equirectangular projection is sufficient for a 100 m deviation
  // warning. The road route itself always comes from the private OSRM server.
  double _distanceFromLine(LatLng point, List<LatLng> line) {
    if (line.length < 2) return double.infinity;
    final scale = math.cos(point.latitude * math.pi / 180);
    const metres = 111195.0;
    var nearest = double.infinity;
    for (var i = 1; i < line.length; i++) {
      final ax = (line[i - 1].longitude - point.longitude) * scale * metres;
      final ay = (line[i - 1].latitude - point.latitude) * metres;
      final bx = (line[i].longitude - point.longitude) * scale * metres;
      final by = (line[i].latitude - point.latitude) * metres;
      final dx = bx - ax, dy = by - ay;
      final denominator = dx * dx + dy * dy;
      final projection = denominator == 0
          ? 0.0
          : (-(ax * dx + ay * dy) / denominator).clamp(0.0, 1.0);
      nearest = math.min(
        nearest,
        math.sqrt(
          math.pow(ax + projection * dx, 2) + math.pow(ay + projection * dy, 2),
        ),
      );
    }
    return nearest;
  }

  void _stop([String? message]) {
    _positions?.cancel();
    _positions = null;
    _statusTimer?.cancel();
    _statusTimer = null;
    _navigating = false;
    if (message != null) _error = message;
    if (mounted) setState(() {});
  }

  String _status(String value, L10n t) => switch (value) {
    'pending' => _text(
      'Rahbar tasdig‘i kutilmoqda',
      'Ожидает одобрения руководителя',
      'Awaiting supervisor approval',
    ),
    'expired' => _text('Muddati tugagan', 'Срок истёк', 'Expired'),
    'withdrawn' => _text(
      'Tasdiq bekor qilingan',
      'Одобрение отозвано',
      'Approval withdrawn',
    ),
    _ => t(value),
  };

  String _instruction(Map<String, dynamic> step) {
    final maneuver = step['maneuver'] as Map? ?? {};
    final type = maneuver['type']?.toString();
    final modifier = maneuver['modifier']?.toString() ?? '';
    final direction = modifier.contains('right')
        ? _text('o‘ngga', 'направо', 'right')
        : modifier.contains('left')
        ? _text('chapga', 'налево', 'left')
        : _text('to‘g‘riga', 'прямо', 'straight');
    final action = switch (type) {
      'arrive' => _text(
        'Manzilga yetib kelish',
        'Прибытие к месту назначения',
        'Arrive at destination',
      ),
      'depart' => _text(
        'Tasdiqlangan yo‘ldan boshlang',
        'Начните движение по одобренному пути',
        'Start along the approved route',
      ),
      'roundabout' || 'rotary' =>
        '${_text(
              'Aylanma harakat · chiqish',
              'Круговое движение · съезд',
              'Roundabout · exit',
            )} ${maneuver['exit'] ?? '—'}',
      'turn' ||
      'end of road' ||
      'fork' => _text('Buriling: ', 'Поверните: ', 'Turn: ') + direction,
      'merge' =>
        _text('Yo‘lga qo‘shiling: ', 'Присоединитесь: ', 'Merge: ') + direction,
      _ => _text('Davom eting: ', 'Продолжайте: ', 'Continue: ') + direction,
    };
    final name = step['name']?.toString() ?? '';
    return name.isEmpty ? action : '$action · $name';
  }

  String _distance(Object? metres) => metres is num && metres.isFinite
      ? metres < 1000
            ? '${metres.toStringAsFixed(0)} m'
            : '${(metres / 1000).toStringAsFixed(1)} km'
      : '—';

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(appProvider);
    final t = L10n(state.locale);
    ref.listen(
      appProvider.select(
        (state) => (
          state.account?.id,
          state.account?.policyEpoch,
          state.account?.isEmployee,
        ),
      ),
      (previous, next) {
        if (previous != next) {
          _stop();
          _selected = null;
          _routes = [];
          _draw();
          Future.microtask(_load);
        }
      },
    );
    if (state.account?.isEmployee != true) {
      return Center(child: Text(t('pendingVerification')));
    }
    final route = _selected;
    final steps = _steps;
    final activeStep = steps.isEmpty
        ? null
        : steps[_step.clamp(0, steps.length - 1)];
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  t('route'),
                  style: Theme.of(context).textTheme.headlineMedium
                      ?.copyWith(fontWeight: FontWeight.w900),
                ),
              ),
              IconButton(
                onPressed: _loading ? null : _load,
                tooltip: t('refresh'),
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            _text(
              'Oddiy yo‘l ma’lumotlari. Marshrut favqulodda harakat uchun yaroqlilik kafolati emas.',
              'Обычные дорожные данные. Маршрут не гарантирует пригодность для экстренного движения.',
              'Ordinary road data. This route does not guarantee suitability for emergency response.',
            ),
          ),
          if (_offline) SectionCard(child: Text(t('offline'))),
          if (_error != null)
            SectionCard(
              child: Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
          if (_loading) const LinearProgressIndicator(),
          if (!_loading && _routes.isEmpty)
            EmptyPanel(t: t, icon: Icons.route_outlined),
          ..._routes.map(
            (item) => Card(
              child: ListTile(
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
                leading: Icon(
                  item['status'] == 'approved'
                      ? Icons.verified_outlined
                      : Icons.pending_outlined,
                  color: Theme.of(context).colorScheme.primary,
                ),
                title: Text(
                  '${_distance(item['distance_m'])} · ${item['duration_s'] is num ? ((item['duration_s'] as num) / 60).ceil() : '—'} min',
                ),
                subtitle: Text(
                  '${_status(item['status']?.toString() ?? 'unknown', t)}\n${t('updated')}: ${item['source_date'] ?? '—'}',
                ),
                selected: item['id'] == route?['id'],
                trailing: const Icon(Icons.chevron_right),
                onTap: () => _select(item),
              ),
            ),
          ),
          if (route != null) ...[
            const SizedBox(height: 16),
            SizedBox(
              height: 300,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: MapLibreMap(
                  styleString: mapStyleUrl,
                  initialCameraPosition: CameraPosition(
                    target:
                        _geometry(route).firstOrNull ??
                        const LatLng(41.2, 64.6),
                    zoom: 11,
                  ),
                  myLocationEnabled: false,
                  compassEnabled: true,
                  onMapCreated: (controller) => _map = controller,
                  onStyleLoadedCallback: () {
                    _styleLoaded = true;
                    _draw(fit: true);
                  },
                ),
              ),
            ),
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text('© OpenStreetMap contributors · ODbL'),
            ),
            SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  DataRowView(
                    t('status'),
                    _status(route['status']?.toString() ?? 'unknown', t),
                  ),
                  DataRowView(
                    _text(
                      'Yo‘l ma’lumotlari sanasi',
                      'Дата дорожных данных',
                      'Road data date',
                    ),
                    route['source_date'],
                  ),
                  DataRowView(
                    _text(
                      'Tasdiqlagan rahbar',
                      'Одобривший руководитель',
                      'Approving supervisor',
                    ),
                    route['approved_by'],
                  ),
                  DataRowView(
                    _text(
                      'Tasdiq amal qiladi',
                      'Одобрение действительно до',
                      'Approval expires',
                    ),
                    route['expires_at'],
                  ),
                  if (ref.read(appProvider.notifier).store?.leaseValid == true)
                    DataRowView(
                      t('permission'),
                      '${ref.read(appProvider.notifier).store!.lease.remaining.inMinutes} min',
                    ),
                  if (_position != null)
                    DataRowView(
                      t('accuracy'),
                      '±${_position!.accuracy.toStringAsFixed(0)} m',
                    ),
                ],
              ),
            ),
            if (_navigating && activeStep != null)
              SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _instruction(activeStep),
                      style: Theme.of(context).textTheme.titleLarge
                          ?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    if (_nextDistance != null)
                      DataRowView(
                        _text(
                          'Keyingi amalga taxminan',
                          'Примерно до следующего манёвра',
                          'Approximate distance to next maneuver',
                        ),
                        '≈ ${_distance(_nextDistance)}',
                      ),
                    Text(
                      _text(
                        'Masofa GPS bo‘yicha taxminiy; yo‘l belgilariga rioya qiling.',
                        'GPS-расстояние приблизительное; соблюдайте дорожные знаки.',
                        'GPS distance is approximate; obey road signs.',
                      ),
                    ),
                  ],
                ),
              ),
            FilledButton.icon(
              onPressed: _starting
                  ? null
                  : _navigating
                  ? () => _stop()
                  : route['status'] == 'approved'
                  ? _start
                  : null,
              icon: _starting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Icon(
                      _navigating
                          ? Icons.stop_circle_outlined
                          : Icons.navigation_outlined,
                    ),
              label: Text(
                _navigating
                    ? _text(
                        'Navigatsiyani to‘xtatish',
                        'Остановить навигацию',
                        'Stop navigation',
                      )
                    : _text(
                        'Tasdiqlangan yo‘ldan boshlash',
                        'Начать по одобренному пути',
                        'Start approved navigation',
                      ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
